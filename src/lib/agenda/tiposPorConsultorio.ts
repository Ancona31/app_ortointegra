/**
 * src/lib/agenda/tiposPorConsultorio.ts
 *
 * G2 (punto 7 de Angel) · Qué tipos de cita valen en UN consultorio y cuál es
 * «la» duración de la consulta de un médico allí. Módulo aparte de
 * `tiposCita.ts` porque aquél trae Zod en valor y esto lo usan el modal y la
 * agenda, que se cuidan de no cargarlo (nota B6c de `AppointmentModal`).
 *
 * ⚠️ MÓDULO PURO: sin `'use client'`, sin Supabase, sin Zod.
 */

/** Lo que hace falta de un tipo para saber dónde vale (vale para la fila y
 *  para el contexto de la reserva, que no trae `medico_id`). */
export interface AmbitoTipo {
  principal?: boolean | null
  consultorio_id?: string | null
}

/**
 * G2 · Los tipos que valen en UN consultorio, de una lista YA FILTRADA a un
 * médico (`tipoCompatible`, o el contexto de la reserva, que sólo trae los
 * del médico del enlace). Valen los generales; un principal POR CONSULTORIO
 * vale sólo en el suyo y allí SUSTITUYE al principal general. Sin
 * consultorio (`null`), sólo los generales. Una lista sin las columnas de G2
 * (migración sin aplicar) sale igual que entra.
 *
 * ⚠️ UNA SOLA REGLA: la usan la reserva por enlace (contexto, turnos y POST,
 * antes de `reservar_por_enlace`, que no mira el consultorio del tipo), el
 * selector del modal y el ajuste al turno de la agenda.
 */
export function tiposDelConsultorio<T extends AmbitoTipo>(tipos: readonly T[], consultorioId: string | null): T[] {
  const aqui = tipos.filter(t => (t.consultorio_id ?? null) === null || t.consultorio_id === consultorioId)
  const propio = consultorioId !== null && aqui.some(t => t.principal === true && t.consultorio_id === consultorioId)
  return aqui.filter(t => !(propio && t.principal === true && (t.consultorio_id ?? null) === null))
}

/**
 * G2 · La duración de la consulta de un médico en un consultorio, de una lista
 * ya filtrada a ese médico: la de su principal allí (el del consultorio, o si
 * no el general); sin principal, la del único tipo que valga allí; si no,
 * `null` (no se sabe cuál es «la» duración).
 */
export function duracionDeConsulta(tipos: readonly (AmbitoTipo & { duracion_min: number })[], consultorioId: string | null): number | null {
  const aqui = tiposDelConsultorio(tipos, consultorioId)
  const principal = aqui.find(t => t.principal === true)
  if (principal) return principal.duracion_min
  return aqui.length === 1 ? aqui[0]?.duracion_min ?? null : null
}
