import { describe, expect, it } from 'vitest'
import { MARGEN_VENTANA, posicionCapa, SEPARACION_CAPA, SUBIDA_CAPA } from '@/lib/agenda/posicionCapa'

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
