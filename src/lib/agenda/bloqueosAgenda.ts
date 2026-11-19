/**
 * src/lib/agenda/bloqueosAgenda.ts
 *
 * K1 (tanda K, sección A) · El BLOQUEO DE HORARIO en la agenda: un periodo que
 * el médico cierra a propósito (`agenda_bloqueos`, migración 20261123120000).
 * NO es una cita ni un evento: no es una fila de `appointments`, no tiene
 * estado ni paciente, y en la rejilla se pinta como FONDO rayado, detrás de lo
 * que haya.
 *
 * ⚠️ MÓDULO NEUTRO (sin `'use client'` ni nada de servidor): lo usan la
 * traducción de la red, la semilla del servidor y la agenda.
 *
 * ⚠️⚠️ LOS DATOS DEL BLOQUEO VAN ANIDADOS EN `extendedProps.bloqueo`, NUNCA
 * SUELTOS. Media agenda lee `extendedProps` como si fuera una cita
 * (`medico_id`, `status`, `all_day`…): con un `medico_id` suelto, el bloqueo
 * contaría como empalme (`tramoDePintado`) y en el conteo de citas. Anidado,
 * esos lectores no ven nada y quien sí debe verlo pregunta con `bloqueoDe`.
 */
import type { EventInput } from '@fullcalendar/core'
import { diaEnZonaDelConsultorio } from '@/lib/agenda/fechasAgenda'

/** Una fila de `agenda_bloqueos` tal como la lee la agenda (sin columnas de Google). */
export interface BloqueoAgenda {
  id: string
  medico_id: string
  inicio: string
  fin: string
  todo_el_dia: boolean
  zona: string | null
  motivo: string | null
}

/** Con qué se abre el modal del bloqueo al crearlo. Desde L1 (punto 8) sólo lo abre
 *  el candado, con `{ fecha, hora: null, medicoId }`; el fin y `todoElDia` se
 *  conservan porque `camposIniciales` los sabe leer (se retiran con su último uso). */
export interface AperturaBloqueo {
  fecha: string
  hora: string | null
  fechaFin?: string
  horaFin?: string
  todoElDia?: boolean
  medicoId: string | null
}

/** Las columnas que se piden: nada de Google ni de autoría. */
export const BLOQUEO_SELECT = 'id, medico_id, inicio, fin, todo_el_dia, zona, motivo'

/** Prefijo del id del evento: nunca choca con el uuid de una cita. */
export const PREFIJO_BLOQUEO = 'bloqueo:'

/**
 * Tanda L (L1, punto 6) · El bloqueo es TOTAL y la pregunta de K1 («¿Agendar
 * de todos modos?») desapareció: éste es el mensaje de Angel, literal, en la
 * burbuja, el formulario, el arrastre y «Reagendar». El servidor responde 409
 * con este MISMO texto (`bloqueoTotalServidor.ts`).
 */
export const TEXTO_HORARIO_BLOQUEADO = 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.'

/** Lo que se escribe en la franja: «Bloqueado», con el motivo si lo hay. */
export function rotuloBloqueo(motivo: string | null | undefined): string {
  const m = motivo?.trim()
  return m ? `Bloqueado · ${m}` : 'Bloqueado'
}

/** Cómo se pinta según la vista: fondo en la rejilla; en la lista (que no pinta
 *  fondos) y en el Mes con hora (donde un fondo cubriría el día entero), fila. */
export function displayDeBloqueo(vista: string, todoElDia: boolean): 'background' | 'auto' {
  if (vista.startsWith('list')) return 'auto'
  if (vista === 'dayGridMonth') return todoElDia ? 'background' : 'auto'
  return 'background'
}

/** Una fila de bloqueo → el evento de FullCalendar. `vista` decide el `display`. */
export function bloqueoAEvento(b: BloqueoAgenda, vista = ''): EventInput {
  const puntas = b.todo_el_dia
    ? { allDay: true, start: diaEnZonaDelConsultorio(b.inicio, b.zona), end: diaEnZonaDelConsultorio(b.fin, b.zona) }
    : { allDay: false, start: b.inicio, end: b.fin }
  return {
    id: `${PREFIJO_BLOQUEO}${b.id}`,
    title: rotuloBloqueo(b.motivo),
    ...puntas,
    display: displayDeBloqueo(vista, b.todo_el_dia),
    editable: false,
    classNames: ['ag-bloqueo'],
    extendedProps: { bloqueo: { ...b } },
  }
}

/** ¿Tiene la forma de una fila de bloqueo? (Lo que viaja por la red o va en `extendedProps`.) */
export function esFilaBloqueo(b: unknown): b is BloqueoAgenda {
  return typeof b === 'object' && b !== null
    && 'id' in b && typeof b.id === 'string' && 'medico_id' in b && typeof b.medico_id === 'string'
    && 'inicio' in b && typeof b.inicio === 'string' && 'fin' in b && typeof b.fin === 'string'
    && 'todo_el_dia' in b && typeof b.todo_el_dia === 'boolean'
}

/** El bloqueo de un evento pintado, o `null` si no es un bloqueo. */
export function bloqueoDe(ev: { extendedProps: Record<string, unknown> }): BloqueoAgenda | null {
  const b: unknown = ev.extendedProps.bloqueo
  return esFilaBloqueo(b) ? b : null
}

/** ¿Es un bloqueo? Para quitarlo de lo que cuenta citas (ventana, conteo, panel, empalmes). */
export function esBloqueo(ev: { extendedProps: Record<string, unknown> }): boolean {
  return bloqueoDe(ev) !== null
}

/**
 * ¿Toca `[inicio, fin)` algún bloqueo pintado de ese médico? El mismo solape
 * semiabierto que la base (`inicio < fin AND fin > inicio`), con las puntas
 * REALES del bloqueo (las de la fila, no las fechas-solo de un evento de todo
 * el día): tocar el extremo no cuenta. Sin médico no hay bloqueo que mirar.
 */
export function tocaBloqueo(
  pintados: readonly { extendedProps: Record<string, unknown> }[], medicoId: string | null | undefined, inicio: Date, fin: Date,
): boolean {
  if (!medicoId || !(fin.getTime() > inicio.getTime())) return false
  return pintados.some(ev => {
    const b = bloqueoDe(ev)
    return b !== null && b.medico_id === medicoId
      && Date.parse(b.inicio) < fin.getTime() && Date.parse(b.fin) > inicio.getTime()
  })
}

/** Punto 5 · El aviso tras guardar: las citas se quedan como están. */
export function mensajeCitasEnBloqueo(n: number): string {
  return n === 1
    ? 'Hay 1 cita en este horario. Se queda como está.'
    : `Hay ${n} citas en este horario. Se quedan como están.`
}

/** Lo que hace falta de un evento pintado para saber si un punto cae en él. */
interface PintadoConPuntas { start: Date | null; end: Date | null; display: string; extendedProps: Record<string, unknown> }

/**
 * Tanda L (L1, punto 7) · El bloqueo VISIBLE que cubre el instante pulsado
 * (`dateClick`/`select` de la rejilla, la banda de todo el día o el Mes), o
 * `null`. Se decide por la POSICIÓN del gesto y no por el elemento que hay
 * debajo del puntero: así responde la franja entera, no sólo su rótulo, y no
 * depende del orden de `pointerdown`/`mouseup` de FullCalendar. Con las
 * puntas PINTADAS (`start`/`end` del evento), que son las que se ven: un
 * bloqueo de días cubre de medianoche a medianoche del día pintado. Uno
 * apagado (`display: 'none'`, v2 apagada) no cuenta. Semiabierto: el instante
 * del fin ya es libre.
 */
export function bloqueoEnInstante(pintados: readonly PintadoConPuntas[], t: Date): BloqueoAgenda | null {
  const ms = t.getTime()
  for (const ev of pintados) {
    const b = ev.display === 'none' ? null : bloqueoDe(ev)
    if (b && ev.start && ev.end && ev.start.getTime() <= ms && ms < ev.end.getTime()) return b
  }
  return null
}

/** Lee la lista `bloqueos` de una respuesta de `/api/appointments` (ausente = ninguno). */
export function bloqueosDeRespuesta(valor: unknown): BloqueoAgenda[] {
  return Array.isArray(valor) ? valor.filter(esFilaBloqueo) : []
}
