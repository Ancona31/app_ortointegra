/**
 * turnosReserva.ts — los turnos que la página pública ofrece y la
 * comprobación de que un turno pedido es uno de ellos (agenda D5). Puro: la
 * ruta lee el contexto y la ocupación por RPC y se los pasa.
 *
 * Reglas, todas con valores del SERVIDOR (nunca del navegador):
 *   · horario: `horarioEfectivo` (el propio del consultorio si lo tiene; si
 *     no, el de la clínica; sin ninguno, HORARIO_DEFAULT, como la rejilla);
 *   · paso y tamaño: la duración del tipo de cita (P9), desde el inicio de
 *     cada hueco;
 *   · anticipación mínima y horizonte: los de `agenda_ajustes`;
 *   · ocupación (P3): `reserva_ocupacion` ya quita `cancelled`, `no_show` y
 *     todo el día; llega sin estado (`status: null`), así que aquí todo ocupa
 *     y `turnosAgenda.citaOcupa` (que cuenta `no_show`) no cambia nada.
 *
 * `turnoOfrecido` es el CONVENIO que pide el COMMENT de
 * `reservar_por_enlace` (D3): la base no conoce el horario ni la alineación;
 * la ruta de reservar llama a esto ANTES de la RPC, SIN ocupación (¿es un
 * turno de verdad? si no, 400). Si sigue libre lo decide la RPC bajo su
 * candado (`ocupado`), que además resuelve la carrera entre dos personas.
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

/** La ocupación de la RPC, en la forma de `turnosAgenda` (sin estado: ocupa). */
export function ocupacionSinEstado(filas: readonly { start_time: string; end_time: string }[]): OcupacionCita[] {
  return filas.map(f => ({ start_time: f.start_time, end_time: f.end_time, all_day: false, status: null }))
}
