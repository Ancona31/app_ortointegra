/**
 * src/lib/agenda/estadoCita.ts — G3 (punto 17.3 de la tanda de diseño) · lo
 * que el servidor rechaza por el ESTADO de la cita. Puro y sin dependencias de
 * cliente: lo importa `PUT /api/appointments/[id]`. La tarjeta (que ya no
 * ofrece esas acciones) vive en `accionesTarjeta.ts`.
 */

/**
 * G3 (punto 17.3) · Lo que el SERVIDOR rechaza por el estado, con la agenda
 * v2 encendida (`PUT /api/appointments/[id]`): una cita ATENDIDA ya concluyó,
 * así que no se confirma, no se cancela y no se cambia de fecha ni de hora.
 * Lo demás de una atendida se sigue pudiendo editar desde el formulario
 * (notas, consultorio…) y su estado se puede CORREGIR a «Agendada» o «No
 * asistió» —lo que hoy se hace en el modal cuando se marcó por error—; desde
 * ahí vuelve a valer todo (si no tiene nota clínica: `vetoPorNotaLigada`).
 * Cancelada y No asistió no se cierran aquí: el formulario ya permitía antes
 * de G3 corregir su estado; «Reagendar cita» crea otra cita y no las toca.
 * `null` = se deja pasar.
 */
export function vetoPorEstado(
  antes: { status: string; start_time: string; end_time: string; all_day: boolean | null },
  cuerpo: { status?: unknown; start_time?: unknown; end_time?: unknown; all_day?: unknown },
): string | null {
  if (antes.status !== 'attended') return null
  if (cuerpo.status === 'confirmed' || cuerpo.status === 'cancelled') return 'Una cita atendida ya concluyó: no se puede confirmar ni cancelar.'
  if (mueveCita(antes, cuerpo)) return 'Una cita atendida ya concluyó: no se puede cambiar de fecha ni de hora.'
  return null
}

/** ¿El cuerpo mueve la cita (inicio, fin, o entrar o salir de todo el día)? Comparado por instante. */
export function mueveCita(
  antes: { start_time: string; end_time: string; all_day: boolean | null },
  cuerpo: { start_time?: unknown; end_time?: unknown; all_day?: unknown },
): boolean {
  const mueve = (nuevo: unknown, viejo: string): boolean =>
    typeof nuevo === 'string' && new Date(nuevo).getTime() !== new Date(viejo).getTime()
  const cambiaDia = cuerpo.all_day !== undefined && (cuerpo.all_day === true) !== (antes.all_day === true)
  return mueve(cuerpo.start_time, antes.start_time) || mueve(cuerpo.end_time, antes.end_time) || cambiaDia
}

/** El HINT del 42501 de `cita_proteger_atendida()` (20261120130000 y 20261121140000), tal cual. */
export const HINT_ATENDIDA_CON_NOTA = 'La nota es expediente: la cita se queda como atendida'

type AntesNota = { status: string; start_time: string; end_time: string; all_day: boolean | null }
type CuerpoNota = { status?: unknown; start_time?: unknown; end_time?: unknown; all_day?: unknown }

function cambiaEstado(antes: { status: string }, cuerpo: { status?: unknown }): boolean {
  return typeof cuerpo.status === 'string' && cuerpo.status !== antes.status
}

/** ¿Hay que mirar si tiene nota? Sólo si es atendida y el cuerpo cambia su estado o la mueve. */
export function pideComprobarNota(antes: AntesNota, cuerpo: CuerpoNota): boolean {
  return antes.status === 'attended' && (cambiaEstado(antes, cuerpo) || mueveCita(antes, cuerpo))
}

/**
 * G3 · Decisión de Angel (2026-11-14): una cita ATENDIDA con una nota clínica
 * ligada (`consultas.appointment_id`) no puede pasar a NINGÚN otro estado; sin
 * nota sí, para corregir un error. Tanda I (punto 1 de Angel): tampoco se MUEVE
 * de fecha u hora (ni entra o sale de todo el día). Aplica SIEMPRE, con la v2
 * encendida o apagada: la nota es expediente (NOM-004, integridad); la base
 * dice lo mismo (`cita_proteger_atendida`, 20261121140000). Pura: quien llama
 * dice si hay nota (`notaLigadaServidor.ts`) y sólo lo pregunta cuando hace
 * falta (`pideComprobarNota`). `null` = se deja pasar.
 */
export function vetoPorNotaLigada(antes: AntesNota, cuerpo: CuerpoNota, tieneNota: boolean): string | null {
  if (!tieneNota || !pideComprobarNota(antes, cuerpo)) return null
  if (cambiaEstado(antes, cuerpo)) return 'Esta cita ya tiene una nota clínica: sigue como atendida y no puede cambiar de estado.'
  return 'Esta cita ya tiene una nota clínica: sigue como atendida y no se puede cambiar de fecha ni de hora.'
}
