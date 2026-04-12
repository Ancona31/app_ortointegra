import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Custom fetch wrapper: rechaza instantáneamente si el browser reporta
 * navigator.onLine === false. Evita que el SDK de Supabase cuelgue
 * 30 segundos esperando timeout en llamadas offline (/auth/v1/user, etc.)
 *
 * Online: pass-through directo al fetch nativo.
 * Offline: rechazo inmediato con Error('offline'); el SDK lo captura
 * y retorna { data: null, error } sin bloquear el event loop del browser.
 */
const offlineAwareFetch: typeof fetch = (input, init) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error('offline'))
  }
  return fetch(input, init)
}

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: offlineAwareFetch,
      },
      cookies: {
        getAll() {
          // Leer cookies del documento para SSR hydration
          if (typeof document === 'undefined') return []
          return document.cookie.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=')
            return { name, value: decodeURIComponent(rest.join('=')) }
          }).filter(c => c.name)
        },
        setAll(cookiesToSet) {
          // Cookies de sesión: sin max-age ni expires → mueren al cerrar pestaña
          cookiesToSet.forEach(({ name, value }) => {
            if (typeof document === 'undefined') return
            document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax; Secure`
          })
        },
      },
    }
  )

  return client
}

export function resetClient() {
  client = null
}
