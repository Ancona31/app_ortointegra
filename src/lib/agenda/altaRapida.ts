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
import type { GestoAlta } from '@/lib/agenda/contratosV2'
import type { Empalme, TramoCita } from '@/lib/agenda/empalmesCita'
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

const HORA = /^\d{2}:\d{2}$/

/**
 * Las dos horas con las que abre la burbuja. Un gesto sobre un DÍA (celda del
 * Mes) no trae hora y abre con las dos en blanco: inventarse una es lo que la
 * agenda dejó de hacer (ver `ModalState`). Con hora, el fin es el inicio más
 * `duracionDeSeleccion`.
 */
export function horasDelGesto(g: Pick<GestoAlta, 'hora' | 'inicio' | 'fin' | 'desdeHueco'>): { inicio: string; fin: string } {
  if (g.hora === null) return { inicio: '', fin: '' }
  return { inicio: g.hora, fin: sumarMinutos(g.hora, duracionDeSeleccion(g.inicio, g.fin, g.desdeHueco)) }
}

/**
 * El fin tras cambiar el inicio en la burbuja: conserva la duración que había
 * (como `moverInicio` del modal), y si no la había —horas en blanco, o un fin
 * que no era posterior— propone la de por omisión. Sin inicio válido, el fin
 * no se toca.
 */
export function finTrasMoverInicio(inicio: string, fin: string, nuevoInicio: string): string {
  if (!HORA.test(nuevoInicio)) return fin
  const minutos = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3))
  const duracion = HORA.test(inicio) && HORA.test(fin) && fin > inicio ? minutos(fin) - minutos(inicio) : DEFAULT_DURATION
  return sumarMinutos(nuevoInicio, duracion)
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
  if (!HORA.test(e.horaInicio) || !HORA.test(e.horaFin)) return 'Escribe la hora de inicio y de fin.'
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

/** El nombre accesible de la burbuja: «Nueva cita · mié 11, 10:00–11:30»; sin horas, «Nueva cita · mié 11». */
export function etiquetaBurbuja(fecha: string, horaInicio: string, horaFin: string): string {
  const dia = FORMATO_DIA.format(new Date(`${fecha}T12:00:00Z`)).replace(/[.,]/g, '')
  return HORA.test(horaInicio) && HORA.test(horaFin) ? `Nueva cita · ${dia}, ${horaInicio}–${horaFin}` : `Nueva cita · ${dia}`
}

/* ── Guardar desde la burbuja ───────────────────────────────────────────── */

/** Lo que `guardarAltaRapida` necesita de la agenda, inyectado para probarlo sin DOM. */
export interface DependenciasGuardado {
  /** El aviso de fuera de horario de esas puntas (`avisoFueraDeHorario` ?? `avisoFinFueraDeHorario`). */
  avisoHorario: (inicio: Date, fin: Date) => string | null
  /** B7c: los empalmes contra lo pintado (`empalmesPintados`). */
  buscarEmpalmes: (tramo: TramoCita) => Empalme[]
  mensajeEmpalme: (lista: readonly Empalme[]) => string
  /** Un `ConfirmModal`: `true` si se acepta. */
  confirmar: (mensaje: string) => Promise<boolean>
  /** `handleSave`, que ya trae el bloque optimista, el 409 de empalme y la invitación de Google. */
  guardar: (datos: DatosGuardado) => void
}

/**
 * El orden de los avisos al guardar desde la burbuja, el MISMO que el del
 * modal (P3): primero el de fuera de horario, después el de empalme, y sólo
 * entonces el guardado. `true` si se mandó a guardar (la burbuja se cierra);
 * `false` si alguien dijo que no (la burbuja se queda abierta como estaba).
 *
 * ⚠️ EL AVISO DE HORARIO SE SALTA SI LAS HORAS SON LAS DE LA APERTURA: ése ya
 * se preguntó antes de abrir (`abrirAlta`) y repetirlo sería preguntar dos
 * veces lo mismo. Si se tocaron, se pregunta por las nuevas, como el modal.
 * El 409 del servidor lo sigue manejando `handleSave` (preguntarEmpalme y
 * reintento): esto sólo adelanta en el cliente lo que ya está pintado.
 */
export async function guardarAltaRapida(
  datos: DatosGuardado, horasDeApertura: { inicio: string; fin: string }, horas: { inicio: string; fin: string },
  d: DependenciasGuardado,
): Promise<boolean> {
  if (!datos.start_time || !datos.end_time) return false
  const inicio = new Date(datos.start_time)
  const fin = new Date(datos.end_time)
  const tocadas = horas.inicio !== horasDeApertura.inicio || horas.fin !== horasDeApertura.fin
  const aviso = tocadas ? d.avisoHorario(inicio, fin) : null
  if (aviso && !(await d.confirmar(aviso))) return false
  const lista = d.buscarEmpalmes({
    id: '', medicoId: datos.medico_id ?? null, inicio, fin, todoElDia: false, noOcupa: false, deGoogle: false, titulo: '',
  })
  if (lista.length && !(await d.confirmar(d.mensajeEmpalme(lista)))) return false
  d.guardar(lista.length ? { ...datos, empalmes_aceptados: lista.map(e => e.id) } : datos)
  return true
}
