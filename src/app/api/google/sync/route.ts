/**
 * POST /api/google/sync — sondeo de la sincronización de vuelta al abrir la
 * agenda (bloque C, paso C6 de `mejora_agendaV2.md`).
 *
 * La agenda lo llama en tiempo ocioso tras la primera pintura (y al volver a
 * la pestaña pasados 2 min). No bloquea nada: la agenda ya pintó, y si esto
 * trae cambios, vuelve a pedir citas y Google.
 *
 * ── PUERTAS, EN ESTE ORDEN, ANTES DE TOCAR EL CLIENTE DE SERVICIO ──────────
 *   1. `getUser()` (autoridad del servidor; sin usuario, 401).
 *   2. Perfil con clínica (403 si no).
 *   3. `canVerAgendaCompleta`: sólo administrador de clínica y secretaria
 *      (C-g). Al médico invitado, `omitida`.
 *   4. El interruptor v2 de la clínica, con el cliente de SESIÓN (falla
 *      cerrado: apagado o tabla ausente = `omitida`).
 *   5. S3 con el cliente de SESIÓN: `clinica_no_suspendida()` y
 *      `clinica_tiene_acceso()` tal cual, las de `appointments_gates_insert`.
 *      Cualquier error = sin acceso. (`sincronizarClinica` vuelve a mirarlo
 *      con `gcal_sync_clinica_habilitada`, ya como `service_role`.)
 *   6. La conexión de la clínica, con el cliente de sesión (RLS).
 * Sólo entonces `sincronizarClinica`, con 8 s de presupuesto y 60 s mínimos
 * entre sondeos por clínica (los impone `gcal_sync_tomar` en la base, para
 * todas las pestañas y usuarios a la vez).
 *
 * Responde `{ estado, cambios }` y NADA MÁS: ni eventos, ni ids, ni errores de
 * Google. Las únicas excepciones son el 401 y el 403 de las dos primeras
 * puertas, con un `{ error }` genérico como el resto de rutas.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canVerAgendaCompleta } from '@/lib/permissions'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { sincronizarClinica, type EstadoSincronizacion } from '@/lib/gcalSincronizacion'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** C-g: mínimo entre sondeos por clínica. */
const MIN_INTERVALO_SEG = 60
const PRESUPUESTO_MS = 8_000
/** El candado tiene que durar más que el presupuesto. */
const LEASE_SEG = 30

type Respuesta = { estado: EstadoSincronizacion | 'sin_conexion'; cambios: number }

function contestar(estado: Respuesta['estado'], cambios = 0): NextResponse<Respuesta> {
  return NextResponse.json({ estado, cambios })
}

type Sesion = Awaited<ReturnType<typeof createClient>>

/** S3 con la sesión: las dos puertas de `appointments_gates_insert`. Error = sin acceso. */
async function clinicaConAcceso(supabase: Sesion): Promise<boolean> {
  try {
    const [suspension, acceso] = await Promise.all([
      supabase.rpc('clinica_no_suspendida'),
      supabase.rpc('clinica_tiene_acceso'),
    ])
    return !suspension.error && !acceso.error && suspension.data === true && acceso.data === true
  } catch {
    return false
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })
    if (!canVerAgendaCompleta(profile)) return contestar('omitida')

    if (!(await agendaV2Encendida(supabase, profile.clinica_id))) return contestar('omitida')
    if (!(await clinicaConAcceso(supabase))) return contestar('sin_acceso')

    const conexion = await resolverConexionClinica(supabase, profile.clinica_id)
    // El `clinicaId` de la conexión sale de la consulta filtrada por la del
    // perfil; se comprueba igual antes de dárselo al cliente de servicio.
    if (!conexion || conexion.clinicaId !== profile.clinica_id) return contestar('sin_conexion')

    const r = await sincronizarClinica(conexion, {
      actorId: user.id, presupuestoMs: PRESUPUESTO_MS, leaseSeg: LEASE_SEG, minIntervaloSeg: MIN_INTERVALO_SEG,
    })
    // Sólo lo que cambió en Spinus: lo restablecido cambia Google, no la agenda.
    return contestar(r.estado, r.cambios)
  } catch {
    // Sin detalle hacia fuera: el orquestador ya registró lo suyo.
    return contestar('error')
  }
}
