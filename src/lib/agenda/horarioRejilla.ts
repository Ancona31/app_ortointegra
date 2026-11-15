/**
 * src/lib/agenda/horarioRejilla.ts
 *
 * LA FUENTE ÚNICA DEL HORARIO DE LA AGENDA (tanda «diseño, duración y
 * horarios», puntos 10 a 13 y 19 de Angel). Sustituye a la regla de T2 (el
 * consultorio activo o, si no, el de la clínica), que el punto 13 retiró.
 *
 * Con la agenda v2 el horario de la clínica deja de ser un ajuste: la agenda se
 * dibuja con el de los CONSULTORIOS, cada uno con su horario efectivo
 * (`horarioEfectivo`) y en SU zona. Qué consultorios cuentan
 * (`consultoriosDeLaRejilla`):
 *   · un médico concreto → la unión de los suyos, salvo que sea quien mira y
 *     tenga un consultorio activo en el menú lateral: ése (el gris, los huecos
 *     y «Compactar» de ese consultorio);
 *   · «Todos los médicos» → todos los que la agenda puede enseñar: de la
 *     apertura más temprana al cierre más tardío;
 *   · ninguno (médico sin consultorios) → el de la clínica, como antes.
 *
 * De ahí salen, en la hora del DISPOSITIVO (la rejilla no lleva `timeZone`;
 * ver la cabecera de `ventanaRejilla.ts`), dos piezas: `horario` —un tramo por
 * día, de la apertura más temprana al cierre más tardío; lo leen la ventana,
 * «Compactar», la hora a la que abre la vista, el día hábil del Mes y el panel
 * de huecos— y `businessHours` —un tramo por consultorio y día, para que el
 * gris respete los huecos entre consultorios—. Un consultorio en otra zona se
 * CONVIERTE: Tijuana 09:00–11:00 se pinta 11:00–13:00 en un dispositivo de
 * Mérida en noviembre. El desfase se mide en `referencia` (el inicio del rango
 * visible), así que sólo cambia al cruzar un cambio de horario de verano.
 *
 * El aviso de fuera de horario NO usa esa conversión: se calcula en la hora del
 * consultorio de la cita (`crearAvisosHorario`), y así no salta en falso.
 *
 * ⚠️ APAGADA, LO DE HOY AL BIT: `horarioClinica ?? HORARIO_DEFAULT`, el MISMO
 * objeto, y `businessHours: null` (la agenda lo deriva de `horario`, como
 * siempre). Invariante A1-bis: nada de lo que recibe FullCalendar cambia de
 * identidad.
 *
 * ⚠️ CON LA V2, LA MISMA SALIDA PARA LA MISMA ENTRADA: quien llama le pasa la
 * salida anterior (`previa`) y, si el contenido es el mismo, recibe ESE objeto
 * de vuelta; así recalcular con un array de consultorios nuevo pero igual no
 * cambia la identidad y FullCalendar no vuelve a refinar `businessHours` ni la
 * ventana. Sin estado de módulo: este archivo también corre en el servidor.
 *
 * ⚠️ MÓDULO PURO: sin `'use client'`, sin Supabase.
 */
import type { DiaSemana, Horario, HorarioDia } from '@/lib/configApp'
import {
  DIAS, HORARIO_DEFAULT, SUJETO_CLINICA, avisoDiaCerrado, avisoFinFueraDeHorario, avisoFueraDeHorario, horaDeReloj,
  type FormaAviso,
} from '@/lib/agenda/horarioAgenda'
import { horarioEfectivo, type ConsultorioDisponibilidad } from '@/lib/agenda/disponibilidad'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'

/** Lo que hace falta de un consultorio. Sin `timezone` cuenta como el dispositivo. */
export interface ConsultorioRejilla extends ConsultorioDisponibilidad {
  id: string
  medico_id: string
  activo?: boolean | null
  timezone?: string | null
}

/** Un tramo de `businessHours` de FullCalendar, en la hora del dispositivo. */
export interface HoraHabil { daysOfWeek: number[]; startTime: string; endTime: string }

export interface SeleccionRejilla {
  /** Los consultorios que la agenda puede enseñar (servidor; si no, los de la sesión). */
  consultorios: readonly ConsultorioRejilla[]
  /** El consultorio activo del menú lateral, sólo si quien mira es médico; si no, `null`. */
  consultorioActivo: ConsultorioRejilla | null
  /** El médico que enseña la rejilla, o `null` con «Todos los médicos». */
  medicoMostrado: string | null
}

export interface EntradaRejilla {
  agendaV2: boolean
  horarioClinica: Horario | null | undefined
  /** `consultoriosDeLaRejilla(...)`. */
  seleccion: readonly ConsultorioRejilla[]
  zonaDispositivo: string
  /** El instante en que se mide el desfase de cada zona (el inicio del rango visible); 0 = ahora. */
  referencia: number
}

export interface FuenteRejilla {
  horario: Horario
  /** `null` = se deriva de `horario`, como siempre (apagada, o sin consultorios). */
  businessHours: HoraHabil[] | null
}

const MIN_DIA = 24 * 60

/** Los consultorios que cuentan para la rejilla (reglas de la cabecera). */
export function consultoriosDeLaRejilla(s: SeleccionRejilla): ConsultorioRejilla[] {
  const vivos = s.consultorios.filter(c => c.activo !== false)
  if (!s.medicoMostrado) return vivos
  const activo = s.consultorioActivo
  if (activo && activo.activo !== false && activo.medico_id === s.medicoMostrado) {
    return [vivos.find(c => c.id === activo.id) ?? activo]
  }
  return vivos.filter(c => c.medico_id === s.medicoMostrado)
}

const formatosZona = new Map<string, Intl.DateTimeFormat>()

/** La hora de pared de `t` en `zona`, por piezas; `null` si la zona no vale. */
function paredEnZona(t: number, zona: string): Record<string, number> | null {
  try {
    let f = formatosZona.get(zona)
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
      })
      formatosZona.set(zona, f)
    }
    const partes: Record<string, number> = {}
    for (const p of f.formatToParts(new Date(t))) if (p.type !== 'literal') partes[p.type] = Number(p.value)
    return partes
  } catch {
    return null
  }
}

/** Minutos de desfase de `zona` respecto de UTC en el instante `t`, o `null` si la zona no vale. */
function desfaseUtc(zona: string, t: number): number | null {
  const p = paredEnZona(t, zona)
  if (!p) return null
  const minuto = Math.floor(t / 60_000) * 60_000
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - minuto) / 60_000)
}

/** Los minutos que hay que SUMAR a la hora de `zona` para tener la del dispositivo, en `t` (0 si alguna no vale). */
export function desfaseConDispositivo(zona: string | null | undefined, zonaDispositivo: string, t: number): number {
  if (!zona || zona === zonaDispositivo) return 0
  const dispositivo = desfaseUtc(zonaDispositivo, t)
  const consultorio = desfaseUtc(zona, t)
  return dispositivo === null || consultorio === null ? 0 : dispositivo - consultorio
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function aHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Un tramo de un día de la semana (`fc`, 0 = domingo), en minutos de la hora del dispositivo. */
interface TramoDia { fc: number; desde: number; hasta: number }

/** Los tramos de un horario movidos `desfase` minutos; el que cruza medianoche se parte en los dos días. */
function tramosEnDispositivo(h: Horario, desfase: number): TramoDia[] {
  const tramos: TramoDia[] = []
  for (const { key, fc } of DIAS) {
    const dia = h[key]
    if (!dia?.activo) continue
    const desde = aMinutos(dia.inicio) + desfase
    const hasta = aMinutos(dia.fin) + desfase
    for (let k = Math.floor(desde / MIN_DIA); k * MIN_DIA < hasta; k++) {
      const a = Math.max(desde, k * MIN_DIA) - k * MIN_DIA
      const b = Math.min(hasta, (k + 1) * MIN_DIA) - k * MIN_DIA
      if (b > a) tramos.push({ fc: (((fc + k) % 7) + 7) % 7, desde: a, hasta: b })
    }
  }
  return tramos
}

/** Un tramo por día: de la apertura más temprana al cierre más tardío. */
function unionPorDia(tramos: readonly TramoDia[]): Horario {
  const d = (key: DiaSemana, fc: number): HorarioDia => {
    const delDia = tramos.filter(t => t.fc === fc)
    return delDia.length === 0
      ? { activo: false, inicio: HORARIO_DEFAULT[key].inicio, fin: HORARIO_DEFAULT[key].fin }
      : { activo: true, inicio: aHHMM(Math.min(...delDia.map(t => t.desde))), fin: aHHMM(Math.max(...delDia.map(t => t.hasta))) }
  }
  return {
    lunes: d('lunes', 1), martes: d('martes', 2), miercoles: d('miercoles', 3), jueves: d('jueves', 4),
    viernes: d('viernes', 5), sabado: d('sabado', 6), domingo: d('domingo', 0),
  }
}

/** `businessHours`: un tramo por consultorio y día, sin repetidos y en orden fijo. */
function horasHabiles(tramos: readonly TramoDia[]): HoraHabil[] {
  const vistos = new Set<string>()
  const salida: HoraHabil[] = []
  const ordenados = [...tramos].sort((x, y) => x.fc - y.fc || x.desde - y.desde || x.hasta - y.hasta)
  for (const t of ordenados) {
    const clave = `${t.fc}|${t.desde}|${t.hasta}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push({ daysOfWeek: [t.fc], startTime: aHHMM(t.desde), endTime: aHHMM(t.hasta) })
  }
  return salida
}

/**
 * ¿Dicen lo mismo el horario de la clínica y los tramos de los consultorios?
 * Los mismos días abiertos, y en cada uno todos los tramos con las mismas horas. Es el
 * caso de toda clínica recién migrada (`20261119130000`): entonces la rejilla
 * usa el objeto de la clínica tal cual y no cambia nada de lo que recibe
 * FullCalendar al encenderse la v2.
 */
function igualQueLaClinica(clinica: Horario, h: Horario, tramos: readonly TramoDia[]): boolean {
  return DIAS.every(({ key, fc }) => {
    const c = clinica[key]
    if (!c?.activo) return !h[key].activo
    const delDia = tramos.filter(t => t.fc === fc)
    return delDia.length > 0 && delDia.every(t => aHHMM(t.desde) === c.inicio && aHHMM(t.hasta) === c.fin)
  })
}

/** El horario y el gris de la rejilla (ver la cabecera). `previa`: la salida anterior, que se devuelve si no cambió. */
export function fuenteDeLaRejilla(e: EntradaRejilla, previa: FuenteRejilla | null = null): FuenteRejilla {
  const clinica = e.horarioClinica ?? HORARIO_DEFAULT
  if (!e.agendaV2 || e.seleccion.length === 0) return { horario: clinica, businessHours: null }
  const t = e.referencia || Date.now()
  const tramos = e.seleccion.flatMap(c => tramosEnDispositivo(
    horarioEfectivo(c, e.horarioClinica ?? null), desfaseConDispositivo(c.timezone, e.zonaDispositivo, t)))
  const horario = unionPorDia(tramos)
  if (igualQueLaClinica(clinica, horario, tramos)) return { horario: clinica, businessHours: null }
  const businessHours = horasHabiles(tramos)
  const igual = previa?.businessHours != null
    && JSON.stringify([previa.horario, previa.businessHours]) === JSON.stringify([horario, businessHours])
  return igual && previa ? previa : { horario, businessHours }
}

/* ── El aviso de fuera de horario, en la hora del consultorio de la cita ── */

/** Un horario contra el que avisar, con su zona (`null` = la del dispositivo, lo de antes). */
export interface HorarioEnZona {
  horario: Horario
  zona: string | null
  /** «esta clínica» (el de la clínica, como antes) o «este consultorio». */
  sujeto: string
}

/** Dónde va la cita, si se sabe. */
export interface DondeCita { consultorioId?: string | null; medicoId?: string | null }

export interface EntradaAvisos {
  agendaV2: boolean
  horarioClinica: Horario | null | undefined
  /** Todos los que la agenda conoce, también archivados (una cita puede ser de uno). */
  consultorios: readonly ConsultorioRejilla[]
  /** Los de la rejilla (`consultoriosDeLaRejilla`): para un alta sin consultorio todavía. */
  seleccion: readonly ConsultorioRejilla[]
}

export interface AvisosHorario {
  /** El aviso de una cita con hora (su inicio y, si lo hay, su fin), o `null`. */
  hora(inicio: Date, fin: Date | null, encabezado: string, donde?: DondeCita): string | null
  /** El de un alta sin hora: ¿se atiende ese día? */
  dia(dia: Date, donde?: DondeCita): string | null
}

/** Contra qué se compara una cita: su consultorio; si no, los de su médico; si no, los de la rejilla. */
export function horariosParaAviso(e: EntradaAvisos, donde?: DondeCita): HorarioEnZona[] {
  const deClinica: HorarioEnZona[] = [{ horario: e.horarioClinica ?? HORARIO_DEFAULT, zona: null, sujeto: SUJETO_CLINICA }]
  if (!e.agendaV2) return deClinica
  const enZona = (c: ConsultorioRejilla): HorarioEnZona => ({
    horario: horarioEfectivo(c, e.horarioClinica ?? null), zona: c.timezone ?? null, sujeto: 'este consultorio',
  })
  const propio = donde?.consultorioId ? e.consultorios.find(c => c.id === donde.consultorioId) : undefined
  if (propio) return [enZona(propio)]
  const delMedico = donde?.medicoId
    ? e.consultorios.filter(c => c.medico_id === donde.medicoId && c.activo !== false)
    : []
  const lista = delMedico.length ? delMedico : e.seleccion
  return lista.length ? lista.map(enZona) : deClinica
}

/**
 * Un `Date` cuya hora de pared en el DISPOSITIVO es la de `t` en `zona`: así
 * los avisos de siempre (`getDay`/`getHours`) leen la hora del consultorio.
 * Con `null` o una zona que no vale, `t` tal cual.
 */
function enHoraDe(t: Date, zona: string | null): Date {
  if (!zona) return t
  const p = paredEnZona(t.getTime(), zona)
  return p ? new Date(p.year, p.month - 1, p.day, p.hour, p.minute) : t
}

/** La forma del aviso de un horario en el instante `t`: «este consultorio» y la zona si su hora no es la del dispositivo. */
function formaDe(h: HorarioEnZona, t: Date): FormaAviso | undefined {
  if (h.sujeto === SUJETO_CLINICA) return undefined
  const otraHora = h.zona !== null && horaDeReloj(enHoraDe(t, h.zona)) !== horaDeReloj(t)
  return { sujeto: h.sujeto, sufijoHora: otraHora && h.zona ? ` hora ${regionDeTimezone(h.zona)}` : '' }
}

/** El aviso de UN horario: el del inicio y, si no, el del fin (las reglas de siempre), en su zona. */
function avisoDeUno(h: HorarioEnZona, inicio: Date, fin: Date | null, encabezado: string): string | null {
  const deInicio = avisoFueraDeHorario(enHoraDe(inicio, h.zona), h.horario, encabezado, formaDe(h, inicio))
  if (deInicio || !fin) return deInicio
  return avisoFinFueraDeHorario(enHoraDe(fin, h.zona), h.horario, formaDe(h, fin))
}

/** ¿Abre ese horario el día de `t`, en su zona? */
function abreElDia(h: HorarioEnZona, t: Date): boolean {
  const dia = DIAS.find(d => d.fc === enHoraDe(t, h.zona).getDay())
  return dia ? h.horario[dia.key]?.activo === true : false
}

/**
 * Los avisos de la agenda. Una cita está bien si CABE en alguno de sus
 * horarios; si no cabe en ninguno, el texto es el del primero que abre ese día
 * (o el del primero, si no abre ninguno). Con un solo horario es el aviso de
 * siempre; apagada, el de la clínica en la hora del dispositivo, al bit.
 */
export function crearAvisosHorario(e: EntradaAvisos): AvisosHorario {
  return {
    hora(inicio, fin, encabezado, donde) {
      const horarios = horariosParaAviso(e, donde)
      const avisos = horarios.map(h => avisoDeUno(h, inicio, fin, encabezado))
      if (avisos.some(a => a === null)) return null
      const i = horarios.findIndex(h => abreElDia(h, inicio))
      return avisos[i < 0 ? 0 : i]
    },
    dia(dia, donde) {
      /* Una fecha sin hora es un día de calendario: se mira en el dispositivo, no en otra zona. */
      const horarios = horariosParaAviso(e, donde)
      const avisos = horarios.map(h => avisoDiaCerrado(dia, h.horario, formaDe({ ...h, zona: null }, dia)))
      return avisos.some(a => a === null) ? null : avisos[0]
    },
  }
}
