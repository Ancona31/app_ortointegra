/**
 * src/lib/agenda/turnosAgenda.ts
 *
 * Los huecos y los turnos de un día CALCULADOS EN LA ZONA DEL CONSULTORIO, para
 * el servidor (B8). Puro: sin FullCalendar, sin React, sin `'use client'`, sin
 * leer la base. Quien lo llame (la reserva por enlace, bloque D) lee las citas
 * y el horario y se los pasa; aquí sólo hay aritmética.
 *
 * ⚠️ NO ES EL PANEL DE DÍA. El panel del navegador (`resumenDelDia` en
 * `huecosAgenda.ts`) trabaja sobre lo pintado, en la zona del DISPOSITIVO y con
 * `HUECO_MINIMO`; esto trabaja sobre filas, en la zona que se le pasa y con la
 * duración del tipo de cita. Comparten la aritmética de `tramos.ts`, y con la
 * misma zona y mínimo 60 dan los mismos huecos (lo prueba
 * `turnosAgenda.test.ts`). El panel no cambia por existir esto.
 *
 * ⚠️ HORA DE PARED, NO TIEMPO TRANSCURRIDO. Un instante se traduce a minutos
 * leyendo su hora de pared en `tz` (`renderEnTZ`), y un turno vuelve a instante
 * con `fechaHoraLocalAInstante`. Así el cambio de horario de verano sólo toca
 * esas dos fronteras y nunca la aritmética de enteros. Importa en México: la
 * franja fronteriza norte (`America/Tijuana`, `Ciudad_Juarez`, `Ojinaga`,
 * `Matamoros`) sigue el horario de verano de EE. UU., y el servidor corre en
 * UTC, así que la hora del proceso no vale para nada aquí.
 *
 * Límites conocidos, los dos de madrugada y fuera de cualquier jornada real:
 *   · la hora que NO existe el día que se adelanta el reloj (02:00–03:00 del
 *     segundo domingo de marzo en esas zonas) no ofrece turnos: un turno que
 *     empieza o acaba en ella se descarta;
 *   · la hora que se REPITE el día que se atrasa (01:00–02:00 del primer
 *     domingo de noviembre) se cuenta una sola vez: una cita metida entera en
 *     el pliegue puede no ocupar, y cuál de las dos 01:30 sale al componer un
 *     turno lo decide `fromZonedTime` (`date-fns-tz`), no este módulo.
 *
 * Nombre propio y no `disponibilidad.ts`, que es el archivo previsto para el
 * `horarioEfectivo` de B5: aquí `horario` llega ya resuelto.
 */

import type { Horario } from '@/lib/configApp'
import { desplazarFecha, fechaHoraLocalAInstante, renderEnTZ } from '@/lib/dates'
import type { Status } from './tiposAgenda'
import { DIAS } from './horarioAgenda'
import {
  type Tramo, MINUTOS_POR_DIA, minutosDeReloj, relojDeMinutos,
  fusionarTramos, recortarATramo, huecosDe,
} from './tramos'

/** Lo que hace falta de una fila para saber si ocupa hora. Vale para una cita
 *  de `appointments` (instantes `timestamptz` en ISO) y para un bloque ocupado
 *  de Google, que no tiene estado. */
export type OcupacionCita = {
  start_time: string
  end_time: string
  all_day?: boolean | null
  /** Ausente o `null` = bloque sin estado (Google): ocupa. */
  status?: Status | null
}

/** Un turno ofrecible, en instantes UTC (ISO). */
export type Turno = { inicio: string; fin: string }

export interface EntradaDia {
  /** Día de pared en `tz`, `YYYY-MM-DD`. */
  fecha: string
  /** IANA del consultorio. Nunca la del proceso: en Vercel es UTC. */
  tz: string
  /** Ya resuelto para ese consultorio. */
  horario: Horario
  citas: readonly OcupacionCita[]
}

export interface EntradaTurnos extends EntradaDia {
  /** Duración del tipo de cita, en minutos: tamaño y paso de la rejilla fija (G2). */
  duracionMin: number
  /** Con `anticipacionMinHoras`, descarta los turnos que empiezan antes de
   *  `ahora + anticipación`. Sin `ahora` no se recorta nada. */
  ahora?: Date
  anticipacionMinHoras?: number
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** 0 = domingo … 6 = sábado, la numeración de `getDay()` y de `DIAS[].fc`.
 *  Al mediodía en UTC: el día de la semana de una fecha no depende de zona. */
export function diaDeSemanaDeFecha(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`)
  if (!RE_FECHA.test(fecha) || Number.isNaN(d.getTime())) {
    throw new Error(`diaDeSemanaDeFecha: fecha inválida "${fecha}"`)
  }
  return d.getUTCDay()
}

/** La jornada de ese día, o `null` si no abre. Mismo criterio que
 *  `jornadaDelDia` (`huecosAgenda.ts`), sin `Date` de por medio. */
export function jornadaDeFecha(fecha: string, horario: Horario): Tramo | null {
  const dia = diaDeSemanaDeFecha(fecha)
  const conf = DIAS.find(d => d.fc === dia)
  if (!conf) return null
  const hd = horario[conf.key]
  if (!hd?.activo) return null
  const desde = minutosDeReloj(hd.inicio)
  const hasta = minutosDeReloj(hd.fin)
  return hasta > desde ? { desde, hasta } : null
}

/** Mismas reglas que `eventoOcupa`: lo de todo el día no ocupa; `cancelled` no
 *  ocupa; `no_show` SÍ ocupa (la hora se consumió) y un bloque de Google
 *  también. */
export function citaOcupa(c: OcupacionCita): boolean {
  if (c.all_day === true) return false
  return c.status !== 'cancelled'
}

/** Minuto de pared de un instante en `fecha`, recortado a `[0, 1440]`: antes
 *  de ese día → 0, después → 1440. */
function minutoDePared(instante: string, fecha: string, tz: string): number {
  const [dia = '', hhmm = '00:00'] = renderEnTZ(instante, 'yyyy-MM-dd HH:mm', tz).split(' ')
  if (dia < fecha) return 0
  if (dia > fecha) return MINUTOS_POR_DIA
  return minutosDeReloj(hhmm)
}

/**
 * Los tramos que ocupan las citas en ese día de pared, sin ordenar ni fundir.
 * ⚠️ SEMIABIERTO, como `tramosDeOcupacion`: una cita que acaba a las 00:00 de
 * `fecha` es del día anterior (0–0, no entra), y una que cruza la medianoche
 * por cualquiera de los dos lados queda recortada al día.
 */
export function tramosDeCitasEnZona(citas: readonly OcupacionCita[], fecha: string, tz: string): Tramo[] {
  const tramos: Tramo[] = []
  for (const c of citas) {
    if (!citaOcupa(c)) continue
    if (Number.isNaN(Date.parse(c.start_time)) || Number.isNaN(Date.parse(c.end_time))) continue
    const desde = minutoDePared(c.start_time, fecha, tz)
    const hasta = minutoDePared(c.end_time, fecha, tz)
    if (hasta > desde) tramos.push({ desde, hasta })
  }
  return tramos
}

/** Los huecos libres de la jornada con suelo `minimo`. `[]` si no abre. */
export function huecosDeFechaEnZona(e: EntradaDia, minimo: number): Tramo[] {
  const jornada = jornadaDeFecha(e.fecha, e.horario)
  if (!jornada) return []
  const ocupados = recortarATramo(fusionarTramos(tramosDeCitasEnZona(e.citas, e.fecha, e.tz)), jornada)
  return huecosDe(jornada, ocupados, minimo)
}

/**
 * LA REJILLA FIJA (G2, punto 9 de Angel; sustituye a P9): los turnos de una
 * jornada se cuentan desde la HORA DE APERTURA, con paso igual a la duración.
 * Con 45 min desde las 9:00: 9:00, 9:45, 10:30… El resto que no llega a un
 * turno entero se pierde. Una duración que no es un entero positivo no da
 * turnos (y no cuelga el bucle). No mira la ocupación: la rejilla es la misma
 * con la agenda vacía o llena, y por eso la lista y la comprobación al
 * reservar no pueden dar respuestas distintas.
 */
export function turnosDeJornada(jornada: Tramo, duracionMin: number): Tramo[] {
  if (!Number.isInteger(duracionMin) || duracionMin <= 0) return []
  const turnos: Tramo[] = []
  for (let t = jornada.desde; t + duracionMin <= jornada.hasta; t += duracionMin) {
    turnos.push({ desde: t, hasta: t + duracionMin })
  }
  return turnos
}

/** ¿Algo ocupa PARTE de este turno? Semiabierto: tocar extremos no ocupa
 *  (10:00–10:30 y 10:30–11:00), la misma regla que el empalme de
 *  `reservar_por_enlace` (`start_time < fin AND end_time > inicio`). */
function tocaAlgo(t: Tramo, ocupados: readonly Tramo[]): boolean {
  return ocupados.some(o => o.desde < t.hasta && o.hasta > t.desde)
}

/**
 * G2 · El minuto del turno de la rejilla MÁS CERCANO a `minuto`, o `null` si
 * `minuto` cae fuera de la jornada o no cabe ningún turno entero. Empate a la
 * mitad → el de después. Es la ayuda de la agenda (clic, burbuja, arrastre):
 * no ofrece nada, sólo propone la hora.
 */
export function minutoDeTurnoCercano(jornada: Tramo, duracionMin: number, minuto: number): number | null {
  const turnos = turnosDeJornada(jornada, duracionMin)
  const ultimo = turnos[turnos.length - 1]
  if (!ultimo || minuto < jornada.desde || minuto >= jornada.hasta) return null
  const k = Math.min(Math.round((minuto - jornada.desde) / duracionMin), turnos.length - 1)
  return jornada.desde + k * duracionMin
}

/** El instante de un minuto de pared de `fecha` en `tz`, o `null` si esa hora
 *  no existe ese día (adelanto del reloj). 1440 es las 00:00 del día siguiente. */
function instanteDeMinuto(fecha: string, minuto: number, tz: string): string | null {
  const dia = minuto >= MINUTOS_POR_DIA ? desplazarFecha(fecha, { dias: 1 }) : fecha
  const reloj = relojDeMinutos(minuto % MINUTOS_POR_DIA)
  const instante = fechaHoraLocalAInstante(dia, reloj, tz)
  return renderEnTZ(instante, 'yyyy-MM-dd HH:mm', tz) === `${dia} ${reloj}` ? instante : null
}

/** Los turnos ofrecibles del día, en instantes: los de la rejilla fija que
 *  nada ocupa ni en parte, desde `ahora + anticipación`. `[]` si el
 *  consultorio no abre, si la duración no es válida o si no cabe ninguno. */
export function turnosDelDia(e: EntradaTurnos): Turno[] {
  const jornada = jornadaDeFecha(e.fecha, e.horario)
  if (!jornada) return []
  const ocupados = fusionarTramos(tramosDeCitasEnZona(e.citas, e.fecha, e.tz))
  const limite = e.ahora
    ? e.ahora.getTime() + (e.anticipacionMinHoras ?? 0) * 3_600_000
    : Number.NEGATIVE_INFINITY
  const turnos: Turno[] = []
  for (const t of turnosDeJornada(jornada, e.duracionMin)) {
    if (tocaAlgo(t, ocupados)) continue
    const inicio = instanteDeMinuto(e.fecha, t.desde, e.tz)
    const fin = instanteDeMinuto(e.fecha, t.hasta, e.tz)
    if (!inicio || !fin || Date.parse(inicio) < limite) continue
    turnos.push({ inicio, fin })
  }
  return turnos
}

/**
 * H4 (punto 20 de Angel) · Los turnos de la rejilla fija de un día (LA MISMA
 * de `turnosDelDia`, la del enlace de reserva) que caben ENTEROS en el tramo
 * libre `[desde, hasta)` (instantes en ms). Lo usa el panel «Huecos
 * disponibles» de Día para partir cada hueco: lo que está libre ya lo dice el
 * hueco, así que un turno que algo toca aunque sea en parte no cabe entero y
 * no sale.
 */
export function turnosEnTramo(e: Omit<EntradaTurnos, 'citas'>, desde: number, hasta: number): Turno[] {
  return turnosDelDia({ ...e, citas: [] }).filter(t => Date.parse(t.inicio) >= desde && Date.parse(t.fin) <= hasta)
}

/**
 * G2 · Ajusta un instante al turno más cercano de la rejilla de ESE día en
 * `tz` (apertura del día + múltiplos de la duración). `null` si no se ajusta:
 * el día no abre, el instante cae fuera de la jornada, la duración no vale o
 * la hora resultante no existe (adelanto del reloj). Lo usa la agenda; el
 * llamador decide qué hacer con `null` (dejar la hora tal cual).
 */
export function ajustarATurno(a: { instante: Date; tz: string; horario: Horario; duracionMin: number }): Date | null {
  const iso = a.instante.toISOString()
  const [fecha = ''] = renderEnTZ(iso, 'yyyy-MM-dd HH:mm', a.tz).split(' ')
  const jornada = RE_FECHA.test(fecha) ? jornadaDeFecha(fecha, a.horario) : null
  if (!jornada) return null
  const minuto = minutoDeTurnoCercano(jornada, a.duracionMin, minutoDePared(iso, fecha, a.tz))
  const instante = minuto === null ? null : instanteDeMinuto(fecha, minuto, a.tz)
  return instante ? new Date(instante) : null
}
