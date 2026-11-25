/**
 * src/lib/reserva/preparacionServidor.ts
 *
 * Qué le falta a cada médico para que su enlace de reserva abra (tanda T2,
 * punto 8): lo devuelve `GET /api/agenda/enlaces` en `preparacion`, y con eso
 * la pantalla marca el enlace que no abrirá y pide, al crear uno, lo que
 * falte. SÓLO SERVIDOR. La regla es `motivosApertura()`, la misma de la
 * página pública.
 *
 * Dos fuentes, por este orden de autoridad:
 *   1. Médico CON un enlace vigente: se abre ese enlace con `abrirEnlace()`,
 *      exactamente como lo abriría el paciente (puertas de la base incluidas).
 *      `null` → `no_abre`; si abre, sus motivos salen del contexto devuelto.
 *   2. Médico SIN enlace: de las tablas (consultorios activos, tipos activos,
 *      horario de la clínica), para decir qué falta antes de crear uno.
 *
 * ⚠️ CLIENTE DE SERVICIO EN UN SOLO SITIO, y filtrado por `clinica_id`: los
 * consultorios de OTROS médicos, que el administrador no ve por la RLS de
 * `consultorios` (`consultorios_select`: el dueño o la secretaria). Sólo se
 * leen `medico_id`, `horario` y `horario_propio`, y del navegador sólo sale el
 * motivo derivado, nunca el horario. Quién entra en el alcance lo decide el
 * rol de la sesión (`gestionaTodos`), ya comprobado por `entradaGestion()`.
 * Tipos, médicos y horario de la clínica van con la sesión.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { abrirEnlace } from '@/lib/reserva/puertaReserva'
import { codigoDeEnlace } from '@/lib/reserva/secretos'
import { gestionaTodos, type EnlaceReserva, type PerfilGestion } from '@/lib/reserva/gestionReserva'
import { motivosApertura, type MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import { logger } from '@/lib/logger'

export type Preparacion = Record<string, MotivoApertura[]>

interface Tablas {
  medicos: string[]
  consultorios: { medico_id: string; horario: unknown; horario_propio: boolean | null }[]
  tipos: { medico_id: string | null }[]
  horarioClinica: unknown
}

/** Lo que dicen las tablas. Lanza si una lectura falla (quien llama lo traga). */
async function leerTablas(supabase: ClienteSesion, clinicaId: string, perfil: PerfilGestion): Promise<Tablas> {
  const todos = gestionaTodos(perfil)
  const medicosQ = todos
    ? supabase.from('profiles').select('id').eq('clinica_id', clinicaId).eq('role', 'medico')
    : null
  let consQ = createAdminClient().from('consultorios').select('medico_id, horario, horario_propio')
    .eq('clinica_id', clinicaId).eq('activo', true)
  if (!todos) consQ = consQ.eq('medico_id', perfil.id)
  const [med, cons, tipos, clin] = await Promise.all([
    medicosQ,
    consQ,
    supabase.from('tipos_cita').select('medico_id').eq('clinica_id', clinicaId).eq('activo', true),
    supabase.from('clinicas').select('horario_consulta').eq('id', clinicaId).maybeSingle(),
  ])
  const error = med?.error ?? cons.error ?? tipos.error ?? clin.error
  if (error) throw new Error(`preparación sin leer: ${error.code ?? ''}`)
  return {
    medicos: todos ? (med?.data ?? []).map(m => m.id) : [perfil.id],
    consultorios: cons.data ?? [],
    tipos: tipos.data ?? [],
    horarioClinica: clin.data?.horario_consulta ?? null,
  }
}

/** Los motivos de un médico según las tablas (como si tuviera un enlace vigente). */
function segunTablas(t: Tablas, medicoId: string): MotivoApertura[] {
  return motivosApertura({
    estado: 'vigente',
    consultorios: t.consultorios.filter(c => c.medico_id === medicoId),
    tipos: t.tipos.filter(x => x.medico_id === null || x.medico_id === medicoId).length,
    horarioClinica: t.horarioClinica,
  })
}

/**
 * Los motivos de un enlace vigente, abriéndolo como el paciente. Si no abre,
 * `no_abre` y, detrás, lo que digan las tablas (el contexto no llega).
 */
async function segunEnlace(enlaceId: string, clinicaId: string, t: Tablas, medicoId: string): Promise<MotivoApertura[]> {
  const codigo = codigoDeEnlace(enlaceId)
  const abierto = codigo ? await abrirEnlace(codigo) : null
  if (!abierto || abierto.ctx.clinica_id !== clinicaId) return ['no_abre', ...segunTablas(t, medicoId)]
  const { ctx } = abierto
  return motivosApertura({
    estado: ctx.estado, consultorios: ctx.consultorios, tipos: ctx.tipos.length, horarioClinica: ctx.clinica?.horario ?? null,
  })
}

/**
 * Los motivos por médico del alcance de quien llama. `null` si algo falla:
 * la lista de enlaces sale igual, sin las marcas. Sin `RESERVA_SECRETO` o con
 * el aviso pendiente no se abre ningún enlace: eso ya lo dice la pantalla
 * aparte, así que aquí sólo cuentan las tablas.
 */
export async function preparacionDe(
  supabase: ClienteSesion, clinicaId: string, perfil: PerfilGestion, enlaces: readonly EnlaceReserva[], abribles: boolean,
): Promise<Preparacion | null> {
  try {
    const t = await leerTablas(supabase, clinicaId, perfil)
    const salida: Preparacion = {}
    await Promise.all(t.medicos.map(async (m) => {
      const enlace = abribles ? enlaces.find(e => e.medico_id === m) : undefined
      salida[m] = enlace ? await segunEnlace(enlace.id, clinicaId, t, m) : segunTablas(t, m)
    }))
    return salida
  } catch (err: unknown) {
    logger.warn('agenda', `preparación de enlaces sin calcular: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}
