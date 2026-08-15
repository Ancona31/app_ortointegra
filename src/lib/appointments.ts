/**
 * Forma canonica de una cita tal como la consume el calendario.
 * GET, POST y PUT deben devolver exactamente esta forma: el cliente
 * re-hidrata su estado desde la respuesta, asi que cualquier campo que
 * falte aqui se queda obsoleto en la UI hasta que el usuario recargue.
 */
export const APPOINTMENT_SELECT =
  '*, pacientes(id, nombre, apellidos, telefono), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)'
