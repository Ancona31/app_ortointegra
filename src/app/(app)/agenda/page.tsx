import { unstable_rethrow } from 'next/navigation'
import AgendaCliente, { type Appointment } from './AgendaCliente'
import { sesionServidor } from '@/lib/supabase/sesionServidor'
import { analizarPerfilSesion } from '@/lib/perfil/perfilSesion'
import { consultaCitas } from '@/lib/agenda/consultaCitas'
import { ventanaDeLaSemilla, type SemillaCitas } from '@/lib/agenda/semillaCitas'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { leerConsultoriosAgenda } from '@/lib/agenda/consultoriosAgendaServidor'
import type { ConsultorioRejilla } from '@/lib/agenda/horarioRejilla'
import { COLUMNAS_TIPO_CITA, type TipoCita } from '@/lib/agenda/tiposCita'
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
 * El interruptor de la agenda v2 de la clínica del usuario (plan del bloque B
 * §1, `agenda_ajustes.agenda_v2_encendida`). Comparte el `getUser()` de
 * `sesionServidor` con la semilla y el layout, y lee con el cliente de SESIÓN.
 * FALLA CERRADO: sin sesión, sin clínica o ante cualquier error, `false`. Sólo
 * rechaza con los errores internos de Next, como `sembrarCitas`.
 */
async function leerInterruptorAgenda(): Promise<boolean> {
  try {
    const { supabase, profile } = await sesionServidor()
    const perfil = analizarPerfilSesion(profile)
    if (!perfil?.clinica_id) return false
    return await agendaV2Encendida(supabase, perfil.clinica_id)
  } catch (err: unknown) {
    unstable_rethrow(err)
    logger.warn('agenda', `interruptor de la agenda sin leer: ${err instanceof Error ? err.message : 'error'}`)
    return false
  }
}

/**
 * Los consultorios con los que se dibuja la agenda v2 (puntos 10-13 de Angel,
 * `horarioRejilla.ts`): sólo con el interruptor encendido; apagada, `null` y la
 * agenda no los mira. Cliente de servicio filtrado por clínica y por alcance:
 * ver `consultoriosAgendaServidor.ts`. Cualquier fallo es `null` (la agenda
 * sigue con los de la sesión). Sólo rechaza con los errores internos de Next.
 */
async function leerConsultoriosRejilla(interruptor: Promise<boolean>): Promise<ConsultorioRejilla[] | null> {
  try {
    if (!(await interruptor)) return null
    const { profile } = await sesionServidor()
    const perfil = analizarPerfilSesion(profile)
    if (!perfil?.clinica_id) return null
    return await leerConsultoriosAgenda({
      id: perfil.id, role: perfil.role, clinica_id: perfil.clinica_id, es_admin_de_clinica: perfil.es_admin_de_clinica === true,
    })
  } catch (err: unknown) {
    unstable_rethrow(err)
    logger.warn('agenda', `consultorios de la rejilla sin leer: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

/**
 * Los tipos de cita del ajuste al turno (G2, `useAjusteTurno`): sólo con el
 * interruptor encendido, con el cliente de SESIÓN (la RLS de `tipos_cita`, la
 * misma que `GET /api/agenda/tipos-cita`) y la clínica explícita. Viajan con la
 * página, como la semilla (integración G1–G4, presupuesto de A): pedirlos desde
 * el navegador costaba una validación más contra Auth al abrir la agenda.
 * Cualquier fallo es `null` (la agenda no ajusta). Sólo rechaza con los errores
 * internos de Next.
 */
async function leerTiposAjuste(interruptor: Promise<boolean>): Promise<TipoCita[] | null> {
  try {
    if (!(await interruptor)) return null
    const { supabase, profile } = await sesionServidor()
    const perfil = analizarPerfilSesion(profile)
    if (!perfil?.clinica_id) return null
    const { data, error } = await supabase.from('tipos_cita').select(COLUMNAS_TIPO_CITA)
      .eq('clinica_id', perfil.clinica_id).eq('activo', true)
    if (error) {
      logger.warn('agenda', `tipos del ajuste al turno sin leer: ${error.code ?? ''} ${error.message}`)
      return null
    }
    const tipos: TipoCita[] = data ?? []
    return tipos
  } catch (err: unknown) {
    unstable_rethrow(err)
    logger.warn('agenda', `tipos del ajuste al turno sin leer: ${err instanceof Error ? err.message : 'error'}`)
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
  /* El interruptor viaja igual que la semilla: promesa sin esperar, así que no
     añade nada al TTFB; el cliente arranca en apagado hasta que resuelve. */
  const interruptor = leerInterruptorAgenda()
  return (
    <AgendaCliente
      semillaCitas={sembrarCitas()} interruptor={interruptor} consultoriosRejilla={leerConsultoriosRejilla(interruptor)}
      tiposAjuste={leerTiposAjuste(interruptor)}
    />
  )
}
