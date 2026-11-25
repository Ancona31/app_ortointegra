import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDeslizador, type EventoPuntero, type VistaDeslizable } from '@/app/(app)/agenda/useDeslizarPeriodo'

/* Un «Element» de juguete: lo justo para que `instanceof Element` y `closest` funcionen sin DOM. */
class ElementoFalso {
  constructor(private readonly enHarness: boolean) {}
  closest(): ElementoFalso | null { return this.enHarness ? this : null }
  addEventListener(): void { /* nada */ }
  removeEventListener(): void { /* nada */ }
  dispatchEvent(): boolean { return true }
}

beforeEach(() => { vi.stubGlobal('Element', ElementoFalso) })
afterEach(() => { vi.unstubAllGlobals() })

function vista(): VistaDeslizable & { animaciones: number } {
  const v = { style: { transform: '' }, animaciones: 0, animate: () => { v.animaciones++; return null } }
  return v
}

const ev = (type: string, x: number, t: number, extra: Partial<EventoPuntero> = {}): EventoPuntero => ({
  type, pointerType: 'touch', clientX: x, clientY: 400, timeStamp: t, target: new ElementoFalso(true), ...extra,
})

function deslizar(xs: number[], tFin: number, extra: Partial<EventoPuntero> = {}) {
  const v = vista()
  const salidas = { alSiguiente: vi.fn(), alAnterior: vi.fn() }
  const d = crearDeslizador(() => 390, () => v, () => salidas)
  d.alApoyar(ev('pointerdown', xs[0], 0, extra))
  for (const x of xs.slice(1)) d.alMover(ev('pointermove', x, 10, extra))
  return { v, salidas, d, soltar: (tipo = 'pointerup') => d.alSoltar(ev(tipo, xs[xs.length - 1], tFin, extra)) }
}

describe('crearDeslizador', () => {
  it('la vista sigue al dedo y, pasado el umbral, va al periodo siguiente y vuelve a cero', () => {
    const r = deslizar([300, 280, 200], 1000)
    expect(r.v.style.transform).toMatch(/^translateX\(-/)
    r.soltar()
    expect(r.salidas.alSiguiente).toHaveBeenCalledTimes(1)
    expect(r.v.style.transform).toBe('')
    expect(r.v.animaciones).toBe(0)
  })
  it('sin pasar el umbral vuelve a su sitio animando', () => {
    const r = deslizar([300, 285, 270], 2000)
    r.soltar()
    expect(r.salidas.alSiguiente).not.toHaveBeenCalled()
    expect(r.v.animaciones).toBe(1)
  })
  it('con movimiento reducido vuelve sin animar', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const r = deslizar([300, 285, 270], 2000)
    r.soltar()
    expect(r.v.animaciones).toBe(0)
    expect(r.v.style.transform).toBe('')
  })
  it('el ratón no desliza', () => {
    const r = deslizar([300, 280, 100], 100, { pointerType: 'mouse' })
    r.soltar()
    expect(r.salidas.alSiguiente).not.toHaveBeenCalled()
    expect(r.v.style.transform).toBe('')
  })
  it('fuera del harness no desliza', () => {
    const r = deslizar([300, 280, 100], 100, { target: new ElementoFalso(false) })
    r.soltar()
    expect(r.salidas.alSiguiente).not.toHaveBeenCalled()
  })
  it('pointercancel (el navegador se quedó el scroll) devuelve sin pasar de periodo', () => {
    const r = deslizar([300, 280, 100], 100)
    r.soltar('pointercancel')
    expect(r.salidas.alSiguiente).not.toHaveBeenCalled()
    expect(r.salidas.alAnterior).not.toHaveBeenCalled()
  })
})
