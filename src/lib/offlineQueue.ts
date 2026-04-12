/**
 * offlineQueue.ts — Facade backward-compatible.
 *
 * Las funciones exportadas por este módulo mantienen la misma API que
 * tenían antes del refactor del Commit 3, pero internamente delegan al
 * outbox-engine unificado. Esto evita tocar los 8 formularios y los
 * componentes que lo consumen (ConnectionBanner, OfflineSync, nueva-nota).
 *
 * LFPDPPP Art. 19: datos cifrados vía secureStorage (AES-256-GCM) —
 * gestionado por outbox-engine.
 */

import {
  enqueueOutbox,
  flushOutbox,
  getOutboxStats,
  startAutoSync as engineStartAutoSync,
} from './outbox-engine'

/** Agrega un documento a la cola offline. Idempotente vía client_id. */
export async function enqueue(doc: {
  client_id?: string
  paciente_id?: string
  tipo: string
  contenido: Record<string, unknown>
}): Promise<void> {
  const clientId = doc.client_id ?? crypto.randomUUID()
  await enqueueOutbox({
    clientId,
    action: 'INSERT',
    resource: 'document',
    subtype: doc.tipo,
    payload: doc.contenido,
    tempRef: doc.paciente_id,
    endpoint: '/api/documentos',
    method: 'POST',
  })
}

/** Cantidad de documentos pendientes en la outbox */
export async function pendingCount(): Promise<number> {
  const stats = await getOutboxStats()
  return stats.byResource.document
}

/** Intenta enviar todos los documentos pendientes a Supabase */
export async function flush(): Promise<{ sent: number; failed: number }> {
  const result = await flushOutbox()
  // El facade no distingue entre retrying y dead — retorna dead como failed
  return { sent: result.synced, failed: result.dead }
}

/** Inicia el proceso de sincronización automática */
export const startAutoSync = engineStartAutoSync
