/**
 * src/lib/agenda/huecosAgenda.ts
 *
 * Los huecos libres del día y el resumen del panel de día: tramos ocupados,
 * su fusión y recorte a la jornada, el desglose por estado y las etiquetas
 * que lo escriben. `jornadaDelDia` vive aquí y no en `horarioAgenda.ts`
 * —aunque el mapa original la listaba como "Horario"— para evitar un
 * import circular: necesita `Tramo` y `minutosDeReloj`, que son de este
 * módulo. Movido tal cual desde `AgendaCliente.tsx` (A2.1, movimiento
 * puro), con sus comentarios; sólo cambiaron los `import`/`export` que
 * hacían falta.
 */

import type { EventApi } from '@fullcalendar/core'
import type { Horario } from '@/lib/configApp'
import type { Appointment, Status } from './tiposAgenda'
import { DIAS } from './horarioAgenda'
import { ESTADOS_CITA, esEventoGenerico } from './tarjetasAgenda'

/** Un tramo del día, en MINUTOS DESDE LA MEDIANOCHE LOCAL.
 *
 *  ⚠️ MINUTOS Y NO `Date`, A PROPÓSITO. El horario del consultorio es hora de
 *  PARED (`'09:00'`) y la rejilla coloca los eventos en la zona del navegador,
 *  que es la misma base. Trabajar en minutos desde medianoche deja la
 *  aritmética en enteros y hace que recortar, fusionar y restar sean una línea
 *  cada uno. La única grieta conocida es el día del cambio de horario de
 *  verano, donde «minutos desde medianoche» y hora de pared se separan 60: en
 *  México no aplica desde 2022, y el precio de cubrirlo sería arrastrar husos
 *  por todo el cálculo. */
export type Tramo = { desde: number; hasta: number }

const MINUTOS_POR_DIA = 24 * 60

/** El tramo libre más corto que se ofrece. Por debajo no cabe una consulta, y
 *  listarlo sería ruido: en el mockup los huecos de 30 min entre citas no
 *  salen. Es la misma cifra que dice el texto de la tarjeta vacía. */
export const HUECO_MINIMO = 60

export function minutosDeReloj(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export function relojDeMinutos(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** «08:00 – 09:00». Guión largo, el mismo que `titleRangeSeparator`. */
export function etiquetaDeRango(t: Tramo): string {
  return `${relojDeMinutos(t.desde)} – ${relojDeMinutos(t.hasta)}`
}

/** «60 min», «2 h», «2 h 30 min». El corte en 120 no es arbitrario: el mockup
 *  escribe «60 min» y no «1 h», así que la hora sola no se abrevia. */
export function etiquetaDeDuracion(min: number): string {
  if (min < 120) return `${min} min`
  const resto = min % 60
  return resto === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${resto} min`
}

/** «5:00». El número grande del tile, en la forma H:MM del mockup. */
export function etiquetaDeHoras(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

/** La medianoche local del día. Base de toda la aritmética de este bloque. */
export function medianocheDe(dia: Date): Date {
  const d = new Date(dia)
  d.setHours(0, 0, 0, 0)
  return d
}

/** La jornada del consultorio ese día, o `null` si no abre.
 *
 *  Sale del MISMO objeto `horario` que alimenta `businessHours`, así que el
 *  gris de fuera de horario de la rejilla y el suelo/techo de los huecos no
 *  pueden decir cosas distintas. */
export function jornadaDelDia(dia: Date, horario: Horario): Tramo | null {
  const conf = DIAS.find(d => d.fc === dia.getDay())
  if (!conf) return null
  const hd = horario[conf.key]
  if (!hd?.activo) return null
  const desde = minutosDeReloj(hd.inicio)
  const hasta = minutosDeReloj(hd.fin)
  return hasta > desde ? { desde, hasta } : null
}

/** Si un evento consume hora del día. Las reglas están arriba, en la cabecera
 *  del bloque; esto es su única implementación. */
export function eventoOcupa(ev: EventApi): boolean {
  if (ev.allDay) return false
  /* ANOTADO Y NO CASTEADO, igual que en `filasDelDia`: `extendedProps` es
     `Dictionary` (`Record<string, any>`) y leerlo directo mete `any` en el
     archivo. `Partial` porque la fuente de Google no trae ninguno. */
  const ext: Partial<Appointment> & { isGcalBlock?: boolean } = ev.extendedProps
  if (ext?.isGcalBlock === true) return true
  return ext?.status !== 'cancelled'
}

/**
 * Los tramos que los eventos ocupan dentro del día, ya recortados a él y sin
 * ordenar. Uno por evento: la fusión es el paso siguiente.
 *
 * ⚠️ SOLAPAMIENTO SEMIABIERTO, igual que en `filasDelDia`: un evento que TERMINA
 * a la medianoche de este día es del día anterior y no entra. Y el recorte a
 * `[0, MINUTOS_POR_DIA]` es lo que deja pasar sin cuidado a los eventos que
 * cruzan la medianoche por cualquiera de los dos extremos.
 */
export function tramosDeOcupacion(eventos: readonly EventApi[], dia: Date): Tramo[] {
  const base = medianocheDe(dia).getTime()
  const fin = base + MINUTOS_POR_DIA * 60_000
  const tramos: Tramo[] = []
  for (const ev of eventos) {
    if (!ev.start || !ev.end) continue
    if (!(ev.start.getTime() < fin && ev.end.getTime() > base)) continue
    if (!eventoOcupa(ev)) continue
    const desde = Math.max(0, Math.round((ev.start.getTime() - base) / 60_000))
    const hasta = Math.min(MINUTOS_POR_DIA, Math.round((ev.end.getTime() - base) / 60_000))
    if (hasta > desde) tramos.push({ desde, hasta })
  }
  return tramos
}

/** Ordena y funde los solapados en uno. Sin esto dos citas de 09:00–10:00 y
 *  09:30–10:30 darían dos horas ocupadas donde sólo hay hora y media, y el
 *  complemento —los huecos— saldría con tramos negativos. */
export function fusionarTramos(tramos: readonly Tramo[]): Tramo[] {
  const fundidos: Tramo[] = []
  for (const t of [...tramos].sort((a, b) => a.desde - b.desde)) {
    const ultimo = fundidos[fundidos.length - 1]
    if (ultimo && t.desde <= ultimo.hasta) ultimo.hasta = Math.max(ultimo.hasta, t.hasta)
    else fundidos.push({ ...t })
  }
  return fundidos
}

/**
 * Recorta los tramos a la jornada y descarta los que se quedan fuera.
 *
 * ⚠️ ES LO QUE HACE QUE `ocupadas + libres` SEA LA JORNADA, SIEMPRE. Una cirugía
 * de 19:00 a 21:00 con el consultorio hasta las 18:00 aporta CERO horas
 * ocupadas: el día tiene diez horas de consulta y las diez se reparten entre
 * ocupadas y libres. Sin el recorte los dos números dejarían de ser
 * complementarios y el panel enseñaría una suma que no cuadra con su propio
 * horario. Es también lo que el mockup comprueba: 08:00–18:00, 5:00 y 5:00.
 */
export function recortarATramo(tramos: readonly Tramo[], jornada: Tramo): Tramo[] {
  const dentro: Tramo[] = []
  for (const t of tramos) {
    const desde = Math.max(t.desde, jornada.desde)
    const hasta = Math.min(t.hasta, jornada.hasta)
    if (hasta > desde) dentro.push({ desde, hasta })
  }
  return dentro
}

/** El complemento de la ocupación dentro de la jornada, con suelo de duración.
 *  `ocupados` tiene que llegar ordenado y fundido. */
export function huecosDe(jornada: Tramo, ocupados: readonly Tramo[], minimo: number): Tramo[] {
  const huecos: Tramo[] = []
  let cursor = jornada.desde
  for (const t of ocupados) {
    if (t.desde - cursor >= minimo) huecos.push({ desde: cursor, hasta: t.desde })
    cursor = Math.max(cursor, t.hasta)
  }
  if (jornada.hasta - cursor >= minimo) huecos.push({ desde: cursor, hasta: jornada.hasta })
  return huecos
}

/**
 * El desglose por estado, SÓLO DE CITAS y sólo con los estados presentes.
 *
 * Cuenta las que TOCAN el día, no las que empiezan en él; el porqué está en la
 * reja, junto a la comparación.
 *
 * Ni los eventos genéricos ni los de Google entran: un evento no tiene estado
 * de cita —`ESTADOS_EVENTO` sólo le ofrece dos de los cinco— y un bloque de
 * Google no tiene ninguno. El mockup lo confirma: tres citas arriba, «2
 * agendadas · 1 atendida» abajo, y los tres eventos fuera de la lista.
 *
 * El orden es el de `ESTADOS_CITA`, que es el mismo del selector y el de la
 * leyenda: tres sitios que enumeran estados y ninguno en un orden propio.
 */
export function desgloseDeEstados(
  eventos: readonly EventApi[],
  dia: Date,
): { estado: Status; n: number }[] {
  const base = medianocheDe(dia).getTime()
  const fin = base + MINUTOS_POR_DIA * 60_000
  const cuenta = new Map<Status, number>()
  for (const ev of eventos) {
    if (!ev.start) continue
    /* ⚠️ POR SOLAPE, NO POR DÓNDE EMPIEZA, Y ES LA CUARTA REJA IGUAL A LAS OTRAS
       TRES. Aquí decía `start >= base && start < fin`, y era el ÚNICO sitio del
       archivo que contaba de otra manera: `tramosDeOcupacion` (arriba),
       `contarTodoElDia` (abajo) y `contarVisibles` ya preguntaban si el evento
       TOCA el día. Con el criterio viejo, una cita que empieza el lunes y
       termina el martes no aparecía en el desglose del martes aunque el panel
       de ese día sí la contara como ocupación — dos números del MISMO panel
       sacados de dos reglas distintas.
       Que sea raro no lo salva: una cita de varios días con paciente asignado
       es poco común, pero la incoherencia es permanente y el día que alguien
       cree una, el desglose y las horas ocupadas se contradicen sin avisar.
       Se escribe con la misma forma negada que `tramosDeOcupacion:4334` para
       que las cuatro se lean igual. `ev.end ?? ev.start` porque aquí, a
       diferencia de allí, no se exige `end` antes: una fila sin fin cuenta como
       instantánea, que es lo que ya hace `contarTodoElDia`. */
    if (!(ev.start.getTime() < fin && (ev.end ?? ev.start).getTime() > base)) continue
    const ext: Partial<Appointment> & { isGcalBlock?: boolean } = ev.extendedProps
    if (ext?.isGcalBlock === true) continue
    if (esEventoGenerico({ paciente_id: ext?.paciente_id ?? null })) continue
    const estado = ext?.status
    if (!estado) continue
    cuenta.set(estado, (cuenta.get(estado) ?? 0) + 1)
  }
  return ESTADOS_CITA
    .map(estado => ({ estado, n: cuenta.get(estado) ?? 0 }))
    .filter(x => x.n > 0)
}

/** Cuántos eventos de todo el día caen en el día. Sólo para la línea que
 *  explica por qué no dan horas; no entra en ningún número. */
export function contarTodoElDia(eventos: readonly EventApi[], dia: Date): number {
  const base = medianocheDe(dia).getTime()
  const fin = base + MINUTOS_POR_DIA * 60_000
  let n = 0
  for (const ev of eventos) {
    if (!ev.allDay || !ev.start) continue
    if (ev.start.getTime() < fin && (ev.end ?? ev.start).getTime() > base) n += 1
  }
  return n
}

/** Todo lo que el panel pinta, ya resuelto. Aquí no se vuelve a mirar ningún
 *  `EventApi`: el panel es una función de esto. */
export type ResumenDia = {
  /** El día resumido. Lo necesita el clic en un hueco para componer la
      selección; no se vuelve a derivar del calendario. */
  dia: Date
  porEstado: readonly { estado: Status; n: number }[]
  todoElDia: number
  /** `null` cuando el consultorio no abre. Entonces no hay horas ni huecos. */
  jornada: Tramo | null
  /** Minutos. Complementarios dentro de la jornada: suman su duración. */
  ocupadas: number
  libres: number
  huecos: readonly Tramo[]
}

export function resumenDelDia(eventos: readonly EventApi[], dia: Date, horario: Horario): ResumenDia {
  const porEstado = desgloseDeEstados(eventos, dia)
  const todoElDia = contarTodoElDia(eventos, dia)
  const jornada = jornadaDelDia(dia, horario)
  if (!jornada) return { dia, porEstado, todoElDia, jornada: null, ocupadas: 0, libres: 0, huecos: [] }

  const ocupados = recortarATramo(fusionarTramos(tramosDeOcupacion(eventos, dia)), jornada)
  const ocupadas = ocupados.reduce((suma, t) => suma + (t.hasta - t.desde), 0)
  return {
    dia,
    porEstado,
    todoElDia,
    jornada,
    ocupadas,
    libres: (jornada.hasta - jornada.desde) - ocupadas,
    huecos: huecosDe(jornada, ocupados, HUECO_MINIMO),
  }
}

/* La misma disciplina de guarda que `ventana`, `conteo` y `filasDia`: se compara
   una CADENA y no el objeto, porque el resumen se reconstruye entero en cada
   llamada y su identidad no vale para nada. Con la firma, un `eventsSet` que no
   cambia nada del día muere en el bail-out de React. */
export function firmaDelResumen(r: ResumenDia | null): string {
  if (!r) return ''
  return [
    r.dia.getTime(), r.todoElDia, r.ocupadas, r.libres,
    r.jornada ? `${r.jornada.desde}-${r.jornada.hasta}` : 'cerrado',
    r.porEstado.map(e => `${e.estado}:${e.n}`).join(','),
    r.huecos.map(h => `${h.desde}-${h.hasta}`).join(','),
  ].join('|')
}

