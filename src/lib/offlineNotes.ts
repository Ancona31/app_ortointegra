/**
 * Cola offline para notas clínicas (consultas).
 * Datos cifrados en secureStorage (AES-256-GCM).
 * LFPDPPP Art. 19: protección de datos personales sensibles en reposo.
 */

import { secureStorage } from '@/lib/secureStorage'
import { fetchWithRetry } from '@/lib/fetchWithRetry'
import { isOnline } from '@/lib/connectionMonitor'

const NOTES_QUEUE_KEY = 'offline_notes_queue'

export interface QueuedNote {
  id: string
  paciente_id: string
  payload: Record<string, unknown>
  created_at: string
  retries: number
}

async function getQueue(): Promise<QueuedNote[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<QueuedNote[]>(NOTES_QUEUE_KEY)
  return data ?? []
}

async function saveQueue(queue: QueuedNote[]): Promise<void> {
  if (queue.length === 0) {
    secureStorage.remove(NOTES_QUEUE_KEY)
  } else {
    await secureStorage.set(NOTES_QUEUE_KEY, queue)
  }
}

/** Guarda una nota clínica en la cola offline (cifrada) */
export async function saveNoteOffline(
  paciente_id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const queue = await getQueue()
  const id = crypto.randomUUID()
  queue.push({
    id,
    paciente_id,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  })
  await saveQueue(queue)
  return id
}

/** Devuelve la cantidad de notas pendientes */
export async function getPendingNotesCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

/** Devuelve las notas pendientes (para UI) */
export async function getPendingNotes(): Promise<QueuedNote[]> {
  return getQueue()
}

/** Sincroniza todas las notas pendientes con el servidor */
export async function syncPendingNotes(): Promise<{ sent: number; failed: number }> {
  const queue = await getQueue()
  if (queue.length === 0) return { sent: 0, failed: 0 }
  if (!isOnline()) return { sent: 0, failed: queue.length }

  let sent = 0
  const remaining: QueuedNote[] = []

  for (const note of queue) {
    try {
      const res = await fetchWithRetry('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: note.paciente_id, ...note.payload }),
        maxRetries: 2,
        timeoutMs: 10_000,
      })

      if (res.ok) {
        sent++
      } else {
        if (note.retries < 5) {
          remaining.push({ ...note, retries: note.retries + 1 })
        }
      }
    } catch {
      if (note.retries < 5) {
        remaining.push({ ...note, retries: note.retries + 1 })
      }
    }
  }

  await saveQueue(remaining)
  return { sent, failed: remaining.length }
}
