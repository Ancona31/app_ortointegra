/**
 * Read Mirror — Infraestructura de lectura offline-first
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Espejo local read-only de las 4 tablas críticas de Supabase:
 *   • pacientes
 *   • consultas
 *   • documentos
 *   • appointments
 *
 * Principios:
 *   1. READ-ONLY — la escritura SIEMPRE fluye por el outbox-engine.
 *      Este módulo jamás propone crear/editar/borrar en Supabase.
 *   2. Pull incremental por `updated_at > lastSyncAt` (fallback
 *      `start_time` en appointments si la columna no existe).
 *   3. LRU post-write + daily sweep con pressure check.
 *   4. Exemptions: pacientes con cita próxima (Smart Warm-up 48h)
 *      NO se evictan aunque sean los menos accesados.
 *   5. Invalidación por cambio de usuario: el `mirrorUserId` guardado
 *      en `_meta` debe coincidir con el userId de la sesión activa;
 *      si difiere, `clearMirror()` completo antes de cualquier sync.
 *
 * El perfil del médico NO vive aquí — ya está cacheado por
 * `useMedicoInfo` (secureStorage con key `cache_medico_info`).
 * Laboratorios fuera de scope del Hito 1.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@/lib/supabase/client'
import { getStorageQuota } from '@/lib/storage-vault'
import { getPatientOffline } from '@/lib/offlinePatients'

/* ──────────────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────────────── */

const DB_NAME = 'spinus_readmirror'
/**
 * v1 → v2 (Sprint 3 Hito 3.C): añade el store `laboratorios`.
 * Upgrade idempotente — los 4 stores existentes (pacientes, consultas,
 * documentos, appointments) y el store _meta se preservan íntegros.
 * Los datos sincronizados en Sprint 2 siguen accesibles.
 */
const DB_VERSION = 2

const STORE_PACIENTES    = 'pacientes'    as const
const STORE_CONSULTAS    = 'consultas'    as const
const STORE_DOCUMENTOS   = 'documentos'   as const
const STORE_APPOINTMENTS = 'appointments' as const
const STORE_LABORATORIOS = 'laboratorios' as const
const STORE_META         = '_meta'        as const

const CAPS: Record<MirrorDataStore, number> = {
  pacientes:    200,
  consultas:    600,
  documentos:   600,
  appointments: 400,
  laboratorios: 400,
}

const TTL_SOFT_MS                = 30 * 24 * 3600 * 1000 // 30 días sin acceso
const SWEEP_INTERVAL_MS          = 24 * 3600 * 1000      // 24h entre daily sweeps
const STORAGE_PRESSURE_THRESHOLD = 0.85                  // 85% de quota usado
const WARMUP_WINDOW_MS           = 48 * 3600 * 1000      // 48h para Smart Warm-up
const HYDRATE_LIMIT              = 30                    // consultas/documentos por paciente hidratado
const WARMUP_DELAY_MS            = 150                   // espaciado entre hidrataciones (no saturar red)

/* ──────────────────────────────────────────────────────────────────────
   Tipos públicos
   ────────────────────────────────────────────────────────────────────── */

export type MirrorDataStore =
  | 'pacientes'
  | 'consultas'
  | 'documentos'
  | 'appointments'
  | 'laboratorios'

/** Metadata que el mirror añade a cada registro — NO viene de Supabase */
interface MirrorMetadata {
  _localFetchedAt: number
  _lastAccessedAt: number
  _exemptUntil: number | null
}

export interface PacienteLocal extends MirrorMetadata {
  id: string
  nombre: string
  apellidos: string | null
  fecha_nacimiento: string | null
  sexo: string | null
  numero_expediente: string | null
  clinica_id: string
  activo: boolean | null
  created_at: string
  updated_at: string
  [k: string]: unknown
}

export interface ConsultaLocal extends MirrorMetadata {
  id: string
  paciente_id: string
  fecha: string
  motivo_consulta: string | null
  exploracion_fisica: string | null
  diagnosticos: unknown
  plan_tratamiento: string | null
  notas_evolucion: string | null
  proxima_cita: string | null
  medicamentos: unknown
  nota_origen: 'ia' | 'manual' | null
  medico_nombre: string | null
  medico_especialidad: string | null
  medico_cedula_profesional: string | null
  medico_cedula_especialidad: string | null
  medico_logo_url: string | null
  created_at: string
  updated_at: string
  [k: string]: unknown
}

export interface DocumentoLocal extends MirrorMetadata {
  id: string
  paciente_id: string | null
  tipo: string
  contenido: unknown
  client_id: string | null
  created_at: string
  updated_at: string
  [k: string]: unknown
}

export interface AppointmentLocal extends MirrorMetadata {
  id: string
  paciente_id: string
  medico_id: string | null
  clinica_id: string
  title: string | null
  start_time: string
  end_time: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  [k: string]: unknown
}

/**
 * Laboratorios (Sprint 3 Hito 3.C).
 * El field `resultados` es un array de ResultadoLab con estructura
 * {nombre, valor, unidad, rango_ref, rango_optimo, estado}. Lo
 * dejamos como `unknown` para no acoplar el mirror al tipo específico
 * de la UI — el consumidor casea al tipo del proyecto al leer.
 */
export interface LaboratorioLocal extends MirrorMetadata {
  id: string
  paciente_id: string
  fecha_toma: string
  resultados: unknown
  created_at: string
  updated_at: string
  [k: string]: unknown
}

export interface SyncResult {
  store: MirrorDataStore
  synced: number
  error: string | null
  durationMs: number
}

export interface HydrateResult {
  pacienteOk: boolean
  consultas: number
  documentos: number
  laboratorios: number
}

export interface MirrorStats {
  pacientes: number
  consultas: number
  documentos: number
  appointments: number
  laboratorios: number
  lastSyncAt: Record<MirrorDataStore, string | null>
  lastSweepAt: string | null
  mirrorUserId: string | null
}

/* ──────────────────────────────────────────────────────────────────────
   Estado del módulo
   ────────────────────────────────────────────────────────────────────── */

let dbPromise: Promise<IDBDatabase> | null = null

/** Forma cruda de un registro antes de estampar metadata */
interface RawRecord {
  id: string
  [k: string]: unknown
}

/** Forma almacenada en IDB: record crudo + metadata opcional durante lecturas */
type StoredRecord = RawRecord & Partial<MirrorMetadata>

/* ──────────────────────────────────────────────────────────────────────
   Apertura de la DB con upgrade handler
   ────────────────────────────────────────────────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no disponible (SSR o entorno sin soporte)'))
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(STORE_PACIENTES)) {
        const s = db.createObjectStore(STORE_PACIENTES, { keyPath: 'id' })
        s.createIndex('by_clinica', 'clinica_id')
        s.createIndex('by_updated', 'updated_at')
        s.createIndex('by_last_accessed', '_lastAccessedAt')
      }

      if (!db.objectStoreNames.contains(STORE_CONSULTAS)) {
        const s = db.createObjectStore(STORE_CONSULTAS, { keyPath: 'id' })
        s.createIndex('by_paciente', 'paciente_id')
        s.createIndex('by_paciente_fecha', ['paciente_id', 'fecha'])
        s.createIndex('by_updated', 'updated_at')
        s.createIndex('by_last_accessed', '_lastAccessedAt')
      }

      if (!db.objectStoreNames.contains(STORE_DOCUMENTOS)) {
        const s = db.createObjectStore(STORE_DOCUMENTOS, { keyPath: 'id' })
        s.createIndex('by_paciente', 'paciente_id')
        s.createIndex('by_paciente_fecha', ['paciente_id', 'created_at'])
        s.createIndex('by_tipo', 'tipo')
        s.createIndex('by_updated', 'updated_at')
        s.createIndex('by_last_accessed', '_lastAccessedAt')
      }

      if (!db.objectStoreNames.contains(STORE_APPOINTMENTS)) {
        const s = db.createObjectStore(STORE_APPOINTMENTS, { keyPath: 'id' })
        s.createIndex('by_start_time', 'start_time')
        s.createIndex('by_paciente', 'paciente_id')
        s.createIndex('by_last_accessed', '_lastAccessedAt')
      }

      // v1 → v2 (Sprint 3 Hito 3.C): laboratorios
      // Idempotente: solo crea si no existe. Los 4 stores anteriores
      // se preservan intactos con todos sus datos sincronizados.
      if (!db.objectStoreNames.contains(STORE_LABORATORIOS)) {
        const s = db.createObjectStore(STORE_LABORATORIOS, { keyPath: 'id' })
        s.createIndex('by_paciente', 'paciente_id')
        s.createIndex('by_paciente_fecha', ['paciente_id', 'fecha_toma'])
        s.createIndex('by_updated', 'updated_at')
        s.createIndex('by_last_accessed', '_lastAccessedAt')
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB open error'))
    req.onblocked = () => reject(new Error('IDB open blocked por otra conexión'))
  })

  return dbPromise
}

/* ──────────────────────────────────────────────────────────────────────
   Helpers de bajo nivel — promisificación de IDB
   ────────────────────────────────────────────────────────────────────── */

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB request error'))
  })
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx error'))
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'))
  })
}

/* ──────────────────────────────────────────────────────────────────────
   Meta helpers
   ────────────────────────────────────────────────────────────────────── */

async function getMeta(key: string): Promise<unknown> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_META, 'readonly')
    const row = await promisifyRequest(
      tx.objectStore(STORE_META).get(key),
    ) as { key: string; value: unknown } | undefined
    return row ? row.value : null
  } catch {
    return null
  }
}

async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_META, 'readwrite')
    tx.objectStore(STORE_META).put({ key, value })
    await promisifyTx(tx)
  } catch {
    // silent — meta es best-effort
  }
}

async function getMetaString(key: string): Promise<string | null> {
  const v = await getMeta(key)
  return typeof v === 'string' ? v : null
}

/* ──────────────────────────────────────────────────────────────────────
   Record helpers (internos)
   ────────────────────────────────────────────────────────────────────── */

async function putRecord(storeName: MirrorDataStore, raw: RawRecord): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  const existing = await promisifyRequest(
    store.get(raw.id),
  ) as StoredRecord | undefined
  const now = Date.now()
  const stamped: StoredRecord = {
    ...raw,
    _localFetchedAt: now,
    _lastAccessedAt: existing?._lastAccessedAt ?? now,
    _exemptUntil: existing?._exemptUntil ?? null,
  }
  store.put(stamped)
  await promisifyTx(tx)
}

async function touchAccessed(storeName: MirrorDataStore, id: string): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const existing = await promisifyRequest(
      store.get(id),
    ) as StoredRecord | undefined
    if (existing) {
      existing._lastAccessedAt = Date.now()
      store.put(existing)
    }
    await promisifyTx(tx)
  } catch {
    // silent — touch es best-effort, no debe bloquear lecturas
  }
}

async function markExempt(
  storeName: MirrorDataStore,
  id: string,
  until: number,
): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const existing = await promisifyRequest(
      store.get(id),
    ) as StoredRecord | undefined
    if (existing) {
      existing._exemptUntil = until
      store.put(existing)
    }
    await promisifyTx(tx)
  } catch {
    // silent
  }
}

async function countStore(storeName: MirrorDataStore): Promise<number> {
  try {
    const db = await openDb()
    const tx = db.transaction(storeName, 'readonly')
    return await promisifyRequest(tx.objectStore(storeName).count())
  } catch {
    return 0
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Eviction — LRU post-write + daily sweep con pressure check
   ────────────────────────────────────────────────────────────────────── */

async function evictIfNeeded(storeName: MirrorDataStore, cap: number): Promise<number> {
  try {
    const total = await countStore(storeName)
    if (total <= cap) return 0
    const excess = total - cap

    const db = await openDb()
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const index = store.index('by_last_accessed')
    const now = Date.now()

    return await new Promise<number>((resolve, reject) => {
      let evicted = 0
      const cursorReq = index.openCursor()
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('cursor error'))
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor || evicted >= excess) {
          resolve(evicted)
          return
        }
        const record = cursor.value as StoredRecord
        const exemptUntil = record._exemptUntil ?? null
        if (exemptUntil !== null && exemptUntil > now) {
          // Exempt — saltar sin borrar
          cursor.continue()
          return
        }
        cursor.delete()
        evicted++
        cursor.continue()
      }
    })
  } catch {
    return 0
  }
}

async function dailySweep(): Promise<void> {
  const lastSweep = await getMetaString('lastSweepAt')
  const lastSweepTime = lastSweep ? new Date(lastSweep).getTime() : 0
  if (Date.now() - lastSweepTime < SWEEP_INTERVAL_MS) return

  // Storage pressure check — reduce caps a la mitad si > 85% usado
  let effectiveCaps: Record<MirrorDataStore, number> = { ...CAPS }
  try {
    const quota = await getStorageQuota()
    if (quota && quota.totalQuota > 0 && quota.percentUsed / 100 > STORAGE_PRESSURE_THRESHOLD) {
      effectiveCaps = {
        pacientes:    Math.floor(CAPS.pacientes / 2),
        consultas:    Math.floor(CAPS.consultas / 2),
        documentos:   Math.floor(CAPS.documentos / 2),
        appointments: Math.floor(CAPS.appointments / 2),
        laboratorios: Math.floor(CAPS.laboratorios / 2),
      }
    }
  } catch {
    // silent
  }

  // Soft TTL sweep: borrar registros sin acceso desde hace > 30 días (respetando exempt)
  const cutoff = Date.now() - TTL_SOFT_MS
  const stores: MirrorDataStore[] = ['pacientes', 'consultas', 'documentos', 'appointments', 'laboratorios']

  for (const storeName of stores) {
    try {
      const db = await openDb()
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const index = store.index('by_last_accessed')
      const range = IDBKeyRange.upperBound(cutoff, true)

      await new Promise<void>((resolve, reject) => {
        const cursorReq = index.openCursor(range)
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error('sweep cursor'))
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) { resolve(); return }
          const rec = cursor.value as StoredRecord
          const exempt = rec._exemptUntil ?? null
          const isExempt = exempt !== null && exempt > Date.now()
          if (!isExempt) cursor.delete()
          cursor.continue()
        }
      })
    } catch {
      // silent per store — un store fallido no debe bloquear el sweep global
    }
    // Enforce cap también como segunda línea
    await evictIfNeeded(storeName, effectiveCaps[storeName])
  }

  await setMeta('lastSweepAt', new Date().toISOString())
}

/* ──────────────────────────────────────────────────────────────────────
   Sync engine — pull incremental con fallback para appointments
   ────────────────────────────────────────────────────────────────────── */

/**
 * Detecta si el error de Supabase indica columna faltante (código
 * Postgres 42703 "undefined_column") o menciona la columna específica
 * en el mensaje. Usado para fallback de `updated_at` → `start_time`
 * en appointments y `updated_at` → `fecha_toma` en laboratorios.
 */
function isUpdatedAtColumnError(
  err: { code?: string; message?: string } | null,
): boolean {
  if (!err) return false
  if (err.code === '42703') return true
  const msg = (err.message ?? '').toLowerCase()
  return msg.includes('updated_at') || msg.includes('column')
}

async function syncStoreInternal(storeName: MirrorDataStore): Promise<SyncResult> {
  const started = Date.now()
  const supabase = createClient()
  const lastSync = await getLastSyncAt(storeName)

  let rows: RawRecord[] = []
  let errorMsg: string | null = null

  try {
    if (storeName === 'appointments') {
      // ── Appointments: intenta updated_at, fallback a start_time ──
      if (lastSync) {
        const first = await supabase
          .from('appointments')
          .select('*')
          .gt('updated_at', lastSync)
          .order('updated_at', { ascending: true })

        if (first.error) {
          if (isUpdatedAtColumnError(first.error)) {
            // Fallback: start_time como proxy temporal
            const second = await supabase
              .from('appointments')
              .select('*')
              .gte('start_time', lastSync)
              .order('start_time', { ascending: true })
            if (second.error) throw new Error(second.error.message)
            rows = (second.data ?? []) as RawRecord[]
          } else {
            throw new Error(first.error.message)
          }
        } else {
          rows = (first.data ?? []) as RawRecord[]
        }
      } else {
        // Primer sync: trae las últimas CAPS por start_time DESC
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .order('start_time', { ascending: false })
          .limit(CAPS.appointments)
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      }
    } else if (storeName === 'laboratorios') {
      // ── Laboratorios: intenta updated_at, fallback a fecha_toma ──
      if (lastSync) {
        const first = await supabase
          .from('laboratorios')
          .select('*')
          .gt('updated_at', lastSync)
          .order('updated_at', { ascending: true })

        if (first.error) {
          if (isUpdatedAtColumnError(first.error)) {
            // Fallback: fecha_toma como proxy temporal
            const second = await supabase
              .from('laboratorios')
              .select('*')
              .gte('fecha_toma', lastSync)
              .order('fecha_toma', { ascending: true })
            if (second.error) throw new Error(second.error.message)
            rows = (second.data ?? []) as RawRecord[]
          } else {
            throw new Error(first.error.message)
          }
        } else {
          rows = (first.data ?? []) as RawRecord[]
        }
      } else {
        // Primer sync: trae los últimos CAPS por fecha_toma DESC
        const { data, error } = await supabase
          .from('laboratorios')
          .select('*')
          .order('fecha_toma', { ascending: false })
          .limit(CAPS.laboratorios)
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      }
    } else if (storeName === 'consultas') {
      // ── Consultas: intenta updated_at, fallback a fecha ──
      // (consultas tiene `fecha` que es la fecha de la consulta clínica)
      if (lastSync) {
        const first = await supabase
          .from('consultas')
          .select('*')
          .gt('updated_at', lastSync)
          .order('updated_at', { ascending: true })

        if (first.error) {
          if (isUpdatedAtColumnError(first.error)) {
            const second = await supabase
              .from('consultas')
              .select('*')
              .gte('fecha', lastSync)
              .order('fecha', { ascending: true })
            if (second.error) throw new Error(second.error.message)
            rows = (second.data ?? []) as RawRecord[]
          } else {
            throw new Error(first.error.message)
          }
        } else {
          rows = (first.data ?? []) as RawRecord[]
        }
      } else {
        // Primer pull: fecha DESC limitado a CAPS
        const { data, error } = await supabase
          .from('consultas')
          .select('*')
          .order('fecha', { ascending: false })
          .limit(CAPS.consultas)
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      }
    } else if (storeName === 'documentos') {
      // ── Documentos: intenta updated_at, fallback a created_at ──
      // (documentos no tiene fecha clínica, usa created_at como proxy)
      if (lastSync) {
        const first = await supabase
          .from('documentos')
          .select('*')
          .gt('updated_at', lastSync)
          .order('updated_at', { ascending: true })

        if (first.error) {
          if (isUpdatedAtColumnError(first.error)) {
            const second = await supabase
              .from('documentos')
              .select('*')
              .gte('created_at', lastSync)
              .order('created_at', { ascending: true })
            if (second.error) throw new Error(second.error.message)
            rows = (second.data ?? []) as RawRecord[]
          } else {
            throw new Error(first.error.message)
          }
        } else {
          rows = (first.data ?? []) as RawRecord[]
        }
      } else {
        // Primer pull: created_at DESC limitado a CAPS
        const { data, error } = await supabase
          .from('documentos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(CAPS.documentos)
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      }
    } else {
      // ── Tabla con updated_at garantizado: pacientes ──
      const base = supabase.from(storeName).select('*')
      if (lastSync) {
        const { data, error } = await base
          .gt('updated_at', lastSync)
          .order('updated_at', { ascending: true })
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      } else {
        const { data, error } = await base
          .order('updated_at', { ascending: false })
          .limit(CAPS[storeName])
        if (error) throw new Error(error.message)
        rows = (data ?? []) as RawRecord[]
      }
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'unknown sync error'
  }

  if (errorMsg) {
    return { store: storeName, synced: 0, error: errorMsg, durationMs: Date.now() - started }
  }

  // Persistir rows (individual try/catch — una falla no bloquea las demás)
  for (const row of rows) {
    try {
      await putRecord(storeName, row)
    } catch {
      // silent por registro
    }
  }

  await setMeta(`lastSyncAt:${storeName}`, new Date().toISOString())

  // Eviction lazy post-write
  queueMicrotask(() => { void evictIfNeeded(storeName, CAPS[storeName]) })

  return { store: storeName, synced: rows.length, error: null, durationMs: Date.now() - started }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Sync
   ────────────────────────────────────────────────────────────────────── */

export async function syncStore(storeName: MirrorDataStore): Promise<SyncResult> {
  return syncStoreInternal(storeName)
}

export async function syncAllStores(): Promise<Record<MirrorDataStore, SyncResult>> {
  const [pacientes, consultas, documentos, appointments, laboratorios] = await Promise.all([
    syncStoreInternal('pacientes'),
    syncStoreInternal('consultas'),
    syncStoreInternal('documentos'),
    syncStoreInternal('appointments'),
    syncStoreInternal('laboratorios'),
  ])
  return { pacientes, consultas, documentos, appointments, laboratorios }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Hidratación profunda de un paciente
   ────────────────────────────────────────────────────────────────────── */

export async function hydratePaciente(pacienteId: string): Promise<HydrateResult> {
  const supabase = createClient()
  const result: HydrateResult = {
    pacienteOk: false,
    consultas: 0,
    documentos: 0,
    laboratorios: 0,
  }

  // 1. Paciente
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', pacienteId)
      .single()
    if (!error && data) {
      await putRecord('pacientes', data as RawRecord)
      result.pacienteOk = true
    }
  } catch {
    // silent
  }

  // 2. Consultas recientes
  try {
    const { data, error } = await supabase
      .from('consultas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })
      .limit(HYDRATE_LIMIT)
    if (!error && data) {
      for (const row of data) {
        try { await putRecord('consultas', row as RawRecord) } catch {}
      }
      result.consultas = data.length
    }
  } catch {
    // silent
  }

  // 3. Documentos recientes
  try {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(HYDRATE_LIMIT)
    if (!error && data) {
      for (const row of data) {
        try { await putRecord('documentos', row as RawRecord) } catch {}
      }
      result.documentos = data.length
    }
  } catch {
    // silent
  }

  // 4. Laboratorios recientes (Sprint 3 Hito 3.C)
  try {
    const { data, error } = await supabase
      .from('laboratorios')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_toma', { ascending: false })
      .limit(HYDRATE_LIMIT)
    if (!error && data) {
      for (const row of data) {
        try { await putRecord('laboratorios', row as RawRecord) } catch {}
      }
      result.laboratorios = data.length
    }
  } catch {
    // silent
  }

  return result
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Smart Warm-up (48h)
   ────────────────────────────────────────────────────────────────────── */

export async function smartWarmup(): Promise<{ pacientesHidratados: number }> {
  const supabase = createClient()
  const now = new Date()
  const in48h = new Date(now.getTime() + WARMUP_WINDOW_MS)

  let pacienteIds: string[] = []
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('paciente_id, start_time')
      .gte('start_time', now.toISOString())
      .lte('start_time', in48h.toISOString())
      .order('start_time', { ascending: true })

    if (error || !data) return { pacientesHidratados: 0 }

    const seen = new Set<string>()
    for (const row of data as { paciente_id: string | null }[]) {
      if (row.paciente_id && !seen.has(row.paciente_id)) {
        seen.add(row.paciente_id)
        pacienteIds.push(row.paciente_id)
      }
    }
  } catch {
    return { pacientesHidratados: 0 }
  }

  const exemptUntil = in48h.getTime()
  let count = 0

  for (const id of pacienteIds) {
    try {
      const hydrated = await hydratePaciente(id)
      if (hydrated.pacienteOk) {
        await markExempt('pacientes', id, exemptUntil)
        count++
      }
    } catch {
      // silent — un paciente fallido no bloquea los demás
    }
    // Espaciado leve para no saturar red en sesiones móviles
    await new Promise(r => setTimeout(r, WARMUP_DELAY_MS))
  }

  return { pacientesHidratados: count }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Lifecycle
   ────────────────────────────────────────────────────────────────────── */

/**
 * Arranca el engine: verifica mirrorUserId, corre daily sweep, lanza
 * syncAllStores + smartWarmup de forma NO-bloqueante (el caller recibe
 * control tan pronto como las validaciones críticas terminan).
 *
 * Regla de seguridad: si el `mirrorUserId` guardado difiere del userId
 * pasado → `clearMirror()` completo antes de cualquier sync. Cero fuga
 * de datos entre médicos en el mismo dispositivo.
 */
export async function startMirrorEngine(userId: string): Promise<void> {
  if (!userId) throw new Error('startMirrorEngine requiere userId')
  if (typeof window === 'undefined') return

  // Asegurar DB abierta (esto también dispara el upgrade si es necesario)
  await openDb()

  // Invalidación por cambio de usuario
  const stored = await getMetaString('mirrorUserId')
  if (stored && stored !== userId) {
    await clearMirror()
  }
  await setMeta('mirrorUserId', userId)

  // Daily sweep no-bloqueante
  void dailySweep()

  // Sync inicial + warm-up no-bloqueante — el caller no debe esperar
  void syncAllStores()
    .then(() => { void smartWarmup() })
    .catch(() => { /* silent — errores ya se reportan en SyncResult */ })
}

export async function stopMirrorEngine(): Promise<void> {
  if (!dbPromise) return
  try {
    const db = await dbPromise
    db.close()
  } catch {
    // silent
  }
  dbPromise = null
}

/**
 * Borra todos los registros de los 4 stores de datos. Preserva
 * `_meta.version` pero limpia `lastSyncAt:*` y `lastSweepAt`.
 * NO preserva `mirrorUserId` — lo resetea el caller tras llamar.
 */
export async function clearMirror(): Promise<void> {
  try {
    const db = await openDb()
    const dataStores: MirrorDataStore[] = [
      'pacientes',
      'consultas',
      'documentos',
      'appointments',
      'laboratorios',
    ]
    const tx = db.transaction(dataStores, 'readwrite')
    for (const s of dataStores) {
      tx.objectStore(s).clear()
    }
    await promisifyTx(tx)

    // Limpiar marcadores de sync
    await setMeta('lastSyncAt:pacientes', null)
    await setMeta('lastSyncAt:consultas', null)
    await setMeta('lastSyncAt:documentos', null)
    await setMeta('lastSyncAt:appointments', null)
    await setMeta('lastSyncAt:laboratorios', null)
    await setMeta('lastSweepAt', null)
  } catch {
    // silent
  }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Lectura (read-only)
   ────────────────────────────────────────────────────────────────────── */

/**
 * Lista de pacientes local. Por default filtra `activo !== false`
 * para coincidir con el comportamiento de la página /pacientes.
 * NO actualiza `_lastAccessedAt` (lista == señal débil de acceso).
 */
export async function getPacientesLocal(opts?: {
  activosOnly?: boolean
  search?: string
  limit?: number
}): Promise<PacienteLocal[]> {
  const { activosOnly = true, search, limit } = opts ?? {}
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_PACIENTES, 'readonly')
    const all = await promisifyRequest(
      tx.objectStore(STORE_PACIENTES).getAll(),
    ) as PacienteLocal[]

    let filtered = all
    if (activosOnly) {
      filtered = filtered.filter(p => p.activo !== false)
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.apellidos?.toLowerCase().includes(q) ?? false) ||
        (p.numero_expediente?.toLowerCase().includes(q) ?? false),
      )
    }
    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return limit ? filtered.slice(0, limit) : filtered
  } catch {
    return []
  }
}

/**
 * Detalle de 1 paciente. Toca `_lastAccessedAt` (señal fuerte de uso).
 *
 * Sprint 3 Hotfix — Si el mirror no tiene el paciente, hace fallback
 * al legacy cache `offline_patients_cache` (offlinePatients.ts). Esto
 * cubre el caso crítico de pacientes creados offline con tempId que
 * aún no se sincronizaron a Supabase: `nuevo/page.tsx` guarda en el
 * legacy cache + outbox, y `router.push('/expediente/tempId')`
 * antes rompía con "Paciente no encontrado" porque el mirror no
 * conocía el tempId.
 *
 * El mirror sigue siendo read-only — esta lectura no escribe nada.
 */
export async function getPacienteLocal(id: string): Promise<PacienteLocal | null> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_PACIENTES, 'readonly')
    const rec = await promisifyRequest(
      tx.objectStore(STORE_PACIENTES).get(id),
    ) as PacienteLocal | undefined
    if (rec) {
      void touchAccessed('pacientes', id) // fire-and-forget
      return rec
    }

    // Fallback al legacy cache — pacientes creados offline con tempId
    return await readPacienteFromLegacyCache(id)
  } catch {
    // Si el mirror falla por completo, intentar legacy cache como último recurso
    try {
      return await readPacienteFromLegacyCache(id)
    } catch {
      return null
    }
  }
}

/**
 * Lee un paciente del legacy cache de `offlinePatients.ts` y normaliza
 * su shape al `PacienteLocal` esperado por los consumidores.
 *
 * Campos no disponibles en el legacy cache se rellenan con defaults
 * sanos:
 *   - `clinica_id`: string vacío (los consumidores actuales no lo usan
 *     para filtrar, solo lo pasan a componentes de presentación)
 *   - `activo`: true (los pacientes eliminados no entran al legacy cache)
 *   - `created_at` / `updated_at`: timestamp actual (aproximación — el
 *     real lo tendrá tras sincronizar y re-popular el mirror)
 *   - Metadata: _localFetchedAt = ahora, _lastAccessedAt = ahora,
 *     _exemptUntil = null
 */
async function readPacienteFromLegacyCache(id: string): Promise<PacienteLocal | null> {
  try {
    const cached = await getPatientOffline(id)
    if (!cached) return null
    const now = Date.now()
    const isoNow = new Date().toISOString()
    return {
      id: cached.id,
      nombre: cached.nombre,
      apellidos: cached.apellidos,
      fecha_nacimiento: cached.fecha_nacimiento ?? null,
      sexo: cached.sexo ?? null,
      numero_expediente: cached.numero_expediente ?? null,
      clinica_id: '',
      activo: true,
      created_at: isoNow,
      updated_at: isoNow,
      _localFetchedAt: now,
      _lastAccessedAt: now,
      _exemptUntil: null,
    } as PacienteLocal
  } catch {
    return null
  }
}

/**
 * Consultas de un paciente, ordenadas DESC por `fecha`.
 * Toca `_lastAccessedAt` del paciente (ver consultas == ver expediente).
 */
export async function getConsultasLocal(
  pacienteId: string,
  limit?: number,
): Promise<ConsultaLocal[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_CONSULTAS, 'readonly')
    const index = tx.objectStore(STORE_CONSULTAS).index('by_paciente')
    const rows = await promisifyRequest(
      index.getAll(IDBKeyRange.only(pacienteId)),
    ) as ConsultaLocal[]
    rows.sort((a, b) => {
      const fa = a.fecha || a.created_at || ''
      const fb = b.fecha || b.created_at || ''
      return fb.localeCompare(fa)
    })
    void touchAccessed('pacientes', pacienteId)
    return limit ? rows.slice(0, limit) : rows
  } catch {
    return []
  }
}

/**
 * Documentos de un paciente, ordenados DESC por `created_at`.
 * Toca `_lastAccessedAt` del paciente.
 */
export async function getDocumentosLocal(
  pacienteId: string,
  limit?: number,
): Promise<DocumentoLocal[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_DOCUMENTOS, 'readonly')
    const index = tx.objectStore(STORE_DOCUMENTOS).index('by_paciente')
    const rows = await promisifyRequest(
      index.getAll(IDBKeyRange.only(pacienteId)),
    ) as DocumentoLocal[]
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    void touchAccessed('pacientes', pacienteId)
    return limit ? rows.slice(0, limit) : rows
  } catch {
    return []
  }
}

/**
 * Laboratorios de un paciente, ordenados DESC por `fecha_toma`.
 * Toca `_lastAccessedAt` del paciente (ver labs == ver expediente).
 *
 * Sprint 3 Hito 3.C — infraestructura disponible. El consumo desde
 * TabLaboratorios vía useHybridQuery es un hito posterior.
 */
export async function getLaboratoriosLocal(
  pacienteId: string,
  limit?: number,
): Promise<LaboratorioLocal[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_LABORATORIOS, 'readonly')
    const index = tx.objectStore(STORE_LABORATORIOS).index('by_paciente')
    const rows = await promisifyRequest(
      index.getAll(IDBKeyRange.only(pacienteId)),
    ) as LaboratorioLocal[]
    rows.sort((a, b) => (b.fecha_toma || '').localeCompare(a.fecha_toma || ''))
    void touchAccessed('pacientes', pacienteId)
    return limit ? rows.slice(0, limit) : rows
  } catch {
    return []
  }
}

/** Citas en un rango de tiempo, ordenadas ASC por `start_time`. */
export async function getAppointmentsLocal(range: {
  from: Date
  to: Date
}): Promise<AppointmentLocal[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_APPOINTMENTS, 'readonly')
    const index = tx.objectStore(STORE_APPOINTMENTS).index('by_start_time')
    const idbRange = IDBKeyRange.bound(range.from.toISOString(), range.to.toISOString())
    const rows = await promisifyRequest(
      index.getAll(idbRange),
    ) as AppointmentLocal[]
    rows.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    return rows
  } catch {
    return []
  }
}

/* ──────────────────────────────────────────────────────────────────────
   API pública — Meta
   ────────────────────────────────────────────────────────────────────── */

export async function getLastSyncAt(storeName: MirrorDataStore): Promise<string | null> {
  return getMetaString(`lastSyncAt:${storeName}`)
}

export async function getMirrorStats(): Promise<MirrorStats> {
  const [p, c, d, a, lab, lp, lc, ld, la, llab, ls, uid] = await Promise.all([
    countStore('pacientes'),
    countStore('consultas'),
    countStore('documentos'),
    countStore('appointments'),
    countStore('laboratorios'),
    getLastSyncAt('pacientes'),
    getLastSyncAt('consultas'),
    getLastSyncAt('documentos'),
    getLastSyncAt('appointments'),
    getLastSyncAt('laboratorios'),
    getMetaString('lastSweepAt'),
    getMetaString('mirrorUserId'),
  ])
  return {
    pacientes:    p,
    consultas:    c,
    documentos:   d,
    appointments: a,
    laboratorios: lab,
    lastSyncAt: {
      pacientes:    lp,
      consultas:    lc,
      documentos:   ld,
      appointments: la,
      laboratorios: llab,
    },
    lastSweepAt:  ls,
    mirrorUserId: uid,
  }
}
