/**
 * src/lib/agenda/porLigarServidor.ts
 *
 * D6 y D7 · La cita POR LIGAR (nació de una reserva por enlace y aún no tiene
 * paciente) en `PUT` y `DELETE /api/appointments/[id]`, la parte de SERVIDOR:
 * reconocerla (D6) y ligarla a un paciente (D7).
 *
 * ⚠️ SÓLO CON EL INTERRUPTOR ENCENDIDO. Estas lecturas nombran
 * `reserva_canal`, que sin la migración 20261114120000 (D1) no existe: quien
 * llama las salta con v2 apagado, como hace con `tipo_cita_*` (convenio de
 * B6c). Apagado no hay reservas por el camino de la reserva
 * (`reservar_por_enlace` contesta «apagado»; prueba `d6_cita_por_ligar.sql`).
 *
 * ⚠️ CLIENTE DE SESIÓN y `clinica_id` explícito, nunca `createAdminClient()`
 * (la auditoría del ligado va por `logAudit`, el camino de siempre).
 */
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import type { PacienteEnCita } from '@/lib/appointments'

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

/**
 * D7 · El paciente con el que se liga existe en ESTA clínica y quien liga lo
 * ve (RLS de `pacientes`: el invitado sólo los suyos). La FK de
 * `appointments.paciente_id` no mira la clínica. `null` = no se pudo leer.
 */
export async function pacienteVisible(supabase: ClienteSesion, clinicaId: string, pacienteId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('pacientes').select('id')
    .eq('id', pacienteId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) {
    logger.error('agenda', `paciente para ligar sin leer: ${error.code ?? ''}`)
    return null
  }
  return Boolean(data)
}

/**
 * D7 · `cita_ligada`: la cita por ligar quedó ligada a un paciente. SÓLO
 * NOMBRES DE CAMPO, nunca valores (ni el paciente, ni el nombre de quien
 * reservó): `registro_id` es la cita, y el disparador de B0 deja además su
 * `cita_editada` con los campos. Los datos de contacto de la reserva se quedan
 * en la cita (lista A, punto 9), por eso no aparecen aquí.
 */
export async function auditarLigado(a: { userId: string; clinicaId: string; citaId: string; campos: readonly string[] }): Promise<void> {
  await logAudit({
    userId: a.userId,
    accion: 'cita_ligada',
    tabla: 'appointments',
    registroId: a.citaId,
    descripcion: JSON.stringify({ clinica: a.clinicaId, campos: a.campos, via: 'ligar' }),
  })
}

/**
 * D7 · El «paciente» con el que se compone el evento de Google de una cita.
 * Ligada o con paciente: el suyo, como siempre. POR LIGAR y con v2: el nombre
 * de quien reservó con apellidos vacíos, el MISMO convenio que el espejo de
 * Google de D4 (`gcal_citas_por_evento`), para que una edición desde Spinus
 * deje en Google «Cita médica: <nombre>» y el sondeo no lo vuelva a
 * restablecer. Sin v2, o un evento sin reserva: `null`, como hoy.
 * `fila` llega sin tipar de PostgREST: se comprueba, no se le cree.
 */
export function pacienteParaGoogle(
  fila: { pacientes?: PacienteEnCita; paciente_id?: unknown; reserva_canal?: unknown; reserva_nombre?: unknown },
  v2: boolean,
): PacienteEnCita {
  if (fila.pacientes) return fila.pacientes
  if (!v2 || fila.paciente_id || typeof fila.reserva_canal !== 'string') return null
  return typeof fila.reserva_nombre === 'string' && fila.reserva_nombre.trim() !== ''
    ? { nombre: fila.reserva_nombre, apellidos: '' }
    : null
}
