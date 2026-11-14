import { describe, expect, it } from 'vitest'
import {
  ALTO_MINIMO_CAPA, MARGEN_VENTANA, posicionCapa, SEPARACION_CAPA, SUBIDA_CAPA, ventanaVisible,
} from '@/lib/agenda/posicionCapa'

const VENTANA = { width: 1440, height: 900 }
const CAPA = { width: 320, height: 240 }

describe('posicionCapa', () => {
  it('a la derecha del ancla si cabe, alineada con su borde de arriba', () => {
    const p = posicionCapa({ left: 300, top: 200, width: 150, height: 60 }, CAPA, VENTANA)
    expect(p.lado).toBe('derecha')
    expect(p.left).toBe(300 + 150 + SEPARACION_CAPA)
    expect(p.top).toBe(200)
  })
  it('a la izquierda si a la derecha no cabe', () => {
    const p = posicionCapa({ left: 1200, top: 200, width: 150, height: 60 }, CAPA, VENTANA)
    expect(p.lado).toBe('izquierda')
    expect(p.left).toBe(1200 - SEPARACION_CAPA - CAPA.width)
  })
  it('debajo si no cabe a ningún lado (la columna ancha de Día)', () => {
    const p = posicionCapa({ left: 20, top: 100, width: 1400, height: 60 }, CAPA, VENTANA)
    expect(p.lado).toBe('abajo')
    expect(p.top).toBe(100 + 60 + SEPARACION_CAPA)
  })
  it('encima si tampoco cabe debajo', () => {
    const p = posicionCapa({ left: 20, top: 700, width: 1400, height: 60 }, CAPA, VENTANA)
    expect(p.lado).toBe('arriba')
    expect(p.top).toBe(700 - SEPARACION_CAPA - CAPA.height)
  })
  it('se ajusta a la ventana con su margen', () => {
    const p = posicionCapa({ left: 300, top: 860, width: 150, height: 30 }, CAPA, VENTANA)
    expect(p.top).toBe(VENTANA.height - MARGEN_VENTANA - CAPA.height)
    expect(p.top + CAPA.height).toBeLessThanOrEqual(VENTANA.height - MARGEN_VENTANA)
  })
  it('con punto, la cabecera queda a la altura del dedo y el origen es el punto', () => {
    const p = posicionCapa({ left: 300, top: 200, width: 150, height: 120 }, CAPA, VENTANA, { x: 380, y: 260 })
    expect(p.top).toBe(260 - SUBIDA_CAPA)
    expect(p.origen).toBe(`0px ${SUBIDA_CAPA}px`)
  })
  it('el origen se recorta a la caja de la capa', () => {
    const p = posicionCapa({ left: 1200, top: 200, width: 150, height: 60 }, CAPA, VENTANA, { x: 1300, y: 230 })
    expect(p.origen.startsWith(`${CAPA.width}px`)).toBe(true)
  })
  it('en una ventana más estrecha que la capa no da coordenadas negativas', () => {
    const p = posicionCapa({ left: 10, top: 10, width: 50, height: 30 }, CAPA, { width: 300, height: 200 })
    expect(p.left).toBe(MARGEN_VENTANA)
    expect(p.top).toBe(MARGEN_VENTANA)
  })
})

/** La caja que ocupa la capa ya pintada, con su `max-height`. */
function caja(p: ReturnType<typeof posicionCapa>, capa: { width: number; height: number }) {
  return { left: p.left, top: p.top, right: p.left + capa.width, bottom: p.top + Math.min(capa.height, p.altoMaximo) }
}

describe('posicionCapa · T1, punto 3: nunca sale de la ventana', () => {
  it('MUTACIÓN: un hueco al fondo con la capa creciendo (resultados) sube y queda dentro', () => {
    const ancla = { left: 300, top: 860, width: 150, height: 30 }
    for (const alto of [240, 420, 600, 880]) {
      const c = { width: 320, height: alto }
      const k = caja(posicionCapa(ancla, c, VENTANA, { x: 380, y: 875 }), c)
      expect(k.top).toBeGreaterThanOrEqual(MARGEN_VENTANA)
      expect(k.bottom).toBeLessThanOrEqual(VENTANA.height - MARGEN_VENTANA)
    }
  })
  it('más alta que la ventana: se acota con max-height (desplazamiento interno)', () => {
    const p = posicionCapa({ left: 300, top: 200, width: 150, height: 60 }, { width: 320, height: 2000 }, VENTANA)
    expect(p.altoMaximo).toBe(VENTANA.height - 2 * MARGEN_VENTANA)
    expect(p.top).toBe(MARGEN_VENTANA)
  })
  it('columna ancha y hueco al fondo: ENCIMA del ancla, sin taparla', () => {
    const ancla = { left: 20, top: 820, width: 1400, height: 40 }
    const p = posicionCapa(ancla, CAPA, VENTANA)
    expect(p.lado).toBe('arriba')
    expect(p.top + CAPA.height).toBeLessThanOrEqual(ancla.top - SEPARACION_CAPA)
  })
  it('columna ancha y sin sitio entero arriba ni abajo: el lado con más sitio, acotada a él', () => {
    const ancla = { left: 0, top: 250, width: 390, height: 40 }
    const v = { width: 390, height: 600 }
    const p = posicionCapa(ancla, { width: 320, height: 400 }, v)
    expect(p.lado).toBe('abajo')
    expect(p.altoMaximo).toBe(600 - MARGEN_VENTANA - (250 + 40 + SEPARACION_CAPA))
    expect(posicionCapa({ ...ancla, top: 300 }, { width: 320, height: 400 }, v).lado).toBe('arriba')
    expect(p.top + p.altoMaximo).toBeLessThanOrEqual(v.height - MARGEN_VENTANA)
  })
  it(`sin ${ALTO_MINIMO_CAPA} px útiles a ningún lado: la ventana entera, aunque tape el ancla`, () => {
    const ancla = { left: 0, top: 100, width: 390, height: 300 }
    const p = posicionCapa(ancla, { width: 320, height: 400 }, { width: 390, height: 500 })
    expect(p.altoMaximo).toBe(500 - 2 * MARGEN_VENTANA)
    expect(p.top).toBe(MARGEN_VENTANA)
  })
  it('con el teclado abierto (parte visible más baja y desplazada) queda dentro de lo que se ve', () => {
    const v = ventanaVisible({ width: 820, height: 500, offsetLeft: 0, offsetTop: 120 }, { width: 820, height: 1180 })
    const ancla = { left: 300, top: 560, width: 150, height: 40 }
    const c = { width: 320, height: 300 }
    const k = caja(posicionCapa(ancla, c, v, { x: 380, y: 580 }), c)
    expect(k.top).toBeGreaterThanOrEqual(120 + MARGEN_VENTANA)
    expect(k.bottom).toBeLessThanOrEqual(120 + 500 - MARGEN_VENTANA)
  })
  it('ventanaVisible sin visualViewport es la de layout', () => {
    expect(ventanaVisible(null, { width: 1440, height: 900 })).toEqual({ left: 0, top: 0, width: 1440, height: 900 })
  })
})
