/**
 * src/lib/gcalFalso.ts
 *
 * El desvío de `googleapis` hacia el Google FALSO de las e2e
 * (`e2e/google-falso/servidor.ts`). `rootUrl` reescribe la URL de cada
 * petición de Calendar (`googleapis-common/build/src/apirequest.js`), así que
 * con él la app habla con un servidor local en vez de con Google.
 *
 * ⚠️⚠️ DOBLE GUARDA, Y LAS DOS TIENEN QUE CUMPLIRSE:
 *   1. NUNCA en producción: `NODE_ENV === 'production'` o
 *      `VERCEL_ENV === 'production'` → `null`. Ojo: `next start` y `next build`
 *      ponen `NODE_ENV=production`, así que las e2e de Google corren contra
 *      `next dev` (ver `e2e/agenda-google-dos-sentidos.e2e.ts`). En un build de
 *      producción la primera comparación queda en `'production' === 'production'`
 *      y el desvío es inalcanzable.
 *   2. NUNCA con una Supabase que no sea local: `NEXT_PUBLIC_SUPABASE_URL` tiene
 *      que ser `localhost` o `127.0.0.1`.
 * Y además el destino tiene que ser local (`http://127.0.0.1` o `localhost`):
 * cada petición lleva el access token en `Authorization`, y un desvío a otra
 * máquina lo regalaría.
 *
 * Cualquier duda (URL ilegible, variable vacía) = sin desvío: se habla con
 * Google como siempre. Lo prueba `src/lib/tests/gcalFalso.test.ts`.
 */

const LOCALES = new Set(['localhost', '127.0.0.1'])

function esLocal(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOCALES.has(u.hostname)
  } catch {
    return false
  }
}

/** La `rootUrl` del Google falso, o `null` (lo normal: Google de verdad). */
export function rootUrlGoogleFalso(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  if (process.env.VERCEL_ENV === 'production') return null
  const destino = process.env.GCAL_FALSO_URL
  if (!destino || !esLocal(destino)) return null
  if (!esLocal(process.env.NEXT_PUBLIC_SUPABASE_URL)) return null
  return destino.endsWith('/') ? destino : `${destino}/`
}
