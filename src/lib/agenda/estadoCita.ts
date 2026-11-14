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
 * ahí vuelve a valer todo. Cancelada y No asistió no se cierran: «Reagendar
 * cita» es justo cambiarles fecha y estado. `null` = se deja pasar.
 */
export function vetoPorEstado(
  antes: { status: string; start_time: string; end_time: string; all_day: boolean | null },
  cuerpo: { status?: unknown; start_time?: unknown; end_time?: unknown; all_day?: unknown },
): string | null {
  if (antes.status !== 'attended') return null
  if (cuerpo.status === 'confirmed' || cuerpo.status === 'cancelled') return 'Una cita atendida ya concluyó: no se puede confirmar ni cancelar.'
  const mueve = (nuevo: unknown, viejo: string): boolean =>
    typeof nuevo === 'string' && new Date(nuevo).getTime() !== new Date(viejo).getTime()
  const cambiaDia = cuerpo.all_day !== undefined && (cuerpo.all_day === true) !== (antes.all_day === true)
  if (mueve(cuerpo.start_time, antes.start_time) || mueve(cuerpo.end_time, antes.end_time) || cambiaDia) {
    return 'Una cita atendida ya concluyó: no se puede cambiar de fecha ni de hora.'
  }
  return null
}
