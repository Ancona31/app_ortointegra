/**
 * src/lib/agenda/accionesTarjeta.ts
 *
 * Lo puro de la tarjeta de lectura (bloque F, F3.2, detrás del interruptor):
 * qué acciones ofrece cada cita y qué se lee en ella. El componente es
 * `TarjetaLectura.tsx`; este archivo NO se llama `tarjetaLectura.ts` a
 * propósito, porque dos nombres que sólo se distinguen por la mayúscula no
 * compilan en macOS ni en Windows (CLAUDE.md, «Estilo de código»).
 *
 * Reglas (diseño F §3.2 y decisión 20):
 *   · Evento sin paciente: «Editar» y «Eliminar» (eliminar SÓLO aquí: una cita
 *     con paciente se cancela, no se borra — P2).
 *   · Cita (con paciente o por ligar):
 *       – «Iniciar consulta», la acción principal, si el llamador dice que se
 *         puede (las mismas condiciones que el modal: puede ver expedientes, es
 *         su cita y el consultorio existe). En una por ligar abre el modal,
 *         donde vive el ligado (D7); eso lo decide el llamador.
 *       – «Confirmar» sólo si está agendada.
 *       – «Reagendar» y «Cancelar» mientras esté agendada o confirmada: una
 *         cita atendida, cancelada o con inasistencia ya pasó por su estado y no
 *         se mueve ni se cancela desde aquí (desde «Editar», sí, como hoy).
 *       – «Editar» siempre: es el modal de hoy, entero.
 *   · Los bloques de Google no abren nada (los filtra `abrirCita` antes).
 */
import type { Appointment, Status } from '@/lib/agenda/tiposAgenda'
import { esEventoGenerico, esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { horaEnTZ } from '@/lib/agenda/fechasAgenda'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'

export type AccionTarjeta = 'iniciar-consulta' | 'confirmar' | 'reagendar' | 'cancelar' | 'editar' | 'eliminar'

export const ETIQUETA_ACCION: Record<AccionTarjeta, string> = {
  'iniciar-consulta': 'Iniciar consulta',
  confirmar: 'Confirmar',
  reagendar: 'Reagendar',
  cancelar: 'Cancelar cita',
  editar: 'Editar',
  eliminar: 'Eliminar evento',
}

const VIVAS: readonly Status[] = ['scheduled', 'confirmed']

/** Lo que mira la tarjeta de la fila. */
export type CitaTarjeta = Pick<Appointment, 'status' | 'paciente_id' | 'reserva_canal'>

/**
 * Las acciones de la cita, en el orden en que se pintan (la principal primero).
 * `conConfirmar: false` la quita aunque la cita esté agendada: el enchufe la
 * apaga mientras `guardadoCitas` no exponga `cambiarEstadoCita` (`contratosV2.ts`).
 */
export function accionesDeTarjeta(cita: CitaTarjeta, puedeIniciarConsulta: boolean, conConfirmar = true): AccionTarjeta[] {
  if (esEventoGenerico(cita)) return ['editar', 'eliminar']
  const acciones: AccionTarjeta[] = []
  if (puedeIniciarConsulta) acciones.push('iniciar-consulta')
  if (conConfirmar && cita.status === 'scheduled') acciones.push('confirmar')
  if (VIVAS.includes(cita.status)) acciones.push('reagendar', 'cancelar')
  acciones.push('editar')
  return acciones
}

/** Quién mira, para decidir «Iniciar consulta». */
export interface QuienMira { esMedico: boolean; perfilId: string | null; consultorioExiste: boolean }

/**
 * ¿Sale «Iniciar consulta»? LAS MISMAS CONDICIONES QUE EL MODAL
 * (`showIniciarConsulta` y, en una por ligar, `showLigarYConsultar` de D7):
 * quien mira es médico, la cita es SUYA, su consultorio está en su lista, y hay
 * paciente o es una por ligar. Un evento sin paciente, nunca. Si el modal
 * cambia sus condiciones, éstas cambian con él.
 */
export function puedeIniciarConsulta(
  cita: Pick<Appointment, 'pacientes' | 'paciente_id' | 'reserva_canal' | 'medico_id'>, quien: QuienMira,
): boolean {
  if (!quien.esMedico || !quien.perfilId || cita.medico_id !== quien.perfilId || !quien.consultorioExiste) return false
  return Boolean(cita.pacientes) || esPorLigar(cita)
}

/** ¿Pide confirmación antes de hacerse? Cancelar y eliminar, sí (decisión 20). */
export function pideConfirmacion(accion: AccionTarjeta): boolean {
  return accion === 'cancelar' || accion === 'eliminar'
}

/** El mensaje del aviso de las dos acciones que preguntan (`pideConfirmacion`). */
export function textoDeConfirmacion(
  accion: AccionTarjeta, cita: Pick<Appointment, 'title' | 'pacientes' | 'reserva_nombre' | 'paciente_id' | 'reserva_canal'>,
): string {
  if (accion === 'eliminar') return `¿Eliminar el evento «${cita.title}»? No se puede deshacer.`
  return `¿Cancelar la cita de ${nombreDeTarjeta(cita)}? El horario queda libre y la cita se queda en la agenda como cancelada.`
}

/** El nombre que se lee arriba: el paciente, quien reservó o el título del evento. */
export function nombreDeTarjeta(cita: Pick<Appointment, 'title' | 'pacientes' | 'reserva_nombre' | 'paciente_id' | 'reserva_canal'>): string {
  if (cita.pacientes) return `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`.trim()
  if (esPorLigar(cita) && cita.reserva_nombre) return cita.reserva_nombre
  return cita.title
}

/** El teléfono de contacto: el de la ficha o el que dejó quien reservó. */
export function telefonoDeTarjeta(cita: Pick<Appointment, 'pacientes' | 'reserva_telefono'>): string | null {
  return cita.pacientes?.telefono ?? cita.reserva_telefono ?? null
}

/**
 * El tramo en la hora de quien mira y, si el consultorio está en otra zona y
 * la hora de pared difiere, la del consultorio aparte. Mismo criterio que el
 * aviso de la tarjeta de la rejilla (`renderEventContent`, F3-6e): se comparan
 * HORAS resultantes, no nombres IANA, porque las zonas mexicanas de UTC-6 son
 * distintas en IANA y dan la misma hora.
 */
export function horarioDeTarjeta(
  cita: Pick<Appointment, 'start_time' | 'end_time' | 'consultorio_timezone'>,
  zonaVisor: string,
): { tramo: string; enConsultorio: string | null } {
  const tramo = `${horaEnTZ(cita.start_time, zonaVisor)}–${horaEnTZ(cita.end_time, zonaVisor)}`
  const zona = cita.consultorio_timezone
  if (!zona) return { tramo, enConsultorio: null }
  const inicio = horaEnTZ(cita.start_time, zona)
  if (!inicio || inicio === horaEnTZ(cita.start_time, zonaVisor)) return { tramo, enConsultorio: null }
  return { tramo, enConsultorio: `${inicio}–${horaEnTZ(cita.end_time, zona)} hora ${regionDeTimezone(zona)}` }
}
