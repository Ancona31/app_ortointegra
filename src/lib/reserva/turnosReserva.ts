/**
 * turnosReserva.ts — los turnos que la página pública ofrece y la
 * comprobación de que un turno pedido es uno de ellos (agenda D5). Puro: la
 * ruta lee el contexto y la ocupación por RPC y se los pasa.
 *
 * Reglas, todas con valores del SERVIDOR (nunca del navegador):
 *   · horario: `horarioEfectivo` (el propio del consultorio si lo tiene; si
 *     no, el de la clínica; sin ninguno, HORARIO_DEFAULT, como la rejilla);
 *   · paso y tamaño: la duración del tipo de cita, en la REJILLA FIJA desde
 *     la hora de apertura (G2, punto 9; sustituye a P9, que contaba desde el
 *     inicio de cada hueco). Un turno que algo ocupa en parte no se ofrece;
 *   · anticipación mínima y horizonte: los de `agenda_ajustes`;
 *   · ocupación (P3): `reserva_ocupacion` ya quita `cancelled` y `no_show`;
 *     llega sin estado (`status: null`) y sin `all_day`, así que aquí todo
 *     ocupa y `turnosAgenda.citaOcupa` (que cuenta `no_show`) no cambia nada.
 *     k1 (tanda K, puntos 2 y 4): los BLOQUEOS del médico (`agenda_bloqueos`)
 *     llegan como filas más, con sus dos puntas y nada más, y tapan lo que
 *     tocan; un evento de TODO EL DÍA ya NO llega (seg1 lo hacía ocupar; un
 *     «Congreso» de todo el día no significa que no consulte). En la agenda
 *     interna el bloqueo sólo pide confirmación.
 *
 * `turnoValido` es el CONVENIO que pide el COMMENT de `reservar_por_enlace`
 * (D3): la base no conoce el horario ni la alineación; la ruta de reservar
 * lo llama ANTES de la RPC (¿es un turno de la rejilla, en horario y en la
 * ventana? si no, 400). Si sigue libre lo decide la RPC bajo su candado
 * (`ocupado`) con el MISMO criterio que la lista: algo que toque el turno
 * aunque sea en parte (`start_time < fin AND end_time > inicio`), sin
 * `cancelled` ni `no_show`, sin lo de todo el día y con los bloqueos. La lista es «rejilla menos
 * lo ocupado»; la comprobación, «rejilla» + «nada ocupado» bajo el candado:
 * la misma regla partida en dos, y la parte que depende de la ocupación sólo
 * la decide la RPC, que es la que ve la carrera.
 */
import type { Horario } from '@/lib/configApp'
import { desplazarFecha, fechaHoraLocalAInstante } from '@/lib/dates'
import { horarioEfectivo, type ConsultorioDisponibilidad } from '@/lib/agenda/disponibilidad'
import { turnosDelDia, type OcupacionCita, type Turno } from '@/lib/agenda/turnosAgenda'

/** Días que devuelve una consulta de turnos. `reserva_ocupacion` acepta hasta 15. */
export const DIAS_POR_CONSULTA = 7

export interface ReglasReserva {
  tz: string
  horario: Horario
  duracionMin: number
  anticipacionMinHoras: number
  horizonteDias: number
}

export interface DiaTurnos { fecha: string; turnos: Turno[] }

/** Las reglas de un consultorio y un tipo, con el horario ya resuelto. */
export function reglasDe(
  consultorio: ConsultorioDisponibilidad & { timezone: string },
  horarioClinica: unknown,
  duracionMin: number,
  ajustes: { anticipacion_min_horas: number; horizonte_dias: number },
): ReglasReserva {
  const clinica = horarioClinica === null || horarioClinica === undefined ? null : normalizarCrudo(horarioClinica)
  return {
    tz: consultorio.timezone,
    horario: horarioEfectivo(consultorio, clinica),
    duracionMin,
    anticipacionMinHoras: ajustes.anticipacion_min_horas,
    horizonteDias: ajustes.horizonte_dias,
  }
}

/**
 * El horario de la clínica llega crudo (jsonb). Se normaliza con la misma
 * función que el del consultorio, sin `as`: un día mal formado sale cerrado.
 */
function normalizarCrudo(h: unknown): Horario {
  return horarioEfectivo({ horario: h, horario_propio: true }, null)
}

/** Las puntas (instantes) de la consulta: de las 00:00 del primer día a las 00:00 del día siguiente al último. */
export function rangoDeConsulta(desde: string, tz: string, dias: number = DIAS_POR_CONSULTA): { desde: string; hasta: string } {
  return {
    desde: fechaHoraLocalAInstante(desde, '00:00', tz),
    hasta: fechaHoraLocalAInstante(desplazarFecha(desde, { dias }), '00:00', tz),
  }
}

/** El día de pared (`YYYY-MM-DD`) de un instante en `tz`. */
export function fechaEnZona(instante: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante)
}

/** Primer día que se puede consultar: hoy en la zona del consultorio. Una fecha anterior se sube a hoy. */
export function primerDia(desde: string, tz: string, ahora: Date): string {
  const hoy = fechaEnZona(ahora, tz)
  return desde < hoy ? hoy : desde
}

/** Los turnos de `dias` días desde `desde`, con anticipación y horizonte aplicados. */
export function turnosDeDias(
  r: ReglasReserva, desde: string, ocupacion: readonly OcupacionCita[], ahora: Date, dias: number = DIAS_POR_CONSULTA,
): DiaTurnos[] {
  const tope = ahora.getTime() + r.horizonteDias * 86_400_000
  const salida: DiaTurnos[] = []
  for (let i = 0; i < dias; i++) {
    const fecha = desplazarFecha(desde, { dias: i })
    const turnos = turnosDelDia({
      fecha, tz: r.tz, horario: r.horario, citas: ocupacion, duracionMin: r.duracionMin,
      ahora, anticipacionMinHoras: r.anticipacionMinHoras,
    }).filter(t => Date.parse(t.inicio) < tope)
    salida.push({ fecha, turnos })
  }
  return salida
}

/** ¿`inicio` es exactamente el inicio de un turno ofrecido ese día, con esa ocupación? */
export function turnoOfrecido(r: ReglasReserva, inicio: string, ocupacion: readonly OcupacionCita[], ahora: Date): Turno | null {
  const ms = Date.parse(inicio)
  if (Number.isNaN(ms)) return null
  const [dia] = turnosDeDias(r, fechaEnZona(new Date(ms), r.tz), ocupacion, ahora, 1)
  return dia?.turnos.find(t => Date.parse(t.inicio) === ms) ?? null
}

/**
 * EL CONVENIO DE D3 PARA RESERVAR: ¿`inicio` es un turno de la rejilla fija
 * (G2) de ese día, en horario, con la anticipación y dentro del horizonte?
 * Es `turnoOfrecido` con la jornada vacía: la rejilla no depende de la
 * ocupación, así que un turno que la lista ofrecía sigue siendo válido aunque
 * alguien lo tome entretanto (lo rechaza la RPC con `ocupado`, 409), y uno
 * fuera de la rejilla no lo es nunca (400). Un reenvío del mismo `client_id`
 * llega igual a la RPC y sale `repetida`.
 */
export function turnoValido(r: ReglasReserva, inicio: string, ahora: Date): Turno | null {
  return turnoOfrecido(r, inicio, [], ahora)
}

/** La ocupación de la RPC, en la forma de `turnosAgenda` (sin estado: ocupa). */
export function ocupacionSinEstado(filas: readonly { start_time: string; end_time: string }[]): OcupacionCita[] {
  return filas.map(f => ({ start_time: f.start_time, end_time: f.end_time, all_day: false, status: null }))
}
