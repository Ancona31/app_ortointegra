/**
 * /api/agenda/reservas/contactos — los contactos bloqueados de la reserva por
 * enlace (candado de §2; la parte de D2 que quedó pendiente).
 *   · GET  la lista de bloqueados (`reserva_contactos_bloqueados()`).
 *   · POST `{cita_id, accion:'bloquear'|'desbloquear'}` bloquea o desbloquea a
 *     mano a la persona que reservó esa cita (`reserva_contacto_marcar`), con
 *     ese médico. Desbloquear descuenta las incidencias anteriores (D2).
 *
 * Puertas comunes en `entradaGestion()` (401/403/404 con el interruptor
 * apagado). Permisos (lista A, punto 16): cada médico, los contactos de SUS
 * citas; administrador y secretaria, los de todos. Las dos funciones son
 * INVOKER y sólo de `authenticated`: deciden la RLS de `appointments` y de
 * `reserva_contactos` y el `get_clinica_id()` de la sesión. Aquí se repite el
 * permiso (403 antes de escribir) y se filtra la lista por médico.
 *
 * La auditoría la da `audit_reserva_contactos` (log_tabla_change).
 */
import { NextRequest, NextResponse } from 'next/server'
import { entradaGestion, leerCitaDeReserva } from '@/lib/reserva/gestionServidor'
import {
  MarcarContactoSchema, gestionaTodos, puedeGestionarDelMedico, type ContactoBloqueado,
} from '@/lib/reserva/gestionReserva'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const { data, error } = await e.supabase.rpc('reserva_contactos_bloqueados')
    if (error) {
      logger.error('agenda', `contactos bloqueados sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'No se pudieron leer los contactos bloqueados' }, { status: 500 })
    }
    const filas: ContactoBloqueado[] = data ?? []
    /* La función ya acota a la clínica de la sesión y a lo que la RLS deja
       ver; esto es la defensa en profundidad del punto 16. */
    const visibles = gestionaTodos(e.perfil) ? filas : filas.filter(f => f.medico_id === e.perfil.id)
    return NextResponse.json({ contactos: visibles }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    logger.error('agenda', `GET contactos bloqueados: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const parsed = MarcarContactoSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    const { cita_id, accion } = parsed.data
    const cita = await leerCitaDeReserva(e.supabase, e.clinicaId, cita_id)
    if (!cita) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    if (!puedeGestionarDelMedico(e.perfil, cita.medico_id)) {
      return NextResponse.json({ error: 'sin_permisos', mensaje: 'Sólo puedes gestionar los contactos de tus citas' }, { status: 403 })
    }
    const { data, error } = await e.supabase.rpc('reserva_contacto_marcar', { p_cita_id: cita_id, p_accion: accion })
    if (error) {
      const status = error.code === '42501' ? 403 : 500
      if (status === 500) logger.error('agenda', `contacto sin ${accion}: ${error.code ?? ''}`)
      return NextResponse.json({ error: status === 403 ? 'sin_permisos' : 'Error interno' }, { status })
    }
    if (typeof data !== 'number' || data === 0) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true, accion })
  } catch (err: unknown) {
    logger.error('agenda', `POST contactos: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
