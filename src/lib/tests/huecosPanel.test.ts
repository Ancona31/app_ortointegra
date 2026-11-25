/**
 * huecosPanel.test.ts — H4 (ajuste de la integración de la tanda H): con la
 * duración de la consulta conocida, el panel «Huecos disponibles» considera
 * hueco todo tramo libre que la alcance, no sólo los de `HUECO_MINIMO`
 * (60 min). Sin duración, los de siempre.
 *
 * MUTACIÓN (comprobada en rojo): `huecosDelPanel` devolviendo siempre
 * `r.huecos` (el tramo de 45 min no sale con consulta de 45).
 */
import { describe, it, expect } from 'vitest'
import { HUECO_MINIMO, huecosDelPanel, type ResumenDia } from '@/lib/agenda/huecosAgenda'
import { huecosDe } from '@/lib/agenda/tramos'

/* Jornada 9:00–13:00; ocupado 10:00–10:15 y 11:00–12:00 → libres 9:00–10:00 (60),
   10:15–11:00 (45) y 12:00–13:00 (60). */
const JORNADA = { desde: 540, hasta: 780 }
const OCUPADOS = [{ desde: 600, hasta: 615 }, { desde: 660, hasta: 720 }]
const resumen: ResumenDia = {
  dia: new Date(2026, 10, 16), porEstado: [], todoElDia: 0, jornada: JORNADA, ocupadas: 75, libres: 165,
  huecos: huecosDe(JORNADA, OCUPADOS, HUECO_MINIMO),
  tramosLibres: huecosDe(JORNADA, OCUPADOS, 1),
}

describe('huecosDelPanel', () => {
  it('sin duración conocida, los huecos de siempre (≥ 60 min)', () => {
    expect(huecosDelPanel(resumen, null)).toEqual([{ desde: 540, hasta: 600 }, { desde: 720, hasta: 780 }])
  })
  it('MUTACIÓN: con consulta de 45 min, el tramo libre de 45 min ya es hueco', () => {
    expect(huecosDelPanel(resumen, 45)).toEqual([{ desde: 540, hasta: 600 }, { desde: 615, hasta: 660 }, { desde: 720, hasta: 780 }])
  })
  it('con consulta de 90 min, el mínimo es 90: ningún tramo de 60 lo alcanza', () => {
    expect(huecosDelPanel(resumen, 90)).toEqual([])
  })
})
