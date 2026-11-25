import { describe, expect, it } from 'vitest'
import { idDeOpcion, indiceTrasTecla } from '@/lib/agenda/opcionesLista'

describe('indiceTrasTecla', () => {
  it('vertical: flechas abajo y arriba, con vuelta', () => {
    expect(indiceTrasTecla(-1, 3, 'ArrowDown', 'vertical')).toBe(0)
    expect(indiceTrasTecla(2, 3, 'ArrowDown', 'vertical')).toBe(0)
    expect(indiceTrasTecla(0, 3, 'ArrowUp', 'vertical')).toBe(2)
    expect(indiceTrasTecla(-1, 3, 'ArrowUp', 'vertical')).toBe(2)
  })
  it('horizontal: izquierda y derecha; las verticales no son suyas', () => {
    expect(indiceTrasTecla(0, 4, 'ArrowRight', 'horizontal')).toBe(1)
    expect(indiceTrasTecla(0, 4, 'ArrowLeft', 'horizontal')).toBe(3)
    expect(indiceTrasTecla(0, 4, 'ArrowDown', 'horizontal')).toBeNull()
  })
  it('Inicio y Fin a los extremos', () => {
    expect(indiceTrasTecla(2, 5, 'Home', 'vertical')).toBe(0)
    expect(indiceTrasTecla(2, 5, 'End', 'horizontal')).toBe(4)
  })
  it('sin opciones, o con una tecla ajena, nada', () => {
    expect(indiceTrasTecla(0, 0, 'ArrowDown', 'vertical')).toBeNull()
    expect(indiceTrasTecla(0, 3, 'Enter', 'vertical')).toBeNull()
  })
})

describe('idDeOpcion', () => {
  it('compone un id estable por prefijo e índice', () => {
    expect(idDeOpcion('burbuja', 2)).toBe('burbuja-opcion-2')
  })
})
