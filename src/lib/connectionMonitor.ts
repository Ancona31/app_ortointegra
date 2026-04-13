/**
 * Monitor global de conexión.
 * Combina navigator.onLine + ping real a /api/health cada 30s.
 * Mide latencia para detectar conexión lenta.
 *
 * Modo Offline Forzado:
 *   Toggle manual persistente (localStorage) que fuerza el estado a
 *   'offline' independientemente del estado real de la red. Útil para
 *   QA en consultorio con "Wi-Fi fantasma" y para testing reproducible
 *   del outbox/DLQ. Mientras esté activo, los pings se suprimen.
 */

export type ConnectionStatus = 'online' | 'offline' | 'slow'

type Listener = (status: ConnectionStatus, latencyMs: number | null) => void

const PING_INTERVAL = 30_000
const SLOW_THRESHOLD_MS = 3_000
const FORCED_OFFLINE_KEY = 'spinus:forced-offline'

let currentStatus: ConnectionStatus = 'online'
let currentLatency: number | null = null
let listeners: Listener[] = []
let pingTimer: ReturnType<typeof setInterval> | null = null
let started = false
let forcedOffline = false

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
  // Modo offline forzado bloquea cualquier ping real
  if (forcedOffline) {
    setStatus('offline', null)
    return
  }

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

function handleOnline() {
  // Si está forzado offline, ignorar el evento del browser
  if (forcedOffline) return
  ping()
}
function handleOffline() { setStatus('offline', null) }

export function startMonitor() {
  if (typeof window === 'undefined' || started) return
  started = true

  // Recuperar estado forzado persistido antes de calcular status inicial
  try {
    forcedOffline = window.localStorage.getItem(FORCED_OFFLINE_KEY) === '1'
  } catch {
    forcedOffline = false
  }

  if (forcedOffline) {
    currentStatus = 'offline'
  } else {
    currentStatus = navigator.onLine ? 'online' : 'offline'
  }

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

/**
 * Modo Offline Forzado — API pública
 *
 * isForcedOffline() — lectura del estado actual
 * setForcedOffline(true)  — activa: persiste flag, setea status a 'offline',
 *                            notifica listeners, ignora navigator.onLine
 * setForcedOffline(false) — desactiva: persiste, dispara ping() para
 *                            re-sincronizar con el estado real de red
 */
export function isForcedOffline(): boolean { return forcedOffline }

export function setForcedOffline(value: boolean): void {
  if (typeof window === 'undefined') return
  if (forcedOffline === value) return

  forcedOffline = value

  try {
    if (value) {
      window.localStorage.setItem(FORCED_OFFLINE_KEY, '1')
    } else {
      window.localStorage.removeItem(FORCED_OFFLINE_KEY)
    }
  } catch {
    // localStorage no disponible (Safari private mode, etc.) — aceptamos
    // que el toggle no sobreviva recarga pero sigue funcionando en memoria
  }

  if (value) {
    // Al activar: forzar estado offline y notificar
    setStatus('offline', null)
  } else {
    // Al desactivar: disparar un ping inmediato para re-sincronizar con red real
    ping()
  }
}
