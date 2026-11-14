/**
 * src/lib/agenda/horarioRejilla.ts
 *
 * Qué horario pinta la rejilla de la agenda y usan los avisos de fuera de
 * horario (tanda T2, punto 10 de Angel). Antes: siempre el de la clínica,
 * mientras que el enlace de reserva ofrecía el del consultorio (B5), y los dos
 * podían contradecirse. Ahora, con la agenda v2 encendida, el del CONSULTORIO
 * ACTIVO cuando tiene horario propio; si no, el de la clínica, que es la
 * plantilla.
 *
 * «El consultorio activo» en la agenda (decisión anotada en §6-bis de la
 * tanda): la agenda no tiene selector de consultorio, así que sólo hay uno
 * cuando la rejilla enseña a UN médico (el filtro puesto, el médico invitado,
 * o la clínica de un solo médico), y entonces:
 *   1. el «consultorio activo» de la app (`ConsultorioActivoContext`, el que se
 *      elige en el menú lateral) si es de ese médico;
 *   2. si no, el único consultorio activo de ese médico, si tiene uno solo;
 *   3. si tiene varios y ninguno elegido, o con «Todos los médicos»: ninguno,
 *      y manda el de la clínica (lo que menos cambia lo de hoy).
 *
 * ⚠️ APAGADA, LO DE HOY AL BIT: `horarioClinica ?? HORARIO_DEFAULT`, el mismo
 * objeto (no una copia), para no cambiar la identidad que recibe FullCalendar
 * (invariante A1-bis) ni lo que pinta.
 *
 * ⚠️ MÓDULO PURO: sin `'use client'`, sin Supabase.
 */
import type { Horario } from '@/lib/configApp'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { horarioEfectivo, type ConsultorioDisponibilidad } from '@/lib/agenda/disponibilidad'

/** Lo que hace falta de un consultorio. */
export interface ConsultorioRejilla extends ConsultorioDisponibilidad {
  id: string
  medico_id: string
  activo?: boolean | null
}

export interface EntradaRejilla {
  agendaV2: boolean
  horarioClinica: Horario | null | undefined
  /** Los consultorios que ve quien mira (RLS: los suyos; la secretaria, todos). */
  consultorios: readonly ConsultorioRejilla[]
  /** El consultorio activo de la app, o `null`. */
  consultorioActivo: ConsultorioRejilla | null
  /** El médico que enseña la rejilla, o `null` si son todos o aún no se sabe. */
  medicoMostrado: string | null
}

/** El consultorio de la rejilla según las tres reglas de la cabecera, o `null`. */
export function consultorioDeLaRejilla(e: Omit<EntradaRejilla, 'agendaV2' | 'horarioClinica'>): ConsultorioRejilla | null {
  if (!e.medicoMostrado) return null
  const activo = e.consultorioActivo
  if (activo && activo.medico_id === e.medicoMostrado && activo.activo !== false) return activo
  const suyos = e.consultorios.filter(c => c.medico_id === e.medicoMostrado && c.activo !== false)
  return suyos.length === 1 ? suyos[0] : null
}

/** El horario de la rejilla y de los avisos de fuera de horario. */
export function horarioDeLaRejilla(e: EntradaRejilla): Horario {
  const clinica = e.horarioClinica ?? HORARIO_DEFAULT
  if (!e.agendaV2) return clinica
  const c = consultorioDeLaRejilla(e)
  return c?.horario_propio === true ? horarioEfectivo(c, e.horarioClinica ?? null) : clinica
}
