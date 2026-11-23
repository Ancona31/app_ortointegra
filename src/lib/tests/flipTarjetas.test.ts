import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  animarFlip, deltaFlip, fotogramasFlip, medirTarjeta, selectorDeCita,
  type NodoAnimable, type RaizTarjetas, type Rect,
} from '@/lib/agenda/flipTarjetas'

/* Comprobación de tipos, sin ejecutarse: el DOM real cumple los dos contratos. */
export const _elDomCumple: (d: Document, e: HTMLElement) => [RaizTarjetas, NodoAnimable] = (d, e) => [d, e]

interface NodoFalso extends NodoAnimable { rect: Rect; animaciones: { fotogramas: Keyframe[]; opciones: KeyframeAnimationOptions }[] }

function nodo(rect: Rect, esFila = false): NodoFalso {
  const n: NodoFalso = {
    rect,
    animaciones: [],
    getBoundingClientRect: () => n.rect,
    animate: (fotogramas, opciones) => { n.animaciones.push({ fotogramas, opciones }); return null },
    closest: () => n,
    matches: (s: string) => esFila && s === '.fc-list-event',
  }
  return n
}

function raizCon(mapa: Record<string, NodoFalso>): RaizTarjetas {
  return { querySelector: (s: string) => Object.entries(mapa).find(([id]) => s === selectorDeCita(id))?.[1] ?? null }
}

const R = (left: number, top: number): Rect => ({ left, top, width: 100, height: 40 })

afterEach(() => { vi.unstubAllGlobals() })

describe('deltaFlip', () => {
  it('da lo que hay que desplazar el nodo nuevo para que parezca estar donde estaba', () => {
    expect(deltaFlip(R(10, 100), R(10, 160))).toEqual({ dx: 0, dy: -60 })
  })
  it('null si no se movió (subpíxel incluido) o si falta una medida', () => {
    expect(deltaFlip(R(10, 100), R(10.2, 100.3))).toBeNull()
    expect(deltaFlip(null, R(0, 0))).toBeNull()
    expect(deltaFlip(R(0, 0), null)).toBeNull()
  })
})

describe('fotogramasFlip', () => {
  it('va del desplazamiento a none, sólo con transform', () => {
    expect(fotogramasFlip({ dx: 3, dy: -60 })).toEqual([{ transform: 'translate(3px, -60px)' }, { transform: 'none' }])
  })
})

describe('selectorDeCita', () => {
  it('cita el id como cadena: comillas y barras no rompen el selector', () => {
    expect(selectorDeCita('abc')).toBe('[data-cita-id="abc"]')
    expect(selectorDeCita('a"b')).toBe('[data-cita-id="a\\"b"]')
  })
})

describe('animarFlip', () => {
  it('traslada la tarjeta de la rejilla con base y --ag-ease', () => {
    const n = nodo(R(10, 100))
    const raiz = raizCon({ c1: n })
    const aplicar = vi.fn(() => { n.rect = R(10, 220) })
    expect(animarFlip(raiz, 'c1', aplicar)).toBe('trasladada')
    expect(aplicar).toHaveBeenCalledTimes(1)
    expect(n.animaciones[0].fotogramas[0]).toEqual({ transform: 'translate(0px, -120px)' })
    expect(n.animaciones[0].opciones).toEqual({ duration: 180, easing: 'cubic-bezier(.4, 0, .2, 1)' })
  })
  it('en una fila de lista sólo funde la opacidad', () => {
    const n = nodo(R(0, 100), true)
    expect(animarFlip(raizCon({ c1: n }), 'c1', () => { n.rect = R(0, 300) })).toBe('fundida')
    expect(n.animaciones[0].fotogramas).toEqual([{ opacity: 0 }, { opacity: 1 }])
  })
  it('sin tarjeta pintada aplica el cambio y no anima (degrada a hoy)', () => {
    const aplicar = vi.fn()
    expect(animarFlip(raizCon({}), 'c1', aplicar)).toBe('sin-animar')
    expect(aplicar).toHaveBeenCalledTimes(1)
  })
  it('si no se movió no anima', () => {
    const n = nodo(R(0, 100))
    expect(animarFlip(raizCon({ c1: n }), 'c1', () => undefined)).toBe('sin-animar')
    expect(n.animaciones).toHaveLength(0)
  })
  it('MUTACIÓN: con movimiento reducido aplica y no mide ni anima', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const n = nodo(R(0, 100))
    const aplicar = vi.fn(() => { n.rect = R(0, 400) })
    expect(animarFlip(raizCon({ c1: n }), 'c1', aplicar)).toBe('sin-animar')
    expect(aplicar).toHaveBeenCalledTimes(1)
    expect(n.animaciones).toHaveLength(0)
  })
})

describe('medirTarjeta', () => {
  it('lee el rectángulo del .fc-event de la cita', () => {
    expect(medirTarjeta(raizCon({ c1: nodo(R(5, 6)) }), 'c1')).toEqual(R(5, 6))
    expect(medirTarjeta(raizCon({}), 'c1')).toBeNull()
  })
})
