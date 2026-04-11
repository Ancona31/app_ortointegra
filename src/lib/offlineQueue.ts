/**
 * Cola offline para documentos médicos.
 * Los datos se cifran en localStorage vía secureStorage (AES-256-GCM).
 * LFPDPPP Art. 19: protección de datos personales sensibles en reposo.
 */

import { createClient } from '@/lib/supabase/client'
import { secureStorage } from '@/lib/secureStorage'
import { isOnline } from '@/lib/connectionMonitor'

const QUEUE_KEY = 'offline_queue'

type QueuedDocument = {
  id: string
  paciente_id?: string
  tipo: string
  contenido: Record<string, unknown>
  created_at: string
  retries: number
}

async function getQueue(): Promise<QueuedDocument[]> {
  if (typeof window === 'undefined') return []
  const data = await secureStorage.get<QueuedDocument[]>(QUEUE_KEY)
  return data ?? []
}

async function saveQueue(queue: QueuedDocument[]): Promise<void> {
  if (queue.length === 0) {
    secureStorage.remove(QUEUE_KEY)
  } else {
    await secureStorage.set(QUEUE_KEY, queue)
  }
}

/** Agrega un documento a la cola offline (cifrado).
 *  Acepta client_id opcional para idempotencia — si ya existe, no duplica. */
export async function enqueue(doc: Omit<QueuedDocument, 'id' | 'created_at' | 'retries'> & { client_id?: string }): Promise<void> {
  const queue = await getQueue()
  const clientId = doc.client_id ?? crypto.randomUUID()

  // Idempotencia: no duplicar si ya existe un doc con el mismo client_id
  if (queue.some(q => q.id === clientId)) return

  const { client_id: _, ...rest } = doc
  queue.push({
    ...rest,
    id: clientId,
    created_at: new Date().toISOString(),
    retries: 0,
  })
  await saveQueue(queue)
}

/** Devuelve la cantidad de documentos pendientes */
export async function pendingCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

/** Intenta enviar todos los documentos pendientes a Supabase */
export async function flush(): Promise<{ sent: number; failed: number }> {
  const queue = await getQueue()
  if (queue.length === 0) return { sent: 0, failed: 0 }

  const supabase = createClient()
  let sent = 0
  const remaining: QueuedDocument[] = []

  for (const doc of queue) {
    const { error } = await supabase.from('documentos').insert({
      ...(doc.paciente_id ? { paciente_id: doc.paciente_id } : {}),
      tipo: doc.tipo,
      contenido: doc.contenido,
    })

    if (error) {
      // Si falló más de 5 veces, descartarlo para no acumular basura
      if (doc.retries < 5) {
        remaining.push({ ...doc, retries: doc.retries + 1 })
      }
    } else {
      sent++
    }
  }

  // Limpiar datos inmediatamente después de enviar exitosamente
  await saveQueue(remaining)
  return { sent, failed: remaining.length }
}

/** Inicia el proceso de sincronización automática */
export function startAutoSync(intervalMs = 30_000) {
  if (typeof window === 'undefined') return

  // Limpiar datos expirados al iniciar
  secureStorage.cleanup()

  // Intentar flush inmediato al iniciar
  flush()

  // Flush periódico — usa connectionMonitor para estado real
  const timer = setInterval(async () => {
    if (isOnline() && (await pendingCount()) > 0) {
      flush()
    }
  }, intervalMs)

  // Flush cuando vuelve la conexión
  function onOnline() {
    pendingCount().then(count => { if (count > 0) flush() })
  }
  window.addEventListener('online', onOnline)

  return () => {
    clearInterval(timer)
    window.removeEventListener('online', onOnline)
  }
}
