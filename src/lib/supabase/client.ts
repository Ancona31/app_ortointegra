import { createBrowserClient, type CookieOptions } from '@supabase/ssr'

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

/**
 * Convierte las `options` que entrega `@supabase/ssr` en la cadena de atributos
 * que espera `document.cookie`.
 *
 * ⚠️ ESTA FUNCIÓN EXISTE PORQUE EL `setAll` DE ABAJO TIRABA LAS `options`, Y ESO
 * IMPEDÍA BORRAR LA COOKIE DE SESIÓN. El adaptador de ssr pide el borrado
 * pasando `{ ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 }` — `removeItem` en
 * `@supabase/ssr/dist/main/cookies.js:193-210`. Al descartarse las opciones se
 * escribía `nombre=; path=/`, o sea una cookie VIVA con el valor vacío: seguía
 * presente en el navegador y `middleware.ts:219-220` la cuenta como sesión,
 * porque mira el nombre y no el valor.
 * Honrar `maxAge: 0` ES el borrado, y por eso no hay una rama aparte de
 * «borrar»: RFC 6265 §5.2.2 — un `Max-Age` menor o igual a cero fija la
 * caducidad en la fecha más antigua representable.
 *
 * ⚠️ `httpOnly` NO SE EMITE NUNCA, Y NO ES UN OLVIDO. RFC 6265 §5.3 paso 10: si
 * una escritura que NO viene de HTTP —y `document.cookie` es exactamente eso—
 * trae el atributo `HttpOnly`, el navegador DESCARTA LA COOKIE ENTERA, sin
 * error y sin excepción. Hoy no se dispararía porque
 * `DEFAULT_COOKIE_OPTIONS.httpOnly` es `false` (`.../utils/constants.js:7`),
 * pero un `if (options.httpOnly)` ingenuo convertiría cualquier
 * `cookieOptions.httpOnly` que alguien añada en el futuro en la pérdida
 * silenciosa de toda la sesión del lado cliente.
 *
 * ⚠️ `Secure` SE PONE SIEMPRE Y NO SE LEE DE `options`: ssr no lo manda nunca
 * —no está en `constants.js:4-11`—, así que leerlo de ahí DEGRADARÍA la cookie
 * de autenticación respecto a lo que este archivo ya escribía. `localhost` y
 * `127.0.0.1` son orígenes de confianza para el navegador, así que el
 * desarrollo local no se rompe. Servir por http desde una IP de LAN sí hace que
 * el navegador rechace la escritura, y eso ya pasaba antes de este cambio.
 */
function serializarCookie(name: string, value: string, options?: CookieOptions): string {
  const atributos = [`${name}=${encodeURIComponent(value)}`]

  atributos.push(`path=${options?.path ?? '/'}`)
  if (options?.domain) atributos.push(`domain=${options.domain}`)

  /* `sameSite` llega como booleano o como cadena (es `Partial<SerializeOptions>`
     del paquete `cookie`). `true` significa `Strict`; cualquier otro caso
     conserva el `Lax` que este archivo ya escribía. */
  const sameSite = options?.sameSite
  atributos.push(`SameSite=${typeof sameSite === 'string' ? sameSite : sameSite === true ? 'Strict' : 'Lax'}`)

  if (typeof options?.maxAge === 'number') {
    atributos.push(`max-age=${Math.max(0, Math.trunc(options.maxAge))}`)
  }
  if (options?.expires instanceof Date) {
    atributos.push(`expires=${options.expires.toUTCString()}`)
  }
  if (options?.partitioned) atributos.push('Partitioned')

  atributos.push('Secure')

  return atributos.join('; ')
}

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        // LOCAL-FIRST: usamos localStorage (no sessionStorage) para que la
        // sesión sobreviva al cierre del tab y permita operación offline
        // sostenida. El SessionGuard usa sessionStorage.SESSION_FLAG como
        // detector de "tab nuevo" para mantener el auto-logout al cerrar
        // navegador, pero la sesión real de Supabase vive en localStorage.
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
          /* ⚠️ LAS `options` SE HONRAN. Aquí estuvo el defecto: esta función las
             desestructuraba fuera y escribía atributos fijos, así que la
             petición de borrado del adaptador de ssr (`maxAge: 0`) se convertía
             en una cookie viva con el valor vacío. El porqué completo, con las
             referencias al RFC, está en `serializarCookie` arriba.
             ⚠️ CONSECUENCIA QUE HAY QUE SABER: ahora el cliente también honra el
             `maxAge` de 400 días que trae `DEFAULT_COOKIE_OPTIONS` de ssr, igual
             que ya hacían `server.ts:16` y `middleware.ts:63`. Antes las cookies
             escritas por el navegador eran de sesión y las del servidor de 400
             días, así que la misma cookie cambiaba de naturaleza según quién la
             hubiera escrito último.
             ⚠️ Y SI EL NÚMERO TIENE QUE SER OTRO —está decidido que sí, 60 días,
             ficha SES-01 de `CLAUDE.md`— EL SITIO NO ES `cookieOptions.maxAge`:
             ssr lo fusiona y acto seguido lo pisa con su propio default
             (`cookies.js:168-172` en el navegador y `:327-331` en el servidor),
             así que se ignora en silencio. El sitio es `serializarCookie`, y la
             sustitución tiene que ir condicionada a `maxAge > 0`: un `maxAge`
             fijo sin esa condición convierte cada BORRADO en una renovación y
             reabre el defecto que este bloque acaba de cerrar. */
          cookiesToSet.forEach(({ name, value, options }) => {
            if (typeof document === 'undefined') return
            document.cookie = serializarCookie(name, value, options)
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
