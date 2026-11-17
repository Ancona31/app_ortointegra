/**
 * eleccionPaciente.ts — el candado sobre lo que el paciente ELIGIÓ al
 * reservar por enlace (tanda I, punto 9 de Angel). Puro: lo usan el servidor
 * (`PUT /api/appointments/[id]`) y la pantalla (formulario y arrastre), con la
 * MISMA regla que la base (`cita_proteger_eleccion`, migración
 * `20261121121000`):
 *
 *   · una cita reservada por enlace (`reserva_canal`) que todavía no empieza;
 *   · el MÉDICO no se cambia nunca (si lo atenderá otro, se cancela y se
 *     reserva con el otro);
 *   · el CONSULTORIO, el DÍA y la HORA de inicio sólo con «Reagendar», que
 *     pide confirmación y avisa al paciente (`POST …/[id]/reagendar`);
 *   · la DURACIÓN es libre: el fin se mueve, el inicio no.
 * Vale también después de ligarla a un paciente (`reserva_canal` se queda).
 * Sólo con la v2 encendida: quien llama lo decide (apagada, como antes).
 */

export interface FilaEleccion {
  reserva_canal?: string | null
  start_time: string
  medico_id: string | null
  consultorio_id?: string | null
  all_day?: boolean | null
}

/** Lo que pide cambiar una edición. Ausente = no lo toca. */
export interface CambioEleccion {
  start_time?: string
  medico_id?: string | null
  consultorio_id?: string | null
  all_day?: boolean | null
}

export type VetoEleccion = { campo: 'medico' | 'reagendar'; mensaje: string }

export const TEXTO_ELECCION = {
  medico: 'El médico de una cita reservada por enlace no se cambia. Si la atenderá otro médico, cancélala y reserva con él.',
  reagendar: 'El consultorio, el día y la hora de una cita reservada por enlace sólo se cambian con «Reagendar», que avisa al paciente.',
  /** La línea del formulario: por qué esos campos están deshabilitados. */
  formulario: 'El paciente eligió médico, consultorio, día y hora al reservar por enlace. Para cambiarlos usa «Reagendar», que le avisa; la duración sí puedes ajustarla.',
} as const

const instante = (v: string): number => new Date(v).getTime()

/** ¿Está en pie el candado? Reservada por enlace y su inicio todavía no llega. */
export function eleccionFija(fila: Pick<FilaEleccion, 'reserva_canal' | 'start_time'>, ahora: number): boolean {
  return Boolean(fila.reserva_canal) && instante(fila.start_time) > ahora
}

/** El veto (o null) de una edición sobre una cita con el candado en pie. Reescribir el mismo valor no cuenta. */
export function vetoPorEleccion(fila: FilaEleccion, cambio: CambioEleccion, ahora: number): VetoEleccion | null {
  if (!eleccionFija(fila, ahora)) return null
  if (cambio.medico_id !== undefined && (cambio.medico_id || null) !== fila.medico_id) {
    return { campo: 'medico', mensaje: TEXTO_ELECCION.medico }
  }
  const mueveInicio = cambio.start_time !== undefined && instante(cambio.start_time) !== instante(fila.start_time)
  const cambiaConsultorio = cambio.consultorio_id !== undefined && (cambio.consultorio_id || null) !== (fila.consultorio_id ?? null)
  const cambiaTodoElDia = cambio.all_day !== undefined && cambio.all_day !== null && cambio.all_day !== (fila.all_day === true)
  return mueveInicio || cambiaConsultorio || cambiaTodoElDia ? { campo: 'reagendar', mensaje: TEXTO_ELECCION.reagendar } : null
}
