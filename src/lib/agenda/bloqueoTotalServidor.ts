/**
 * src/lib/agenda/bloqueoTotalServidor.ts
 *
 * Tanda L (L1, punto 6 de Angel) · El bloqueo de horario es TOTAL: en un
 * periodo bloqueado no se agenda ni se mueve nada (citas y eventos sin
 * paciente, de horas o de todo el día). Lo llaman, con la v2 encendida, el
 * POST y el PUT de `/api/appointments` y el POST de `…/[id]/reagendar`, ANTES
 * de escribir y antes del aviso de empalme (no se pregunta por un empalme en
 * un horario donde no se puede agendar).
 *
 * La base es la barrera que no se salta (`trg_appointments_horario_bloqueado`,
 * 20261124120000): esto es el 409 legible antes de llegar a ella, y
 * `esErrorDeBloqueo` reconoce su 42501 por el HINT —nuestro— en la carrera
 * (un bloqueo creado entre el veto y la escritura).
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: la RLS de
 * `agenda_bloqueos` es la de quien puede agendar para ese médico, la misma
 * que lee el disparador. El `eq('clinica_id')` es explícito (pendiente
 * prioritario de `CLAUDE.md`).
 *
 * Falla ABIERTO (como el empalme): si la lectura falla o la tabla no existe
 * todavía en esa base, se sigue y decide el disparador, que sí está.
 */
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { TEXTO_HORARIO_BLOQUEADO } from '@/lib/agenda/bloqueosAgenda'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

/** El HINT del 42501 de `cita_proteger_bloqueo()`. */
export const HINT_HORARIO_BLOQUEADO = 'agenda_horario_bloqueado'

/** El cuerpo del 409: el mensaje de Angel, literal, que la pantalla enseña tal cual. */
export const CUERPO_HORARIO_BLOQUEADO = { error: 'horario_bloqueado', message: TEXTO_HORARIO_BLOQUEADO } as const

const TABLA_AUSENTE = new Set(['42P01', 'PGRST205'])

/** ¿El periodo [inicio, fin) del médico toca un bloqueo suyo? (solape semiabierto, el de la base). */
export async function caeEnBloqueo(
  supabase: ClienteSesion, p: { clinicaId: string; medicoId: string | null; inicio: string; fin: string },
): Promise<boolean> {
  if (!p.medicoId) return false
  const { count, error } = await supabase.from('agenda_bloqueos').select('id', { count: 'exact', head: true })
    .eq('clinica_id', p.clinicaId).eq('medico_id', p.medicoId)
    .lt('inicio', p.fin).gt('fin', p.inicio)
  if (error) {
    if (!error.code || !TABLA_AUSENTE.has(error.code)) logger.warn('agenda', `bloqueos sin leer: ${error.code ?? 'sin código'}`)
    return false
  }
  return (count ?? 0) > 0
}

/** Lo que un PUT va a dejar escrito; lo que no viene en `updates` se queda como estaba. */
interface Antes { medico_id: string | null; start_time: string; end_time: string }

/**
 * El veto del PUT: sólo si cambian el inicio, el fin o el médico (lo que ya
 * estaba dentro de un bloqueo se queda y se puede confirmar, cancelar, ligar…;
 * K punto 5). Mismo criterio que el disparador.
 */
export async function bloqueoDelPut(
  supabase: ClienteSesion, clinicaId: string, antes: Antes, updates: Record<string, unknown>,
): Promise<boolean> {
  const inicio = typeof updates.start_time === 'string' ? updates.start_time : antes.start_time
  const fin = typeof updates.end_time === 'string' ? updates.end_time : antes.end_time
  const medico = typeof updates.medico_id === 'string' ? updates.medico_id : antes.medico_id
  const t = (v: string): number => new Date(v).getTime()
  const mueve = t(inicio) !== t(antes.start_time) || t(fin) !== t(antes.end_time) || medico !== antes.medico_id
  return mueve && caeEnBloqueo(supabase, { clinicaId, medicoId: medico, inicio, fin })
}

/** ¿Es el 42501 del disparador del bloqueo? Por su HINT, para no disfrazar otro 42501 (la RLS). */
export function esErrorDeBloqueo(error: { code?: string; hint?: string | null } | null | undefined): boolean {
  return error?.code === '42501' && error.hint === HINT_HORARIO_BLOQUEADO
}
