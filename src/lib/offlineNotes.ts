/**
 * offlineNotes.ts — Facade backward-compatible.
 *
 * Mantiene la API original de esta librería (saveNoteOffline,
 * getPendingNotes, getPendingNotesCount, syncPendingNotes) pero delega
 * al outbox-engine unificado del Commit 3.
 *
 * LFPDPPP Art. 19: datos cifrados en secureStorage (gestionado por engine).
 */

import {
  enqueueOutbox,
  getPendingOutbox,
  getOutboxStats,
  flushOutbox,
} from './outbox-engine'

export interface QueuedNote {
  id: string
  paciente_id: string
  payload: Record<string, unknown>
  created_at: string
  retries: number
}

/** Guarda una nota clínica offline. Retorna el id generado. */
export async function saveNoteOffline(
  paciente_id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const clientId = crypto.randomUUID()
  const id = await enqueueOutbox({
    clientId,
    action: 'INSERT',
    resource: 'note',
    payload,
    tempRef: paciente_id,
    endpoint: '/api/consultas',
    method: 'POST',
  })
  return id
}

/** Devuelve las notas pendientes con el shape legacy (para UI existente) */
export async function getPendingNotes(): Promise<QueuedNote[]> {
  const outbox = await getPendingOutbox()
  return outbox
    .filter(it => it.resource === 'note')
    .map(it => ({
      id: it.id,
      paciente_id: it.tempRef ?? '',
      payload: it.payload,
      created_at: it.createdAt,
      retries: it.retries,
    }))
}

/** Cantidad de notas pendientes */
export async function getPendingNotesCount(): Promise<number> {
  const stats = await getOutboxStats()
  return stats.byResource.note
}

/** Sincroniza todas las notas pendientes. Shape legacy del retorno. */
export async function syncPendingNotes(): Promise<{ sent: number; failed: number }> {
  const result = await flushOutbox()
  return { sent: result.synced, failed: result.dead }
}
