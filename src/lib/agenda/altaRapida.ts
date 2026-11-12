/**
 * src/lib/agenda/altaRapida.ts
 *
 * Lo puro de la burbuja de alta rápida (bloque F, F3.1, detrás del
 * interruptor): qué duración propone, a qué médico y consultorio va, y el
 * `DatosGuardado` que manda a `handleSave` — CON LA MISMA FORMA que el alta de
 * una cita desde `AppointmentModal` (`guardar()`), para que el servidor, la
 * auditoría, el empalme (B7) y la invitación de Google no distingan de dónde
 * vino. Si el modal cambia la forma de su alta, esto cambia con él.
 *
 * Lo que la burbuja NO hace, a propósito (decisión 18): no crea eventos sin
 * paciente, no elige tipo de cita (B6: va por «Más opciones») y nunca crea una
 * cita por ligar (D).
 *
 * La CONSULTA de pacientes no vive aquí, aunque el diseño la pusiera en este
 * archivo: va en `buscarCitasPaciente.ts`, que la necesita también, y así éste
 * sigue sin red y se prueba sin simular Supabase.
 */
import type { DatosGuardado } from '@/lib/agenda/tiposAgenda'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import { DEFAULT_DURATION } from '@/lib/agenda/duracionCita'
import { componerIso } from '@/lib/agenda/fechasAgenda'

/** La franja de la rejilla (`slotDuration="00:30:00"` en `AgendaCliente`). */
export const MINUTOS_FRANJA = 30

/**
 * Los minutos que propone la burbuja. Más de una franja es un ARRASTRE y se
 * respeta lo arrastrado; un clic, una sola franja o un hueco del panel de Día
 * dan la duración por omisión (decisión 19). `desdeHueco` es la bandera
 * `seleccionDesdeHueco` que levanta `abrirHueco` antes de `api.select()`: sin
 * ella, un hueco de tres horas propondría tres horas.
 */
export function duracionDeSeleccion(inicio: Date, fin: Date | null, desdeHueco: boolean): number {
  if (desdeHueco || !fin) return DEFAULT_DURATION
  const minutos = Math.round((fin.getTime() - inicio.getTime()) / 60_000)
  /* En Semana se puede arrastrar de una columna a otra y la selección cruza la
     medianoche. La burbuja es de UNA cita en UN día: lo que no cabe en el día
     del inicio cae a la duración por omisión (y quien quiera otra cosa, «Más
     opciones»). La hora es la del navegador, que es la que usa FullCalendar. */
  const quedanEnElDia = 24 * 60 - (inicio.getHours() * 60 + inicio.getMinutes())
  return minutos > MINUTOS_FRANJA && minutos <= quedanEnElDia ? minutos : DEFAULT_DURATION
}

/** `HH:MM` + minutos, dentro del mismo día (se queda en 23:59 como mucho). */
export function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Un médico de la clínica, tal como lo lista la agenda. */
export interface MedicoAlta { id: string }

/**
 * El médico de la cita. Con el filtro en un médico, ése; con «Todos» y un solo
 * médico en la clínica, ése; con «Todos» y varios, `null`: la burbuja enseña
 * el selector y no deja guardar hasta que se elija.
 */
export function medicoPropuesto(filtro: string | null, medicos: readonly MedicoAlta[]): string | null {
  if (filtro) return filtro
  return medicos.length === 1 ? medicos[0].id : null
}

/** ¿La burbuja tiene que enseñar el selector de médico? */
export function necesitaElegirMedico(filtro: string | null, medicos: readonly MedicoAlta[]): boolean {
  return !filtro && medicos.length > 1
}

/** El consultorio activo de la sesión, tal como lo conoce la agenda. */
export interface ConsultorioAlta { id: string; medico_id: string | null }

/**
 * El consultorio de la cita: el activo, SI ES DEL MÉDICO. Si no lo es (o no hay
 * activo), `null`, y la burbuja obliga a pasar por «Más opciones», donde el
 * modal ya sabe elegir uno. Inventarse el primero de la lista sería agendar en
 * una sede que nadie eligió.
 */
export function consultorioPropuesto(activo: ConsultorioAlta | null, medicoId: string | null): string | null {
  if (!activo || !medicoId) return null
  return activo.medico_id === medicoId ? activo.id : null
}

export interface EntradaAltaRapida {
  fecha: string
  horaInicio: string
  horaFin: string
  paciente: PacienteBusqueda | null
  medicoId: string | null
  consultorioId: string | null
}

/** Por qué no se puede guardar todavía, en una frase; `null` si se puede. */
export function motivoParaNoGuardar(e: EntradaAltaRapida): string | null {
  if (!e.paciente) return 'Elige un paciente.'
  if (!e.medicoId) return 'Elige el médico.'
  if (!e.consultorioId) return 'El consultorio activo no es de este médico: usa «Más opciones».'
  if (!/^\d{2}:\d{2}$/.test(e.horaInicio) || !/^\d{2}:\d{2}$/.test(e.horaFin)) return 'Escribe la hora de inicio y de fin.'
  if (e.horaFin <= e.horaInicio) return 'La hora de fin tiene que ser posterior a la de inicio.'
  return null
}

/**
 * El alta, con la forma de `guardar()` de `AppointmentModal` para una CITA
 * nueva con hora: sin `id` ni `updated_at`, `all_day: false`, las dos puntas en
 * ISO, estado `scheduled`, el paciente en `paciente_id` y en `pacientes` (el
 * bloque optimista de `handleSave` lo pinta antes de que responda el servidor),
 * pinta en `null` y el consultorio siempre (en un alta viaja siempre).
 * `null` si falta algo: el llamador comprueba antes con `motivoParaNoGuardar`.
 */
export function datosDeAltaRapida(e: EntradaAltaRapida): DatosGuardado | null {
  if (motivoParaNoGuardar(e) !== null || !e.paciente) return null
  return {
    title: `${e.paciente.nombre} ${e.paciente.apellidos}`,
    all_day: false,
    start_time: componerIso(e.fecha, e.horaInicio),
    end_time: componerIso(e.fecha, e.horaFin),
    notes: null,
    status: 'scheduled',
    paciente_id: e.paciente.id,
    pacientes: e.paciente,
    icono: null,
    color: null,
    medico_id: e.medicoId,
    consultorio_id: e.consultorioId,
  }
}

const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

/** El nombre accesible de la burbuja: «Nueva cita · mié 11, 10:00–11:30». */
export function etiquetaBurbuja(fecha: string, horaInicio: string, horaFin: string): string {
  const dia = FORMATO_DIA.format(new Date(`${fecha}T12:00:00Z`)).replace(/[.,]/g, '')
  return `Nueva cita · ${dia}, ${horaInicio}–${horaFin}`
}
