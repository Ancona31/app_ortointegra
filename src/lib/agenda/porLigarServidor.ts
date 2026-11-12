/**
 * src/lib/agenda/porLigarServidor.ts
 *
 * D6 y D7 · La cita POR LIGAR (nació de una reserva por enlace y aún no tiene
 * paciente) en `PUT` y `DELETE /api/appointments/[id]`, la parte de SERVIDOR.
 *
 * ⚠️ SÓLO CON EL INTERRUPTOR ENCENDIDO. Estas lecturas nombran
 * `reserva_canal`, que sin la migración 20261114120000 (D1) no existe: quien
 * llama las salta con v2 apagado, como hace con `tipo_cita_*` (convenio de
 * B6c). Apagado no hay reservas por el camino de la reserva
 * (`reservar_por_enlace` contesta «apagado»; prueba `d6_cita_por_ligar.sql`).
 *
 * ⚠️ CLIENTE DE SESIÓN y `clinica_id` explícito, nunca `createAdminClient()`.
 */
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

/**
 * ¿La cita está por ligar? `null` = no se pudo leer: quien llama contesta 500
 * y no escribe (falla cerrado: borrar o editar una cita por ligar como si
 * fuera un evento es justo lo que esto evita).
 */
export async function estaPorLigar(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('appointments').select('paciente_id, reserva_canal')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error || !data) {
    logger.error('agenda', `cita por ligar sin leer: ${error?.code ?? 'sin fila'}`)
    return null
  }
  return !data.paciente_id && Boolean(data.reserva_canal)
}
