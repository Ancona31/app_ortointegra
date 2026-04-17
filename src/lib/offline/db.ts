/**
 * IndexedDB store para el módulo Offline-Mode.
 * Base de datos: spinus_offline_vault
 * Tablas: temp_patients, temp_documents
 *
 * AISLADO: cero imports de Supabase, AuthContext o componentes de (app).
 * Solo usa API nativa de IndexedDB con wrappers de promesas.
 */

import type { TempPatient, TempDocument, SyncStatus } from './types'

const DB_NAME = 'spinus_offline_vault'
const DB_VERSION = 1
const STORE_PATIENTS = 'temp_patients'
const STORE_DOCUMENTS = 'temp_documents'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_PATIENTS)) {
        const patients = db.createObjectStore(STORE_PATIENTS, { keyPath: 'id' })
        patients.createIndex('medico_id', 'medico_id', { unique: false })
        patients.createIndex('_syncStatus', '_syncStatus', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
        const docs = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' })
        docs.createIndex('temp_patient_id', 'temp_patient_id', { unique: false })
        docs.createIndex('medico_id', 'medico_id', { unique: false })
        docs.createIndex('_syncStatus', '_syncStatus', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txPromise<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const req = callback(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txGetAll<T>(
  db: IDBDatabase,
  storeName: string,
  indexName?: string,
  query?: IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const source = indexName ? store.index(indexName) : store
    const req = query !== undefined ? source.getAll(query) : source.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

/* ──────────────────────────────────────────────────────────────────────
   Pacientes
   ────────────────────────────────────────────────────────────────────── */

export async function addPatient(patient: TempPatient): Promise<void> {
  const db = await openDB()
  await txPromise(db, STORE_PATIENTS, 'readwrite', store => store.put(patient))
  db.close()
}

export async function getAllPatients(medicoId?: string): Promise<TempPatient[]> {
  const db = await openDB()
  const result = medicoId
    ? await txGetAll<TempPatient>(db, STORE_PATIENTS, 'medico_id', medicoId)
    : await txGetAll<TempPatient>(db, STORE_PATIENTS)
  db.close()
  return result.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getPendingPatients(medicoId?: string): Promise<TempPatient[]> {
  const all = await getAllPatients(medicoId)
  return all.filter(p => p._syncStatus === 'pending')
}

export async function updatePatientStatus(
  id: string,
  status: SyncStatus,
  extra?: { _realId?: string; _syncError?: string },
): Promise<void> {
  const db = await openDB()
  const patient = await txPromise<TempPatient>(db, STORE_PATIENTS, 'readonly', store => store.get(id))
  if (patient) {
    const updated = { ...patient, _syncStatus: status, ...extra }
    await txPromise(db, STORE_PATIENTS, 'readwrite', store => store.put(updated))
  }
  db.close()
}

/* ──────────────────────────────────────────────────────────────────────
   Documentos
   ────────────────────────────────────────────────────────────────────── */

export async function addDocument(doc: TempDocument): Promise<void> {
  const db = await openDB()
  await txPromise(db, STORE_DOCUMENTS, 'readwrite', store => store.put(doc))
  db.close()
}

export async function getAllDocuments(medicoId?: string): Promise<TempDocument[]> {
  const db = await openDB()
  const result = medicoId
    ? await txGetAll<TempDocument>(db, STORE_DOCUMENTS, 'medico_id', medicoId)
    : await txGetAll<TempDocument>(db, STORE_DOCUMENTS)
  db.close()
  return result.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getDocumentsByPatient(tempPatientId: string): Promise<TempDocument[]> {
  const db = await openDB()
  const result = await txGetAll<TempDocument>(db, STORE_DOCUMENTS, 'temp_patient_id', tempPatientId)
  db.close()
  return result
}

export async function getPendingDocuments(medicoId?: string): Promise<TempDocument[]> {
  const all = await getAllDocuments(medicoId)
  return all.filter(d => d._syncStatus === 'pending')
}

export async function updateDocumentStatus(
  id: string,
  status: SyncStatus,
  extra?: { _syncError?: string },
): Promise<void> {
  const db = await openDB()
  const doc = await txPromise<TempDocument>(db, STORE_DOCUMENTS, 'readonly', store => store.get(id))
  if (doc) {
    const updated = { ...doc, _syncStatus: status, ...extra }
    await txPromise(db, STORE_DOCUMENTS, 'readwrite', store => store.put(updated))
  }
  db.close()
}

/* ──────────────────────────────────────────────────────────────────────
   Estadísticas y limpieza
   ────────────────────────────────────────────────────────────────────── */

export async function getVaultStats(medicoId?: string): Promise<{
  patients: { pending: number; synced: number; error: number }
  documents: { pending: number; synced: number; error: number }
}> {
  const patients = await getAllPatients(medicoId)
  const documents = await getAllDocuments(medicoId)

  function count(items: Array<{ _syncStatus: SyncStatus }>) {
    return {
      pending: items.filter(i => i._syncStatus === 'pending').length,
      synced: items.filter(i => i._syncStatus === 'synced').length,
      error: items.filter(i => i._syncStatus === 'error').length,
    }
  }

  return { patients: count(patients), documents: count(documents) }
}

export async function clearSyncedRecords(): Promise<void> {
  const db = await openDB()

  const patients = await txGetAll<TempPatient>(db, STORE_PATIENTS)
  const syncedPatientIds = new Set(patients.filter(p => p._syncStatus === 'synced').map(p => p.id))

  const documents = await txGetAll<TempDocument>(db, STORE_DOCUMENTS)
  const syncedDocIds = documents.filter(d => d._syncStatus === 'synced').map(d => d.id)
  const orphanDocIds = documents.filter(d => syncedPatientIds.has(d.temp_patient_id) && d._syncStatus === 'synced').map(d => d.id)

  const allDocIdsToDelete = new Set([...syncedDocIds, ...orphanDocIds])

  for (const docId of allDocIdsToDelete) {
    await txPromise(db, STORE_DOCUMENTS, 'readwrite', store => store.delete(docId))
  }
  for (const patId of syncedPatientIds) {
    await txPromise(db, STORE_PATIENTS, 'readwrite', store => store.delete(patId))
  }

  db.close()
}

export async function clearAllVault(): Promise<void> {
  const db = await openDB()
  await txPromise(db, STORE_PATIENTS, 'readwrite', store => store.clear())
  await txPromise(db, STORE_DOCUMENTS, 'readwrite', store => store.clear())
  db.close()
}
