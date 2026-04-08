import { createClient } from '@/lib/supabase/client'

const QUEUE_KEY = 'spinus_offline_queue'

type QueuedDocument = {
  id: string
  paciente_id?: string
  tipo: string
  contenido: Record<string, unknown>
  created_at: string
  retries: number
}

function getQueue(): QueuedDocument[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedDocument[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}
}

/** Agrega un documento a la cola offline */
export function enqueue(doc: Omit<QueuedDocument, 'id' | 'created_at' | 'retries'>) {
  const queue = getQueue()
  queue.push({
    ...doc,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    retries: 0,
  })
  saveQueue(queue)
}

/** Devuelve la cantidad de documentos pendientes */
export function pendingCount(): number {
  return getQueue().length
}

/** Intenta enviar todos los documentos pendientes a Supabase */
export async function flush(): Promise<{ sent: number; failed: number }> {
  const queue = getQueue()
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

  saveQueue(remaining)
  return { sent, failed: remaining.length }
}

/** Inicia el proceso de sincronización automática */
export function startAutoSync(intervalMs = 30_000) {
  if (typeof window === 'undefined') return

  // Intentar flush inmediato al iniciar
  flush()

  // Flush periódico
  const timer = setInterval(() => {
    if (navigator.onLine && pendingCount() > 0) {
      flush()
    }
  }, intervalMs)

  // Flush cuando vuelve la conexión
  function onOnline() {
    if (pendingCount() > 0) flush()
  }
  window.addEventListener('online', onOnline)

  return () => {
    clearInterval(timer)
    window.removeEventListener('online', onOnline)
  }
}
