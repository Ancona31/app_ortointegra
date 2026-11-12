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
 * Puertas: `entradaGestion()` (401 / 403 / 404 con el interruptor apagado).
 * Cliente de SESIÓN: la RLS de `appointments` decide (el invitado, sólo las
 * suyas) y la consulta lleva `clinica_id` explícito.
 */
import { NextResponse } from 'next/server'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import {
  citaAdmiteWhatsApp, citasWhatsApp, esDeManana, SELECT_CITA_WHATSAPP, telefonoDeCita, ZONA_CITA_POR_OMISION,
} from '@/lib/agenda/whatsappServidor'
import type { FilaPorConfirmar } from '@/lib/agenda/whatsappCita'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Tope de filas: un día de consulta cabe holgado. */
const TOPE = 200
/** Desde ahora hasta 50 h: cubre «mañana» en cualquier zona de México. */
const VENTANA_MS = 50 * 3_600_000

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
    return NextResponse.json({ citas }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    logger.error('agenda', `GET por confirmar: ${err instanceof Error ? err.name : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
