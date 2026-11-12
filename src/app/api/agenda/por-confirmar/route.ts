/**
 * GET /api/agenda/por-confirmar — la lista «citas de mañana por confirmar»
 * del WhatsApp manual (agenda E7, §5 E).
 *
 * Citas de MAÑANA (en la zona de cada consultorio, plan_E lista A 13), sólo
 * `scheduled` (las confirmadas por correo, WhatsApp, RSVP o el personal SALEN),
 * con paciente o por ligar, con hora. Devuelve lo justo para pintar la fila:
 * `{ id, inicio, zona, titulo, tiene_telefono, whatsapp_reminder_sent_at }`.
 * NO devuelve el teléfono: el botón de la fila lo pide a `/api/agenda/whatsapp`
 * (`preparar`), que vuelve a comprobar todo.
 *
 * E8 añade `canceladas` y D11 `empalmes` (reservas por enlace a las que una
 * sincronización con Google les metió encima un evento importado o movido).
 *
 * Puertas: `entradaGestion()` (401 / 403 / 404 con el interruptor apagado).
 * Cliente de SESIÓN: la RLS de `appointments` decide (el invitado, sólo las
 * suyas) y la consulta lleva `clinica_id` explícito.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import {
  citaAdmiteWhatsApp, citasWhatsApp, esDeManana, SELECT_CITA_WHATSAPP, telefonoDeCita, ZONA_CITA_POR_OMISION,
} from '@/lib/agenda/whatsappServidor'
import type { FilaPorConfirmar } from '@/lib/agenda/whatsappCita'
import { VENTANA_CANCELADAS_MS, type FilaCancelada } from '@/lib/agenda/avisoCancelacion'
import { empalmesVigentes, VENTANA_EMPALMES_MS, type FilaEmpalme } from '@/lib/agenda/avisoEmpalmeReserva'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Tope de filas: un día de consulta cabe holgado. */
const TOPE = 200
/** Desde ahora hasta 50 h: cubre «mañana» en cualquier zona de México. */
const VENTANA_MS = 50 * 3_600_000

/** E1 sin aplicar: la tabla o sus columnas no existen. La sección sale vacía. */
const AUSENTE = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])
const Respuesta = z.object({ appointment_id: z.string(), respondido_en: z.string() })
const CitaCancelada = z.object({
  id: z.string(), title: z.string().nullable(), start_time: z.string(), consultorio_timezone: z.string().nullable(), status: z.string(),
})

/**
 * E8 · «Canceladas por el paciente (48 h)»: las respuestas «cancelo» del
 * enlace de las últimas 48 h, con la cita aún cancelada (si el personal la
 * reactivó, sale). Dos lecturas con la SESIÓN y `clinica_id` explícito; la
 * RLS de `cita_confirmaciones` (E1) sólo deja ver las de citas que ya se ven.
 */
async function canceladasRecientes(supabase: ClienteSesion, clinicaId: string, ahora: number): Promise<FilaCancelada[]> {
  const { data, error } = await supabase.from('cita_confirmaciones').select('appointment_id, respondido_en')
    .eq('clinica_id', clinicaId).eq('respuesta', 'cancelo').gte('respondido_en', new Date(ahora - VENTANA_CANCELADAS_MS).toISOString())
    .order('respondido_en', { ascending: false }).limit(TOPE)
  if (error) {
    if (error.code && AUSENTE.has(error.code)) return []
    throw new Error(`respuestas sin leer: ${error.code ?? ''}`)
  }
  const respuestas = z.array(Respuesta).parse(data ?? [])
  if (respuestas.length === 0) return []
  const { data: filas, error: e2 } = await supabase.from('appointments')
    .select('id, title, start_time, consultorio_timezone, status')
    .eq('clinica_id', clinicaId).in('id', respuestas.map((r) => r.appointment_id))
  if (e2) throw new Error(`canceladas sin leer: ${e2.code ?? ''}`)
  const citas = new Map(z.array(CitaCancelada).parse(filas ?? []).map((c) => [c.id, c]))
  return respuestas.flatMap((r) => {
    const c = citas.get(r.appointment_id)
    if (!c || c.status !== 'cancelled') return []
    return [{ id: c.id, inicio: c.start_time, zona: c.consultorio_timezone || ZONA_CITA_POR_OMISION, titulo: c.title ?? '', respondido_en: r.respondido_en }]
  })
}

const Par = z.object({ cita_reserva_id: z.string(), cita_otra_id: z.string(), detectado_en: z.string() })
const CitaDelPar = z.object({
  id: z.string(), title: z.string().nullable(), start_time: z.string(), end_time: z.string(),
  consultorio_timezone: z.string().nullable(), status: z.string(), all_day: z.boolean(), medico_id: z.string().nullable(),
})

/**
 * D11 · «Reservas por enlace empalmadas con Google»: los pares que registró
 * la sincronización (`reserva_empalmes_google`) en los últimos 30 días, si el
 * empalme sigue en pie con las citas de hoy. Dos lecturas con la SESIÓN y
 * `clinica_id` explícito: la RLS de la tabla sólo deja ver los pares cuya
 * reserva se ve, y la de `appointments` decide qué citas salen. Sin la
 * migración de D11, vacía.
 */
async function empalmesConReservas(supabase: ClienteSesion, clinicaId: string, ahora: number): Promise<FilaEmpalme[]> {
  const { data, error } = await supabase.from('reserva_empalmes_google').select('cita_reserva_id, cita_otra_id, detectado_en')
    .eq('clinica_id', clinicaId).gte('detectado_en', new Date(ahora - VENTANA_EMPALMES_MS).toISOString())
    .order('detectado_en', { ascending: false }).limit(TOPE)
  if (error) {
    if (error.code && AUSENTE.has(error.code)) return []
    throw new Error(`empalmes sin leer: ${error.code ?? ''}`)
  }
  const pares = z.array(Par).parse(data ?? [])
  if (pares.length === 0) return []
  const ids = [...new Set(pares.flatMap((p) => [p.cita_reserva_id, p.cita_otra_id]))]
  const { data: filas, error: e2 } = await supabase.from('appointments')
    .select('id, title, start_time, end_time, consultorio_timezone, status, all_day, medico_id')
    .eq('clinica_id', clinicaId).in('id', ids)
  if (e2) throw new Error(`citas de empalmes sin leer: ${e2.code ?? ''}`)
  return empalmesVigentes(pares, z.array(CitaDelPar).parse(filas ?? []), ahora)
}

export async function GET(): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const ahora = Date.now()
    const { data, error } = await e.supabase.from('appointments').select(SELECT_CITA_WHATSAPP)
      .eq('clinica_id', e.clinicaId).eq('status', 'scheduled').eq('all_day', false)
      .gt('start_time', new Date(ahora).toISOString()).lt('start_time', new Date(ahora + VENTANA_MS).toISOString())
      .order('start_time').limit(TOPE)
    if (error) {
      logger.error('agenda', `por confirmar sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    const citas: FilaPorConfirmar[] = citasWhatsApp(data)
      .filter((c) => citaAdmiteWhatsApp(c, ahora) && esDeManana(c.start_time, c.consultorio_timezone, ahora))
      .map((c) => ({
        id: c.id, inicio: c.start_time, zona: c.consultorio_timezone || ZONA_CITA_POR_OMISION, titulo: c.title ?? '',
        tiene_telefono: telefonoDeCita(c) !== null, whatsapp_reminder_sent_at: c.whatsapp_reminder_sent_at,
      }))
    const canceladas = await canceladasRecientes(e.supabase, e.clinicaId, ahora)
    const empalmes = await empalmesConReservas(e.supabase, e.clinicaId, ahora)
    return NextResponse.json({ citas, canceladas, empalmes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    logger.error('agenda', `GET por confirmar: ${err instanceof Error ? err.name : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
