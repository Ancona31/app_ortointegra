/**
 * Cache offline de pacientes.
 * Precarga la lista completa del médico al iniciar sesión.
 * Permite búsqueda local, creación express offline y sincronización.
 * Datos cifrados vía secureStorage (AES-256-GCM) — LFPDPPP Art. 19.
 */

import { createClient } from '@/lib/supabase/client'
import { secureStorage } from '@/lib/secureStorage'
import { fetchWithRetry } from '@/lib/fetchWithRetry'
import { isOnline } from '@/lib/connectionMonitor'

const PATIENTS_CACHE_KEY = 'offline_patients_cache'
const PATIENTS_QUEUE_KEY = 'offline_patients_queue'

export interface CachedPatient {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  numero_expediente?: string | null
  sexo?: string | null
  telefono?: string | null
  email?: string | null
  /** true si fue creado offline y aún no se ha sincronizado */
  _offline?: boolean
}

interface QueuedPatient {
  tempId: string
  payload: Record<string, unknown>
  created_at: string
}

// ── Cache de pacientes ──────────────────────────────────────

/** Descarga todos los pacientes del médico y los guarda cifrados */
export async function precachePatients(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!isOnline()) return // no intentar si ya sabemos que estamos offline

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, fecha_nacimiento, numero_expediente, sexo, telefono, email')
      .neq('activo', false)
      .order('apellidos')
      .limit(5000)

    if (!error && data) {
      await secureStorage.set(PATIENTS_CACHE_KEY, data)
    }
  } catch {
    // silencioso — si falla, usamos cache anterior si existe
  }
}

/** Obtiene todos los pacientes del cache */
async function getCachedPatients(): Promise<CachedPatient[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<CachedPatient[]>(PATIENTS_CACHE_KEY)
  return data ?? []
}

/** Busca pacientes en el cache local por nombre/apellidos */
export async function searchPatientsOffline(query: string): Promise<CachedPatient[]> {
  const patients = await getCachedPatients()
  if (!query.trim()) return []

  const terms = query.toLowerCase().trim().split(/\s+/)
  return patients
    .filter(p => {
      const full = `${p.nombre} ${p.apellidos}`.toLowerCase()
      return terms.every(t => full.includes(t))
    })
    .slice(0, 8)
}

/** Obtiene un paciente por ID del cache */
export async function getPatientOffline(id: string): Promise<CachedPatient | null> {
  const patients = await getCachedPatients()
  return patients.find(p => p.id === id) ?? null
}

// ── Creación express offline ────────────────────────────────

async function getQueue(): Promise<QueuedPatient[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<QueuedPatient[]>(PATIENTS_QUEUE_KEY)
  return data ?? []
}

async function saveQueue(queue: QueuedPatient[]): Promise<void> {
  if (queue.length === 0) {
    secureStorage.remove(PATIENTS_QUEUE_KEY)
  } else {
    await secureStorage.set(PATIENTS_QUEUE_KEY, queue)
  }
}

/** Crea un paciente offline con UUID temporal. Lo agrega al cache y a la cola de sync. */
export async function createPatientOffline(data: {
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  email?: string | null
  consentimiento_otorgado?: boolean
}): Promise<CachedPatient> {
  const tempId = crypto.randomUUID()

  const patient: CachedPatient = {
    id: tempId,
    nombre: data.nombre,
    apellidos: data.apellidos,
    fecha_nacimiento: data.fecha_nacimiento ?? null,
    sexo: null,
    telefono: null,
    email: data.email ?? null,
    _offline: true,
  }

  // Agregar al cache para que esté disponible inmediatamente
  const patients = await getCachedPatients()
  patients.push(patient)
  await secureStorage.set(PATIENTS_CACHE_KEY, patients)

  // Agregar a la cola de sincronización
  const queue = await getQueue()
  queue.push({
    tempId,
    payload: { ...data, consentimiento_otorgado: data.consentimiento_otorgado ?? true },
    created_at: new Date().toISOString(),
  })
  await saveQueue(queue)

  return patient
}

/** Cuenta pacientes pendientes de sincronizar */
export async function getPendingPatientsCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

/**
 * Sincroniza pacientes creados offline con el servidor.
 * Devuelve un mapa de tempId → realId para actualizar referencias
 * en las colas de notas y documentos.
 */
export async function syncOfflinePatients(): Promise<Map<string, string>> {
  const queue = await getQueue()
  if (queue.length === 0) return new Map()
  if (!isOnline()) return new Map()

  const idMap = new Map<string, string>()
  const remaining: QueuedPatient[] = []

  for (const entry of queue) {
    try {
      const res = await fetchWithRetry('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
        maxRetries: 2,
        timeoutMs: 10_000,
      })

      if (res.ok) {
        const data = await res.json() as { id?: string }
        if (data.id) {
          idMap.set(entry.tempId, data.id)
        }
      } else {
        remaining.push(entry)
      }
    } catch {
      remaining.push(entry)
    }
  }

  await saveQueue(remaining)

  // Actualizar el cache: reemplazar IDs temporales por reales
  if (idMap.size > 0) {
    const patients = await getCachedPatients()
    for (const p of patients) {
      const realId = idMap.get(p.id)
      if (realId) {
        p.id = realId
        delete p._offline
      }
    }
    await secureStorage.set(PATIENTS_CACHE_KEY, patients)
  }

  return idMap
}

/**
 * Actualiza las referencias de paciente_id en las colas de notas offline.
 * Se llama después de syncOfflinePatients().
 */
export async function updateOfflineReferences(idMap: Map<string, string>): Promise<void> {
  if (idMap.size === 0) return

  // Actualizar cola de notas
  const notesRaw = await secureStorage.get<Array<{ id: string; paciente_id: string; payload: Record<string, unknown>; created_at: string; retries: number }>>('offline_notes_queue')
  if (notesRaw && notesRaw.length > 0) {
    let changed = false
    for (const note of notesRaw) {
      const realId = idMap.get(note.paciente_id)
      if (realId) {
        note.paciente_id = realId
        changed = true
      }
    }
    if (changed) await secureStorage.set('offline_notes_queue', notesRaw)
  }

  // Actualizar cola de documentos
  const docsRaw = await secureStorage.get<Array<{ id: string; paciente_id?: string; tipo: string; contenido: Record<string, unknown>; created_at: string; retries: number }>>('offline_queue')
  if (docsRaw && docsRaw.length > 0) {
    let changed = false
    for (const doc of docsRaw) {
      if (doc.paciente_id) {
        const realId = idMap.get(doc.paciente_id)
        if (realId) {
          doc.paciente_id = realId
          changed = true
        }
      }
    }
    if (changed) await secureStorage.set('offline_queue', docsRaw)
  }
}
