/**
 * outbox-engine.ts — Motor unificado de sincronización offline para Spinus.
 *
 * Reemplaza las 3 queues fragmentadas (offlineQueue, offlineNotes,
 * offlinePatients) con un esquema Action/Resource/Payload coherente.
 *
 * Características:
 *   - Idempotencia via clientId (UUID v4 estable entre retries)
 *   - Clasificación HTTP: 4xx → Dead Letter Queue, 5xx → retry con backoff
 *   - Backoff exponencial: 1s → 2s → 4s → 8s → 16s → cap 60s
 *   - Max 5 retries antes de DLQ
 *   - Respeta lastAttemptAt para no re-intentar demasiado pronto
 *   - Sync ordenado: patients → updateRefs → notes + documents (paralelo)
 *   - Remapping de tempId → realId tras sync de pacientes creados offline
 *   - Migración automática e idempotente desde las queues legacy
 *
 * Los archivos offlineQueue.ts, offlineNotes.ts y offlinePatients.ts
 * se convirtieron en facades que delegan a este engine.
 *
 * LFPDPPP Art. 19: datos cifrados en secureStorage (AES-256-GCM).
 */

import { secureStorage } from '@/lib/secureStorage'
import { fetchWithRetry } from '@/lib/fetchWithRetry'
import { isOnline } from '@/lib/connectionMonitor'

/* ──────────────────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────────────────── */

export type OutboxAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type OutboxResource = 'patient' | 'note' | 'document' | 'appointment'
export type OutboxStatus = 'pending' | 'syncing' | 'failed_permanent'

export interface OutboxItem<T = Record<string, unknown>> {
  /** UUID v4 local — identificador único dentro de la outbox */
  id: string
  /** UUID v4 para idempotencia en el servidor — estable entre retries */
  clientId: string
  /** Tipo de operación */
  action: OutboxAction
  /** Recurso afectado */
  resource: OutboxResource
  /** Subtype dentro del recurso (ej. 'receta', 'solicitud_lab') */
  subtype?: string
  /** Payload crudo a enviar al servidor */
  payload: T
  /** ID temporal local (para paciente creado offline) */
  tempId?: string
  /** Referencia a otro tempId — si es un doc/nota de un paciente offline */
  tempRef?: string
  /** Endpoint destino */
  endpoint: string
  /** Método HTTP */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** ISO timestamp de creación */
  createdAt: string
  /** Número de intentos fallidos */
  retries: number
  /** ISO timestamp del último intento (para respetar backoff) */
  lastAttemptAt?: string
  /** Último error (mensaje breve) */
  lastError?: string
  /** Estado actual del item */
  status: OutboxStatus
}

export interface DeadLetterItem<T = Record<string, unknown>> extends OutboxItem<T> {
  failedAt: string
  finalError: string
  httpStatus?: number
}

export interface OutboxStats {
  pending: number
  failed: number
  byResource: {
    patient: number
    note: number
    document: number
    appointment: number
  }
}

export interface FlushResult {
  synced: number
  retrying: number
  dead: number
}

/* ──────────────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────────────── */

const OUTBOX_KEY = 'outbox_pending_v2'
const DLQ_KEY = 'outbox_dead_letter_v2'
const MIGRATED_FLAG_KEY = 'outbox_migrated_v2'

const MAX_RETRIES = 5
const HTTP_TIMEOUT_MS = 10_000

/* ──────────────────────────────────────────────────────────────────────
   Helpers de storage
   ────────────────────────────────────────────────────────────────────── */

async function getOutbox(): Promise<OutboxItem[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<OutboxItem[]>(OUTBOX_KEY)
  return Array.isArray(data) ? data : []
}

async function saveOutbox(items: OutboxItem[]): Promise<void> {
  if (items.length === 0) {
    secureStorage.remove(OUTBOX_KEY)
  } else {
    await secureStorage.set(OUTBOX_KEY, items)
  }
}

async function getDLQ(): Promise<DeadLetterItem[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<DeadLetterItem[]>(DLQ_KEY)
  return Array.isArray(data) ? data : []
}

async function saveDLQ(items: DeadLetterItem[]): Promise<void> {
  if (items.length === 0) {
    secureStorage.remove(DLQ_KEY)
  } else {
    await secureStorage.set(DLQ_KEY, items)
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Backoff y clasificación de errores
   ────────────────────────────────────────────────────────────────────── */

/** Backoff exponencial: 1s, 2s, 4s, 8s, 16s, cap 60s */
function nextRetryDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 60_000)
}

/** Retorna true si el item ya puede re-intentarse según su lastAttemptAt */
function canRetryNow(item: OutboxItem): boolean {
  if (!item.lastAttemptAt) return true
  const last = new Date(item.lastAttemptAt).getTime()
  if (isNaN(last)) return true
  const delay = nextRetryDelay(item.retries)
  return Date.now() - last >= delay
}

type ErrorDecision = 'retry' | 'dead' | 'success'

function classifyResponse(res: Response | null): ErrorDecision {
  if (!res) return 'retry'  // error de red / fetch falló
  if (res.ok) return 'success'
  if (res.status >= 200 && res.status < 300) return 'success'

  // Casos especiales 4xx que SÍ son retry (transitorios)
  if (res.status === 408) return 'retry'  // Request Timeout
  if (res.status === 429) return 'retry'  // Too Many Requests

  // 4xx restantes → error del cliente, no reintentable → DLQ
  if (res.status >= 400 && res.status < 500) return 'dead'

  // 5xx → error del servidor, reintentable
  if (res.status >= 500) return 'retry'

  return 'retry'
}

/* ──────────────────────────────────────────────────────────────────────
   Migración de queues legacy (idempotente)
   ────────────────────────────────────────────────────────────────────── */

interface LegacyDocument {
  id?: string
  paciente_id?: string
  tipo: string
  contenido: Record<string, unknown>
  created_at?: string
  retries?: number
}

interface LegacyNote {
  id?: string
  paciente_id: string
  payload: Record<string, unknown>
  created_at?: string
  retries?: number
}

interface LegacyPatient {
  tempId: string
  payload: Record<string, unknown>
  created_at?: string
}

let migrationInFlight: Promise<void> | null = null

async function migrateLegacyQueues(): Promise<void> {
  // Singleton promise — si ya está corriendo, esperar
  if (migrationInFlight) return migrationInFlight

  migrationInFlight = (async () => {
    try {
      const already = await secureStorage.get<boolean>(MIGRATED_FLAG_KEY)
      if (already) return

      const [oldDocs, oldNotes, oldPatients] = await Promise.all([
        secureStorage.get<LegacyDocument[]>('offline_queue'),
        secureStorage.get<LegacyNote[]>('offline_notes_queue'),
        secureStorage.get<LegacyPatient[]>('offline_patients_queue'),
      ])

      const migrated: OutboxItem[] = []
      const nowIso = new Date().toISOString()

      // Migrar documentos
      for (const doc of oldDocs ?? []) {
        const id = doc.id ?? crypto.randomUUID()
        migrated.push({
          id,
          clientId: id,
          action: 'INSERT',
          resource: 'document',
          subtype: doc.tipo,
          payload: doc.contenido,
          tempRef: doc.paciente_id,
          endpoint: '/api/documentos',
          method: 'POST',
          createdAt: doc.created_at ?? nowIso,
          retries: doc.retries ?? 0,
          status: 'pending',
        })
      }

      // Migrar notas
      for (const note of oldNotes ?? []) {
        const id = note.id ?? crypto.randomUUID()
        migrated.push({
          id,
          clientId: id,
          action: 'INSERT',
          resource: 'note',
          payload: note.payload,
          tempRef: note.paciente_id,
          endpoint: '/api/consultas',
          method: 'POST',
          createdAt: note.created_at ?? nowIso,
          retries: note.retries ?? 0,
          status: 'pending',
        })
      }

      // Migrar pacientes
      for (const pat of oldPatients ?? []) {
        migrated.push({
          id: crypto.randomUUID(),
          clientId: pat.tempId,
          action: 'INSERT',
          resource: 'patient',
          payload: pat.payload,
          tempId: pat.tempId,
          endpoint: '/api/pacientes',
          method: 'POST',
          createdAt: pat.created_at ?? nowIso,
          retries: 0,
          status: 'pending',
        })
      }

      // Fusionar con cualquier outbox_pending_v2 existente (por seguridad)
      const existing = await getOutbox()
      const combined = [...existing, ...migrated]

      if (combined.length > 0) {
        await saveOutbox(combined)
      }

      // Eliminar queues legacy
      secureStorage.remove('offline_queue')
      secureStorage.remove('offline_notes_queue')
      secureStorage.remove('offline_patients_queue')

      // Marcar migración como completada
      await secureStorage.set(MIGRATED_FLAG_KEY, true)

      // eslint-disable-next-line no-console
      console.log(`[outbox] Migrated ${migrated.length} items from legacy queues`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[outbox] Migration failed:', err)
    } finally {
      migrationInFlight = null
    }
  })()

  return migrationInFlight
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: Enqueue
   ────────────────────────────────────────────────────────────────────── */

/**
 * Agrega un item al outbox. Idempotente: si ya existe un item con el mismo
 * clientId + resource, no lo duplica.
 */
export async function enqueueOutbox<T>(
  item: Omit<
    OutboxItem<T>,
    'id' | 'createdAt' | 'retries' | 'status' | 'lastAttemptAt' | 'lastError'
  >,
): Promise<string> {
  // Asegurar migración antes de cualquier enqueue
  await migrateLegacyQueues()

  const outbox = await getOutbox()

  // Idempotencia: si ya existe un item con el mismo clientId + resource, retornar
  const existing = outbox.find(
    it => it.clientId === item.clientId && it.resource === item.resource,
  )
  if (existing) {
    return existing.id
  }

  const id = crypto.randomUUID()
  const newItem: OutboxItem<T> = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending',
  }

  outbox.push(newItem as unknown as OutboxItem)
  await saveOutbox(outbox)
  return id
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: Getters
   ────────────────────────────────────────────────────────────────────── */

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  await migrateLegacyQueues()
  return getOutbox()
}

export async function getDeadLetterQueue(): Promise<DeadLetterItem[]> {
  return getDLQ()
}

export async function getOutboxStats(): Promise<OutboxStats> {
  await migrateLegacyQueues()
  const [outbox, dlq] = await Promise.all([getOutbox(), getDLQ()])

  const byResource = {
    patient: 0,
    note: 0,
    document: 0,
    appointment: 0,
  }
  for (const item of outbox) {
    byResource[item.resource]++
  }

  return {
    pending: outbox.length,
    failed: dlq.length,
    byResource,
  }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: Dead Letter Queue management
   ────────────────────────────────────────────────────────────────────── */

async function moveToDLQ(
  item: OutboxItem,
  finalError: string,
  httpStatus?: number,
): Promise<void> {
  const dlq = await getDLQ()
  dlq.push({
    ...item,
    status: 'failed_permanent',
    failedAt: new Date().toISOString(),
    finalError,
    httpStatus,
  })
  await saveDLQ(dlq)
}

export async function retryDeadLetterItem(itemId: string): Promise<boolean> {
  const dlq = await getDLQ()
  const idx = dlq.findIndex(it => it.id === itemId)
  if (idx === -1) return false

  const item = dlq[idx]
  // Mover de DLQ a pending con retries reset a 0
  const outbox = await getOutbox()
  outbox.push({
    ...item,
    retries: 0,
    status: 'pending',
    lastAttemptAt: undefined,
    lastError: undefined,
  })
  await saveOutbox(outbox)

  // Remover de DLQ
  dlq.splice(idx, 1)
  await saveDLQ(dlq)
  return true
}

export async function discardDeadLetterItem(itemId: string): Promise<void> {
  const dlq = await getDLQ()
  const filtered = dlq.filter(it => it.id !== itemId)
  await saveDLQ(filtered)
}

export async function clearDeadLetter(): Promise<void> {
  await saveDLQ([])
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: ID remapping (tras sync de pacientes offline)
   ────────────────────────────────────────────────────────────────────── */

/**
 * Actualiza las referencias tempRef en el outbox tras el sync de pacientes.
 * Si una nota/doc apuntaba a un paciente offline con tempId=X, y ahora
 * X fue sincronizado y obtuvo realId=Y, actualizamos tempRef y el
 * payload.paciente_id para que la siguiente sync envíe el ID real.
 */
export async function updateOutboxReferences(
  idMap: Map<string, string>,
): Promise<void> {
  if (idMap.size === 0) return

  const outbox = await getOutbox()
  let changed = false

  for (const item of outbox) {
    if (!item.tempRef) continue
    const realId = idMap.get(item.tempRef)
    if (!realId) continue

    item.tempRef = realId
    // También actualizar payload.paciente_id si existe (para notes + docs)
    if (item.payload && typeof item.payload === 'object') {
      const payload = item.payload as Record<string, unknown>
      if ('paciente_id' in payload) {
        payload.paciente_id = realId
      }
    }
    changed = true
  }

  if (changed) {
    await saveOutbox(outbox)
  }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: Flush ordenado
   ────────────────────────────────────────────────────────────────────── */

interface ItemResult {
  item: OutboxItem
  decision: ErrorDecision
  httpStatus?: number
  errorMessage?: string
  realId?: string  // solo para pacientes creados offline
}

async function syncItem(item: OutboxItem): Promise<ItemResult> {
  // Construir body: para documents incluimos paciente_id como campo top-level
  let body: Record<string, unknown>
  if (item.resource === 'document') {
    body = {
      client_id: item.clientId,
      tipo: item.subtype,
      contenido: item.payload,
      ...(item.tempRef ? { paciente_id: item.tempRef } : {}),
    }
  } else if (item.resource === 'note') {
    body = {
      client_id: item.clientId,
      paciente_id: item.tempRef,
      ...(item.payload as Record<string, unknown>),
    }
  } else if (item.resource === 'patient') {
    body = {
      client_id: item.clientId,
      ...(item.payload as Record<string, unknown>),
    }
  } else {
    // appointment u otros recursos futuros
    body = {
      client_id: item.clientId,
      ...(item.payload as Record<string, unknown>),
    }
  }

  try {
    const res = await fetchWithRetry(item.endpoint, {
      method: item.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      maxRetries: 2,
      timeoutMs: HTTP_TIMEOUT_MS,
    })

    const decision = classifyResponse(res)

    if (decision === 'success') {
      // Para pacientes, parsear la respuesta para obtener el realId
      let realId: string | undefined
      if (item.resource === 'patient') {
        try {
          const data = await res.json() as { id?: string }
          if (data.id) realId = data.id
        } catch {
          // respuesta no JSON — no retornar realId
        }
      }
      return { item, decision, realId }
    }

    if (decision === 'dead') {
      let errorMessage = `HTTP ${res.status}`
      try {
        const text = await res.text()
        if (text) errorMessage += ': ' + text.slice(0, 200)
      } catch {
        // ignorar
      }
      return { item, decision, httpStatus: res.status, errorMessage }
    }

    // retry
    return {
      item,
      decision: 'retry',
      httpStatus: res.status,
      errorMessage: `HTTP ${res.status}`,
    }
  } catch (err) {
    // Error de red / timeout
    return {
      item,
      decision: 'retry',
      errorMessage: err instanceof Error ? err.message : 'network error',
    }
  }
}

/**
 * Procesa una lista de items: sync en serie, clasifica resultados,
 * actualiza estado, mueve a DLQ cuando corresponde.
 */
async function processBatch(
  items: OutboxItem[],
): Promise<{
  synced: number
  retrying: OutboxItem[]
  dead: OutboxItem[]
  idMap: Map<string, string>
}> {
  let synced = 0
  const retrying: OutboxItem[] = []
  const dead: OutboxItem[] = []
  const idMap = new Map<string, string>()

  for (const item of items) {
    // Respetar backoff — si aún no toca retry, mantener en pending sin intentar
    if (!canRetryNow(item)) {
      retrying.push(item)
      continue
    }

    const result = await syncItem(item)
    const nowIso = new Date().toISOString()

    if (result.decision === 'success') {
      synced++
      // Para pacientes: registrar tempId → realId
      if (item.resource === 'patient' && item.tempId && result.realId) {
        idMap.set(item.tempId, result.realId)
      }
      continue
    }

    if (result.decision === 'dead') {
      // Error del cliente (4xx) → directo a DLQ sin retry
      await moveToDLQ(
        item,
        result.errorMessage ?? 'client error',
        result.httpStatus,
      )
      dead.push(item)
      continue
    }

    // retry
    const updatedRetries = item.retries + 1
    if (updatedRetries >= MAX_RETRIES) {
      // Agotamos retries → DLQ
      await moveToDLQ(
        item,
        result.errorMessage ?? 'max retries exceeded',
        result.httpStatus,
      )
      dead.push(item)
      continue
    }

    retrying.push({
      ...item,
      retries: updatedRetries,
      lastAttemptAt: nowIso,
      lastError: result.errorMessage,
    })
  }

  return { synced, retrying, dead, idMap }
}

/**
 * Prioriza items por peso del payload serializado (ascendente).
 *
 * Objetivo: cuando la red vuelve tras horas offline, procesar primero
 * los registros JSON ligeros (recetas, notas, solicitudes) antes que
 * items pesados (PDFs embebidos, imágenes base64) que tienen más
 * probabilidad de fallar por timeout y bloquear el sync completo.
 *
 * No toca el schema del OutboxItem. Ordena localmente el array justo
 * antes del processBatch. Sort estable por ES2019+.
 */
function prioritizeByWeight(items: OutboxItem[]): OutboxItem[] {
  return [...items].sort((a, b) => {
    let wa: number
    let wb: number
    try { wa = JSON.stringify(a.payload ?? {}).length } catch { wa = Number.MAX_SAFE_INTEGER }
    try { wb = JSON.stringify(b.payload ?? {}).length } catch { wb = Number.MAX_SAFE_INTEGER }
    return wa - wb
  })
}

/**
 * Flush ordenado: pacientes primero, luego updateReferences, luego
 * notas + documentos en paralelo. Dentro de cada grupo, items ligeros
 * tienen prioridad sobre items pesados. Retorna el resumen total.
 */
export async function flushOutbox(): Promise<FlushResult> {
  await migrateLegacyQueues()
  if (!isOnline()) return { synced: 0, retrying: 0, dead: 0 }

  const outbox = await getOutbox()
  if (outbox.length === 0) return { synced: 0, retrying: 0, dead: 0 }

  // Separar por recurso
  const patients = outbox.filter(it => it.resource === 'patient')
  const notes = outbox.filter(it => it.resource === 'note')
  const documents = outbox.filter(it => it.resource === 'document')
  const others = outbox.filter(
    it => !['patient', 'note', 'document'].includes(it.resource),
  )

  // 1. Procesar pacientes primero (ordenados por peso)
  const patientResult = await processBatch(prioritizeByWeight(patients))

  // 2. Si hay remapping, actualizar referencias en notes/docs antes del flush
  let notesToProcess = notes
  let documentsToProcess = documents
  if (patientResult.idMap.size > 0) {
    await updateOutboxReferences(patientResult.idMap)
    // Re-leer los items actualizados del outbox (por si updateReferences
    // cambió payload.paciente_id)
    const refreshed = await getOutbox()
    notesToProcess = refreshed.filter(it => it.resource === 'note')
    documentsToProcess = refreshed.filter(it => it.resource === 'document')
  }

  // 3. Flush notes y documents en paralelo (cada grupo ordenado por peso)
  const [notesResult, docsResult, othersResult] = await Promise.all([
    processBatch(prioritizeByWeight(notesToProcess)),
    processBatch(prioritizeByWeight(documentsToProcess)),
    processBatch(prioritizeByWeight(others)),
  ])

  // 4. Guardar el estado resultante: solo los que siguen en retrying quedan pending
  // (los success y dead ya se removieron — los dead vía moveToDLQ, los success
  // se descartan porque no los incluimos en el nuevo array)
  const newOutbox = [
    ...patientResult.retrying,
    ...notesResult.retrying,
    ...docsResult.retrying,
    ...othersResult.retrying,
  ]
  await saveOutbox(newOutbox)

  return {
    synced:
      patientResult.synced + notesResult.synced + docsResult.synced + othersResult.synced,
    retrying: newOutbox.length,
    dead:
      patientResult.dead.length +
      notesResult.dead.length +
      docsResult.dead.length +
      othersResult.dead.length,
  }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública: Auto-sync
   ────────────────────────────────────────────────────────────────────── */

/**
 * Inicia sync periódico cada intervalMs. También engancha el evento online.
 * Retorna un cleanup function.
 */
export function startAutoSync(intervalMs = 30_000): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined

  // Limpiar datos expirados + correr migración
  secureStorage.cleanup()
  migrateLegacyQueues()

  // Flush inmediato al iniciar
  flushOutbox().catch(() => {})

  // Flush periódico
  const timer = setInterval(async () => {
    try {
      const stats = await getOutboxStats()
      if (isOnline() && stats.pending > 0) {
        await flushOutbox()
      }
    } catch {
      // silencioso
    }
  }, intervalMs)

  // Flush cuando regresa la conexión
  function onOnline() {
    getOutboxStats()
      .then(stats => {
        if (stats.pending > 0) return flushOutbox()
      })
      .catch(() => {})
  }
  window.addEventListener('online', onOnline)

  return () => {
    clearInterval(timer)
    window.removeEventListener('online', onOnline)
  }
}
