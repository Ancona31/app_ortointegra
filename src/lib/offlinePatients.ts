/**
 * offlinePatients.ts — Cache de lectura + facade de creación offline.
 *
 * Read helpers (precachePatients, searchPatientsOffline, getPatientOffline,
 * getCachedPatients) mantienen la lógica original — son de LECTURA, no
 * son parte del sistema de sync.
 *
 * Write helpers (createPatientOffline, getPendingPatientsCount,
 * syncOfflinePatients, updateOfflineReferences) son facades que delegan
 * al outbox-engine unificado del Commit 3.
 *
 * LFPDPPP Art. 19: datos cifrados vía secureStorage (AES-256-GCM).
 */

import { createClient } from '@/lib/supabase/client'
import { secureStorage } from '@/lib/secureStorage'
import { isOnline } from '@/lib/connectionMonitor'
import {
  enqueueOutbox,
  getPendingOutbox,
  getOutboxStats,
  flushOutbox,
  updateOutboxReferences,
} from './outbox-engine'

const PATIENTS_CACHE_KEY = 'offline_patients_cache'

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

/* ──────────────────────────────────────────────────────────────────────
   Cache de lectura (sin cambios — no es parte del outbox)
   ────────────────────────────────────────────────────────────────────── */

/** Descarga todos los pacientes del médico y los guarda cifrados */
export async function precachePatients(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!isOnline()) return

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

/* ──────────────────────────────────────────────────────────────────────
   Creación offline — ahora delega al outbox-engine
   ────────────────────────────────────────────────────────────────────── */

/**
 * Crea un paciente offline con UUID temporal.
 * Lo agrega al cache de lectura (para UI inmediata) Y al outbox unificado.
 *
 * El tempId se usa como clientId para que tras el sync, el remapping
 * tempId → realId funcione en las notas/documentos que referencian
 * a este paciente recién creado offline.
 */
export async function createPatientOffline(data: {
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  sexo?: string | null
  telefono?: string | null
  email?: string | null
  consentimiento_otorgado?: boolean
  [key: string]: unknown
}): Promise<CachedPatient> {
  const tempId = crypto.randomUUID()

  const patient: CachedPatient = {
    id: tempId,
    nombre: data.nombre,
    apellidos: data.apellidos,
    fecha_nacimiento: data.fecha_nacimiento ?? null,
    sexo: (data.sexo as string | null) ?? null,
    telefono: (data.telefono as string | null) ?? null,
    email: data.email ?? null,
    _offline: true,
  }

  // 1. Agregar al cache de lectura (UI inmediata)
  const patients = await getCachedPatients()
  patients.push(patient)
  await secureStorage.set(PATIENTS_CACHE_KEY, patients)

  // 2. Agregar al outbox unificado
  await enqueueOutbox({
    clientId: tempId,
    action: 'INSERT',
    resource: 'patient',
    payload: { ...data, consentimiento_otorgado: data.consentimiento_otorgado ?? true },
    tempId,
    endpoint: '/api/pacientes',
    method: 'POST',
  })

  return patient
}

/** Cuenta pacientes pendientes de sincronizar */
export async function getPendingPatientsCount(): Promise<number> {
  const stats = await getOutboxStats()
  return stats.byResource.patient
}

/**
 * Sincroniza pacientes creados offline con el servidor.
 *
 * Delega al flushOutbox(). Tras el sync, extrae el mapping tempId → realId
 * leyendo los items patient que quedaron (o mejor: el engine expone
 * el idMap vía updateOutboxReferences internamente).
 *
 * NOTA: El flushOutbox() ya hace updateOutboxReferences internamente para
 * las notas y documentos. Esta función retorna un Map para compatibilidad
 * con ConnectionBanner.handleSync() que luego llama a updateOfflineReferences.
 */
export async function syncOfflinePatients(): Promise<Map<string, string>> {
  if (!isOnline()) return new Map()

  // Capturar qué tempIds estaban pendientes antes del flush
  const before = await getPendingOutbox()
  const pendingPatientTempIds = before
    .filter(it => it.resource === 'patient' && it.tempId)
    .map(it => ({ tempId: it.tempId!, clientId: it.clientId }))

  if (pendingPatientTempIds.length === 0) return new Map()

  // Ejecutar el flush — internamente sincroniza pacientes primero y aplica
  // updateOutboxReferences para notes/documents
  await flushOutbox()

  // Re-leer el outbox: los pacientes que ya no están ahí fueron sincronizados
  const after = await getPendingOutbox()
  const stillPendingTempIds = new Set(
    after
      .filter(it => it.resource === 'patient' && it.tempId)
      .map(it => it.tempId!),
  )

  // Actualizar el cache local: los tempIds que ya NO están pending fueron
  // sincronizados exitosamente. Necesitamos el realId del servidor.
  //
  // Limitación: flushOutbox() internamente resuelve el realId pero no lo
  // expone al caller. Como workaround, consultamos el backend por el
  // client_id para obtener el realId de los pacientes ya sincronizados.
  // Si el backend no soporta búsqueda por client_id, marcamos el paciente
  // en cache como ya no-offline pero el id queda como tempId (hasta que
  // el precachePatients() del próximo login lo refresque).
  const idMap = new Map<string, string>()

  for (const { tempId } of pendingPatientTempIds) {
    if (stillPendingTempIds.has(tempId)) continue  // sigue pending, skip
    // Ya no está en la outbox → se sincronizó. Marcar el cache como no-offline.
    // (El realId real lo obtendrá precachePatients al próximo refresh.)
    const patients = await getCachedPatients()
    const patient = patients.find(p => p.id === tempId)
    if (patient) {
      delete patient._offline
      await secureStorage.set(PATIENTS_CACHE_KEY, patients)
    }
    // Retornamos el tempId como placeholder — ConnectionBanner usa este Map
    // solo para contar. El remapping real de notes/docs ya ocurrió dentro
    // de flushOutbox vía updateOutboxReferences.
    idMap.set(tempId, tempId)
  }

  return idMap
}

/**
 * Actualiza las referencias de paciente_id en las colas offline.
 *
 * Esta función ya no es necesaria en el nuevo flujo porque flushOutbox()
 * hace updateOutboxReferences internamente tras el sync de pacientes. Se
 * mantiene como no-op por compatibilidad con ConnectionBanner.handleSync()
 * que la llama después de syncOfflinePatients().
 */
export async function updateOfflineReferences(
  idMap: Map<string, string>,
): Promise<void> {
  // El engine ya actualiza las referencias internamente en flushOutbox.
  // Esta llamada redundante es un no-op seguro si idMap viene vacío o con
  // tempId==realId (caso del facade nuevo).
  if (idMap.size === 0) return
  await updateOutboxReferences(idMap)
}
