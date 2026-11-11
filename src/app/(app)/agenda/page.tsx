import { unstable_rethrow } from 'next/navigation'
import AgendaCliente, { type Appointment } from './AgendaCliente'
import { sesionServidor } from '@/lib/supabase/sesionServidor'
import { analizarPerfilSesion } from '@/lib/perfil/perfilSesion'
import { consultaCitas } from '@/lib/agenda/consultaCitas'
import { ventanaDeLaSemilla, type SemillaCitas } from '@/lib/agenda/semillaCitas'
import { hoyEnTZ, TZ_CLINICA } from '@/lib/dates'
import { logger } from '@/lib/logger'

/**
 * Las citas de la primera pintura (A1.4c): W-1, W y W+1 de hoy, para que la
 * agenda abra —y se mueva una semana a cada lado— sin `GET /api/appointments`.
 * El cliente las parte por semanas; ver `lib/agenda/semillaCitas.ts`.
 *
 * ⚠️⚠️ ES LO MISMO QUE LA API LE DARÍA A ESTE USUARIO, NI UNA COLUMNA MÁS:
 * `consultaCitas` es la consulta de la ruta, con el cliente de SESIÓN (RLS) y
 * la clínica explícita. NUNCA `createAdminClient()` aquí.
 *
 * ⚠️ El filtro es el que la agenda usaría al abrir (`semillaFiltro` en
 * `AgendaCliente`): médico → él mismo; secretaria → todos. Cualquier otra cosa
 * —sin sesión, perfil que no cuadra, rol raro, error— es `null` = no siembra, y
 * la agenda pide a la red como siempre. Sólo rechaza con los errores internos
 * de Next (ver el `catch`).
 */
async function sembrarCitas(): Promise<SemillaCitas<Appointment> | null> {
  try {
    const { supabase, profile } = await sesionServidor()
    const perfil = analizarPerfilSesion(profile)
    if (!perfil?.clinica_id || (perfil.role !== 'medico' && perfil.role !== 'secretaria')) return null
    const filtro = perfil.role === 'medico' ? perfil.id : ''
    const { desde, hasta } = ventanaDeLaSemilla(hoyEnTZ(TZ_CLINICA))
    const salio = Date.now()
    const r = await consultaCitas<Appointment>(supabase, {
      clinicaId: perfil.clinica_id, from: desde, to: hasta, medicoId: filtro,
    })
    if (!r.ok) {
      logger.warn('agenda', `semilla de citas sin datos: ${r.error}`)
      return null
    }
    return {
      id: crypto.randomUUID(), usuario: perfil.id, filtro, desde, hasta, salio,
      appointments: r.appointments, incompleta: r.incompleta,
    }
  } catch (err: unknown) {
    /* Los errores internos de Next —el de `cookies()` al intentar prerenderizar
       en el build, que es como Next sabe que la ruta es dinámica— no son
       nuestros: se relanzan (`unstable_rethrow.md`). El cliente trata el
       rechazo igual que `null`. */
    unstable_rethrow(err)
    logger.warn('agenda', `semilla de citas sin datos: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

/**
 * Server component. NO ESPERA a la semilla: la promesa viaja a `AgendaCliente`
 * (`node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`,
 * «Streaming data with the `use` API»), que no la lee con `use()` —no
 * suspende— sino con `.then()`, y su fuente de citas la espera como mucho unos
 * segundos antes de ir a la red. Por eso no hace falta `<Suspense>`.
 *
 * Sin `<Suspense>` tampoco por `useSearchParams()`: `AgendaCliente` no lo usa
 * (lee `window.location` a propósito, ver el `useEffect` del enlace profundo).
 *
 * El `getUser()` lo comparte con `(app)/layout.tsx` (`sesionServidor`, React
 * `cache`): en carga dura es UNO para los dos. En navegación suave el layout no
 * se renderiza y éste paga el suyo.
 */
export default function AgendaPage() {
  return <AgendaCliente semillaCitas={sembrarCitas()} />
}
