/**
 * eleccionServidor.ts — la parte de SERVIDOR del candado sobre lo que eligió
 * el paciente al reservar por enlace (tanda I, punto 9; la regla pura está en
 * `eleccionPaciente.ts` y la de la base en `cita_proteger_eleccion`).
 *
 *   · `filaEleccion`: lo que el PUT necesita y no lee (`reserva_canal` y el
 *     consultorio). CLIENTE DE SESIÓN, con `clinica_id`. Sólo con la v2
 *     encendida (nombra `reserva_canal`, columna de D1).
 *   · `reagendarCita`: «Reagendar» de la clínica, por
 *     `cita_reagendar_clinica` (SÓLO service_role: la base no deja mover esas
 *     columnas a la sesión). ⚠️ `createAdminClient()` SÓLO PARA `.rpc()`, con
 *     `p_clinica_id` = la clínica de la SESIÓN y `p_actor` = quien la pide
 *     (la base repite con él la regla de `appointments_update`). Es la cuarta
 *     excepción anotada a «sólo cliente de sesión» de la agenda v2.
 */
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import { logger } from '@/lib/logger'

const CODIGOS_AUSENTE = new Set(['PGRST202', '42883', '42P01', 'PGRST205'])

/** `null` = no se pudo leer (quien llama contesta 500 y no escribe: falla cerrado). */
export async function filaEleccion(supabase: ClienteSesion, clinicaId: string, citaId: string):
  Promise<{ reserva_canal: string | null; consultorio_id: string | null } | null> {
  const { data, error } = await supabase.from('appointments').select('reserva_canal, consultorio_id')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error || !data) {
    logger.error('agenda', `cita por enlace sin leer: ${error?.code ?? 'sin fila'}`)
    return null
  }
  return { reserva_canal: data.reserva_canal ?? null, consultorio_id: data.consultorio_id ?? null }
}

export const RESULTADOS_REAGENDAR = [
  'ok', 'sin_cambio', 'apagado', 'sin_permiso', 'no_aplica', 'estado_no_admite', 'pasada', 'modificada', 'hora_pasada',
  'consultorio_invalido',
] as const
export type ResultadoReagendar = (typeof RESULTADOS_REAGENDAR)[number]

const FilaSchema = z.object({ r_resultado: z.enum(RESULTADOS_REAGENDAR), r_updated_at: z.string().nullable() })

export interface Reagendo {
  clinicaId: string
  actorId: string
  citaId: string
  consultorioId: string
  inicio: string
  fin: string
  /** El `updated_at` que vio la pantalla; null = sin comprobar. */
  esperado: string | null
}

/** «Reagendar» en la base. `ausente` = sin la migración; `error` = otro fallo (al log, sólo el código). */
export async function reagendarCita(r: Reagendo):
  Promise<{ tipo: 'hecho'; resultado: ResultadoReagendar; updatedAt: string | null } | { tipo: 'ausente' } | { tipo: 'error' }> {
  const { data, error } = await createAdminClient().rpc('cita_reagendar_clinica', {
    p_clinica_id: r.clinicaId, p_actor: r.actorId, p_cita_id: r.citaId, p_consultorio_id: r.consultorioId,
    p_inicio: r.inicio, p_fin: r.fin, p_esperado: r.esperado,
  }).single()
  if (error) {
    logger.error('agenda', `cita_reagendar_clinica falló: ${error.code ?? 'sin código'}`)
    return error.code && CODIGOS_AUSENTE.has(error.code) ? { tipo: 'ausente' } : { tipo: 'error' }
  }
  const p = FilaSchema.safeParse(data)
  if (!p.success) {
    logger.error('agenda', 'cita_reagendar_clinica: forma inesperada')
    return { tipo: 'error' }
  }
  return { tipo: 'hecho', resultado: p.data.r_resultado, updatedAt: p.data.r_updated_at }
}
