/**
 * Wrapper de fetch con reintentos y backoff exponencial.
 * Uso en operaciones críticas: guardar nota, crear paciente, generar PDF.
 */

const BACKOFF_MS = [1000, 3000, 6000] as const

export interface FetchWithRetryOptions extends RequestInit {
  /** Máximo de reintentos (default 3) */
  maxRetries?: number
  /** Timeout por intento en ms (default 15000) */
  timeoutMs?: number
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 15_000, ...fetchInit } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Merge signals: respect caller's signal + our timeout
    if (fetchInit.signal) {
      fetchInit.signal.addEventListener('abort', () => controller.abort())
    }

    try {
      const res = await fetch(url, { ...fetchInit, signal: controller.signal })
      clearTimeout(timer)

      // No reintentar errores del cliente (4xx) excepto 408/429
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        return res
      }

      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err : new Error('Network error')

      // Si el caller abortó, no reintentar
      if (fetchInit.signal?.aborted) throw lastError
    }

    // Esperar backoff antes del siguiente intento (si hay más)
    if (attempt < maxRetries) {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('fetchWithRetry: todos los intentos fallaron')
}
