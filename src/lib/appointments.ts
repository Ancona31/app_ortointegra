/**
 * Forma canonica de una cita tal como la consume el calendario.
 * GET, POST y PUT deben devolver exactamente esta forma: el cliente
 * re-hidrata su estado desde la respuesta, asi que cualquier campo que
 * falte aqui se queda obsoleto en la UI hasta que el usuario recargue.
 */
export const APPOINTMENT_SELECT =
  '*, pacientes(id, nombre, apellidos, telefono), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)'

/** El paciente tal como llega dentro de una cita de `APPOINTMENT_SELECT`. */
export type PacienteEnCita = { nombre: string; apellidos: string } | null

/**
 * Titulo del evento en el calendario propio de Spinus.
 *
 * PRIVACIDAD — el calendario es de la app, no el `primary` del medico, y el
 * aviso de privacidad declara que Google recibe nombre del paciente y horario.
 * Lo que NO sale: diagnostico, motivo de consulta, notas ni nada clinico.
 */
export function tituloParaGoogle(
  p: { nombre: string; apellidos: string } | null,
  fallback: string,
): string {
  return p ? `${p.nombre} ${p.apellidos}` : fallback
}
