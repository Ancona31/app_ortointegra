/**
 * Monitor global de conexión.
 * Combina navigator.onLine + ping real a /api/health cada 30s.
 * Mide latencia para detectar conexión lenta.
 */

export type ConnectionStatus = 'online' | 'offline' | 'slow'

type Listener = (status: ConnectionStatus, latencyMs: number | null) => void

const PING_INTERVAL = 30_000
const SLOW_THRESHOLD_MS = 3_000

let currentStatus: ConnectionStatus = 'online'
let currentLatency: number | null = null
let listeners: Listener[] = []
let pingTimer: ReturnType<typeof setInterval> | null = null
let started = false

function notify() {
  for (const fn of listeners) {
    fn(currentStatus, currentLatency)
  }
}

function setStatus(status: ConnectionStatus, latency: number | null) {
  const changed = status !== currentStatus || latency !== currentLatency
  currentStatus = status
  currentLatency = latency
  if (changed) notify()
}

async function ping() {
  if (!navigator.onLine) {
    setStatus('offline', null)
    return
  }

  const start = performance.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)

    if (!res.ok) {
      setStatus('offline', null)
      return
    }

    const latency = Math.round(performance.now() - start)
    setStatus(latency > SLOW_THRESHOLD_MS ? 'slow' : 'online', latency)
  } catch {
    setStatus('offline', null)
  }
}

function handleOnline() { ping() }
function handleOffline() { setStatus('offline', null) }

export function startMonitor() {
  if (typeof window === 'undefined' || started) return
  started = true

  currentStatus = navigator.onLine ? 'online' : 'offline'

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Ping inmediato + periódico
  ping()
  pingTimer = setInterval(ping, PING_INTERVAL)
}

export function stopMonitor() {
  if (typeof window === 'undefined') return
  started = false
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
}

export function subscribe(fn: Listener): () => void {
  listeners.push(fn)
  // Notificar estado actual inmediatamente
  fn(currentStatus, currentLatency)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

export function getStatus(): ConnectionStatus { return currentStatus }
export function getLatency(): number | null { return currentLatency }
export function isOnline(): boolean { return currentStatus !== 'offline' }
