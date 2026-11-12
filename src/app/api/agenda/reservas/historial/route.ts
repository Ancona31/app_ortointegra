/**
 * GET /api/agenda/reservas/historial?cita=<uuid> — el historial EN VIVO de la
 * persona que reservó esa cita, con ese médico (candado de §2; la parte de D2
 * que quedó pendiente): cancelaciones e inasistencias dentro de la ventana,
 * si está bloqueada, si lo está a mano y hasta cuándo. Lo pide el modal de la
 * cita (D6); la tarjeta enseña sólo la instantánea `reserva_historial_previo`.
 *
 * Puertas comunes en `entradaGestion()` (401/403/404 con el interruptor
 * apagado). La cita se lee con la sesión (RLS de `appointments`) y
 * `clinica_id` explícito; `reserva_contacto_estado` es INVOKER, así que la RLS
 * de `reserva_incidencias` y `reserva_contactos` también decide. Sin datos en
 * claro: la función trabaja con los seudónimos de la cita.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, leerCitaDeReserva } from '@/lib/reserva/gestionServidor'
import { puedeGestionarDelMedico, type HistorialContacto } from '@/lib/reserva/gestionReserva'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const NO_ENCONTRADA = { error: 'Cita no encontrada' }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const citaId = req.nextUrl.searchParams.get('cita') ?? ''
    if (!z.guid().safeParse(citaId).success) return NextResponse.json(NO_ENCONTRADA, { status: 404 })
    const cita = await leerCitaDeReserva(e.supabase, e.clinicaId, citaId)
    if (!cita?.medico_id || !cita.reserva_tel_hmac || !cita.reserva_correo_hmac) {
      return NextResponse.json(NO_ENCONTRADA, { status: 404 })
    }
    if (!puedeGestionarDelMedico(e.perfil, cita.medico_id)) {
      return NextResponse.json({ error: 'sin_permisos' }, { status: 403 })
    }
    const { data, error } = await e.supabase.rpc('reserva_contacto_estado', {
      p_clinica_id: e.clinicaId, p_medico_id: cita.medico_id,
      p_tel_hmac: cita.reserva_tel_hmac, p_correo_hmac: cita.reserva_correo_hmac,
    })
    const fila: HistorialContacto | undefined = Array.isArray(data) ? data[0] : undefined
    if (error || !fila) {
      logger.error('agenda', `historial de reserva sin leer: ${error?.code ?? 'sin fila'}`)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    return NextResponse.json({ historial: fila }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    logger.error('agenda', `GET historial de reserva: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
