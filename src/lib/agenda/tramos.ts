/**
 * src/lib/agenda/tramos.ts
 *
 * La aritmética de tramos del día, sin calendario ni huso: lo que comparten el
 * panel de día del navegador (`huecosAgenda.ts`) y el cálculo de turnos del
 * servidor (`turnosAgenda.ts`). Movido tal cual desde `huecosAgenda.ts` (B8,
 * movimiento puro), que lo vuelve a exportar para que sus llamadores no
 * cambien. Sin `'use client'` y sin tipos de FullCalendar: tiene que poder
 * importarse desde un route handler.
 */

/** Un tramo del día, en MINUTOS DESDE LA MEDIANOCHE.
 *
 *  ⚠️ MINUTOS Y NO `Date`, A PROPÓSITO. El horario del consultorio es hora de
 *  PARED (`'09:00'`). Trabajar en minutos desde medianoche deja la aritmética
 *  en enteros y hace que recortar, fusionar y restar sean una línea cada uno.
 *  De qué medianoche se cuenta lo decide quien traduce instantes a minutos, y
 *  ahí vive el horario de verano: ver `huecosAgenda.ts` (el navegador) y
 *  `turnosAgenda.ts` (el servidor). */
export type Tramo = { desde: number; hasta: number }

export const MINUTOS_POR_DIA = 24 * 60

export function minutosDeReloj(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export function relojDeMinutos(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
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
