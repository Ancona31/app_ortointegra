/**
 * src/lib/supabase/sesionServidor.ts
 *
 * UN `getUser()` + UN `profiles` por petición, compartidos por
 * `(app)/layout.tsx` y las páginas que los necesitan (hoy `agenda/page.tsx`,
 * A1.4c). Next renderiza layout y página EN PARALELO y `React.cache` reparte a
 * los dos la misma promesa dentro de la misma petición
 * (`node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`,
 * «Sharing data with context and React.cache» y «Parallel data fetching»).
 *
 * ⚠️⚠️ ESTO NO DECIDE NADA: SÓLO LEE. La autoridad sigue siendo `getUser()`
 * —servidor de Auth, la que exige un redirect según «Autoridad de sesión» de
 * `CLAUDE.md`— y el `redirect('/login')` sigue en el layout, con la misma
 * condición. NO lo cambies por `getClaims()` «porque aquí sólo se lee»: el
 * layout redirige con esto.
 *
 * ⚠️ EN NAVEGACIÓN SUAVE el layout no se vuelve a renderizar y la página paga
 * su propio `getUser()`: la caché es por petición, no por sesión.
 *
 * ⚠️ El `select` es `COLUMNAS_PERFIL_SESION`, la MISMA cadena que el de
 * `getSubscriptionState` (PERF-DT-1, ver `lib/perfil/perfilSesion.ts`).
 */
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_PERFIL_SESION } from '@/lib/perfil/perfilSesion'
import type { PerfilParaSuscripcion } from '@/lib/subscription'

export interface SesionServidor {
  supabase: Awaited<ReturnType<typeof createClient>>
  /** `null` = sin sesión válida según el servidor de Auth. */
  user: User | null
  /** La fila con `COLUMNAS_PERFIL_SESION`, o `null` si no hay usuario o falló.
   *  Sin el genérico `Database` llega sin tipo: se declara lo que el layout
   *  pasa a `getSubscriptionState`; `analizarPerfilSesion` valida el resto. */
  profile: PerfilParaSuscripcion | null
}

export const sesionServidor = cache(async (): Promise<SesionServidor> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select(COLUMNAS_PERFIL_SESION)
    .eq('id', user.id)
    .single()
  return { supabase, user, profile }
})
