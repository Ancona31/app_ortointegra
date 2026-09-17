import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/* ⚠️ LA VIDA DE LA COOKIE DE SESIÓN — 60 DÍAS, DECISIÓN DE ANGEL (ficha SES-01
   de `CLAUDE.md`), en vez de los 400 días del default de `@supabase/ssr`
   (`dist/main/utils/constants.js:10`), que no eligió nadie.
   ⚠️ DUPLICADA A PROPÓSITO EN LOS TRES ESCRITORES DE COOKIES —`client.ts`,
   éste y `src/middleware.ts`—. Si cambia, cambian los tres A LA VEZ, o la misma
   cookie dura distinto según quién la escribió último. El porqué largo está en
   `src/lib/supabase/client.ts`. */
const VIDA_SESION_SEG = 60 * 60 * 24 * 60

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              /* ⚠️ LA CONDICIÓN `> 0` ES TODO EL ARREGLO, NO UN DETALLE.
                 `maxAge: 0` es como el adaptador de ssr pide BORRAR la cookie
                 (`cookies.js:193-210`, y RFC 6265 §5.2.2: un `Max-Age` ≤ 0 la
                 caduca). Pisarlo con 60 días convertiría cada cierre de sesión
                 en una renovación y dejaría vivas cookies con el JWT y el
                 refresh token dentro. Comprueba el BORRADO, no sólo el alta.
                 ⚠️ Y NO SE HACE CON `cookieOptions.maxAge` en `createServerClient`:
                 ssr lo fusiona y acto seguido lo pisa con su propio default
                 (`cookies.js:327-331`), así que se ignoraría en silencio. */
              const vida = typeof options?.maxAge === 'number' && options.maxAge > 0
                ? { ...options, maxAge: VIDA_SESION_SEG }
                : options
              cookieStore.set(name, value, vida)
            })
          } catch {}
        },
      },
    }
  )
}
