/**
 * reagendarConfirmacion.ts — «Elegir otro horario» en la página de «no podré
 * asistir» (agenda E6, §2 «Reagendar»). SÓLO SERVIDOR.
 *
 * Tras cancelar por el enlace, la página pregunta a la base si se ofrece
 * reagendar (`cita_reagendar_oferta`, STABLE: un GET no escribe) y, si sí,
 * lleva al ENLACE FIJO del médico de D (`/reservar/<fijo>?origen=<código de
 * confirmación>`): la reserva sigue el flujo de D entero (código al correo,
 * candado, «1 activa») y la ruta de D5 llama a `reagendar_por_enlace`.
 *
 * El enlace fijo sólo se ofrece si ABRE de verdad (`abrirEnlace`: secreto,
 * aviso publicable y aprobado, interruptor, puerta S3, médico en la
 * clínica) y tiene consultorios y tipos; si no, «comunícate al teléfono».
 *
 * ⚠️ CLIENTE DE SERVICIO SÓLO PARA `.rpc()`; la clínica sale del contexto del
 * enlace de confirmación (por el hash), nunca de la petición. Tolerante: RPC
 * ausente o error = sin oferta (la página dice «comunícate»).
 */
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { codigoDeEnlace } from '@/lib/reserva/secretos'
import { abrirEnlace } from '@/lib/reserva/puertaReserva'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'

/** Lo que la página enseña después de cancelar. */
export type OfertaReagendar =
  | { tipo: 'enlace'; href: string }
  | { tipo: 'ya_reagendada' }
  | { tipo: 'comunicate' }

const OfertaSchema = z.object({ r_enlace_id: z.guid().nullable(), r_motivo: z.string() })

async function motivo(ctx: ContextoConfirmacion): Promise<z.infer<typeof OfertaSchema> | null> {
  try {
    const { data, error } = await createAdminClient()
      .rpc('cita_reagendar_oferta', { p_clinica_id: ctx.clinica_id, p_codigo_hash: ctx.codigo_hash })
      .single()
    if (error) {
      logger.warn('confirmacion', `cita_reagendar_oferta no disponible: ${error.code ?? 'sin código'}`)
      return null
    }
    const p = OfertaSchema.safeParse(data)
    return p.success ? p.data : null
  } catch {
    logger.error('confirmacion', 'cita_reagendar_oferta lanzó')
    return null
  }
}

/**
 * La oferta para una cita que el paciente canceló por su enlace (`codigo` es
 * el de confirmación). null si no aplica (no está cancelada por el paciente):
 * la página enseña lo de siempre.
 */
export async function ofertaReagendar(ctx: ContextoConfirmacion, codigo: string): Promise<OfertaReagendar | null> {
  if (ctx.estado !== 'cancelada' || ctx.respuesta !== 'cancelo') return null
  const m = await motivo(ctx)
  if (!m) return { tipo: 'comunicate' }
  if (m.r_motivo === 'ya_reagendada') return { tipo: 'ya_reagendada' }
  if (m.r_motivo !== 'ok' || !m.r_enlace_id) return { tipo: 'comunicate' }
  const fijo = codigoDeEnlace(m.r_enlace_id)
  const abierto = fijo ? await abrirEnlace(fijo) : null
  if (!fijo || !abierto || abierto.ctx.clinica_id !== ctx.clinica_id || abierto.ctx.estado !== 'vigente'
      || abierto.ctx.consultorios.length === 0 || abierto.ctx.tipos.length === 0) {
    return { tipo: 'comunicate' }
  }
  return { tipo: 'enlace', href: `/reservar/${fijo}?origen=${codigo}` }
}
