import { describe, expect, it } from 'vitest'
import { iniciarGesto, moverGesto, resistencia, terminarGesto, UMBRAL_PX } from '@/lib/agenda/gestoDeslizar'

const ANCHO = 390

/** Un gesto entero: apoyar, una serie de puntos, levantar. */
function gesto(puntos: [number, number][], tFin: number) {
  let e = iniciarGesto(puntos[0][0], puntos[0][1], 0, ANCHO)
  for (const [x, y] of puntos.slice(1)) e = moverGesto(e, x, y)
  return { estado: e, desenlace: terminarGesto(e, tFin) }
}

describe('gestoDeslizar', () => {
  it('hacia la izquierda más de 64 px pasa al periodo siguiente', () => {
    expect(gesto([[300, 400], [280, 402], [200, 405]], 1000).desenlace).toBe('siguiente')
  })
  it('hacia la derecha pasa al anterior', () => {
    expect(gesto([[100, 400], [120, 400], [180, 400]], 1000).desenlace).toBe('anterior')
  })
  it('un golpe corto pero rápido (≥ 0.4 px/ms) también pasa', () => {
    expect(gesto([[300, 400], [285, 400], [260, 400]], 80).desenlace).toBe('siguiente')
  })
  it('corto y lento no pasa', () => {
    expect(gesto([[300, 400], [285, 400], [260, 400]], 1000).desenlace).toBeNull()
  })
  it('si gana el eje vertical es scroll nativo y no se hace nada', () => {
    const r = gesto([[200, 300], [203, 320], [150, 340]], 50)
    expect(r.estado.eje).toBe('vertical')
    expect(r.desenlace).toBeNull()
  })
  it('el eje no se decide antes de 10 px', () => {
    const e = moverGesto(iniciarGesto(200, 200, 0, ANCHO), 206, 203)
    expect(e.eje).toBeNull()
  })
  it('MUTACIÓN: lo que empieza a 20 px o menos del borde se ignora (gestos del sistema)', () => {
    expect(gesto([[15, 400], [100, 400], [200, 400]], 100).desenlace).toBeNull()
    expect(gesto([[ANCHO - 10, 400], [300, 400], [100, 400]], 100).desenlace).toBeNull()
  })
  it('la resistencia amortigua pasado el umbral y conserva el signo', () => {
    expect(resistencia(UMBRAL_PX)).toBeCloseTo(UMBRAL_PX * 0.6)
    expect(resistencia(-200)).toBeLessThan(0)
    expect(Math.abs(resistencia(200))).toBeLessThan(200 * 0.6)
  })
})
