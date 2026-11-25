import { describe, expect, it } from 'vitest'
import {
  buscarSuplementos, filaQueSobra, moverActiva, pesoNumerico, resumenSuplemento, textoCalculo,
} from '@/components/documentos/suplementosCompacto'

const NOMBRES = ['Vitamina D3', 'Vitamina K2 (MK-7)', 'Omega-3 (EPA/DHA)', 'Cúrcuma (Curcumina 95%)', 'Magnesio Glicinato']

describe('buscarSuplementos', () => {
  it('sin texto devuelve todos, en el orden del catálogo', () => {
    expect(buscarSuplementos('', NOMBRES)).toEqual([0, 1, 2, 3, 4])
    expect(buscarSuplementos('   ', NOMBRES)).toEqual([0, 1, 2, 3, 4])
  })
  it('busca sin acentos ni mayúsculas', () => {
    expect(buscarSuplementos('curcuma', NOMBRES)).toEqual([3])
    expect(buscarSuplementos('CÚRC', NOMBRES)).toEqual([3])
    expect(buscarSuplementos('vit', NOMBRES)).toEqual([0, 1])
  })
  it('por cualquier parte del nombre', () => {
    expect(buscarSuplementos('epa', NOMBRES)).toEqual([2])
    expect(buscarSuplementos('zzz', NOMBRES)).toEqual([])
  })
})

describe('moverActiva', () => {
  const todas = () => true
  it('desde ninguna, ↓ va a la primera y ↑ a la última', () => {
    expect(moverActiva(-1, 1, 4, todas)).toBe(0)
    expect(moverActiva(-1, -1, 4, todas)).toBe(3)
  })
  it('da la vuelta en círculo', () => {
    expect(moverActiva(3, 1, 4, todas)).toBe(0)
    expect(moverActiva(0, -1, 4, todas)).toBe(3)
  })
  it('salta las ya elegidas', () => {
    const elegible = (i: number) => i !== 1 && i !== 2
    expect(moverActiva(0, 1, 4, elegible)).toBe(3)
    expect(moverActiva(3, -1, 4, elegible)).toBe(0)
    expect(moverActiva(-1, 1, 4, i => i >= 2)).toBe(2)
  })
  it('sin elegibles ni opciones, −1', () => {
    expect(moverActiva(-1, 1, 3, () => false)).toBe(-1)
    expect(moverActiva(0, 1, 0, todas)).toBe(-1)
  })
})

describe('línea plegada', () => {
  it('dosis y justificación separadas por un punto medio', () => {
    expect(resumenSuplemento('2 cápsulas al día', 'Vitamina D 18 ng/mL')).toBe('2 cápsulas al día · Vitamina D 18 ng/mL')
    expect(resumenSuplemento('5,000 UI/día', '  ')).toBe('5,000 UI/día')
  })
  it('sin dosis lo dice', () => {
    expect(resumenSuplemento('', '')).toBe('Sin dosis')
    expect(resumenSuplemento(' ', 'Por laboratorio')).toBe('Por laboratorio')
  })
})

describe('pesoNumerico', () => {
  it('lee como hoy (parseFloat) y cero si no es positivo', () => {
    expect(pesoNumerico('78')).toBe(78)
    expect(pesoNumerico('78.5')).toBe(78.5)
    expect(pesoNumerico('')).toBe(0)
    expect(pesoNumerico('-3')).toBe(0)
    expect(pesoNumerico('abc')).toBe(0)
  })
})

describe('filaQueSobra', () => {
  const filas = [{ clave: 1, nombre: 'Vitamina D3' }, { clave: 2, nombre: '' }]
  it('la abierta sin suplemento sobra si no es la única', () => {
    expect(filaQueSobra(filas, 2)).toBe(2)
  })
  it('una con suplemento, la única o ninguna abierta no sobran', () => {
    expect(filaQueSobra(filas, 1)).toBeNull()
    expect(filaQueSobra([{ clave: 2, nombre: '' }], 2)).toBeNull()
    expect(filaQueSobra(filas, null)).toBeNull()
  })
})

describe('textoCalculo', () => {
  it('dice si la dosis es la calculada o sólo la sugerida', () => {
    expect(textoCalculo(false, 78, '4 cápsulas al día', '30–40 mg/kg/día'))
      .toBe('Calculada para 78 kg: 4 cápsulas al día (30–40 mg/kg/día)')
    expect(textoCalculo(true, 60, '3 cápsulas al día', '30–40 mg/kg/día'))
      .toBe('Sugerida para 60 kg: 3 cápsulas al día (30–40 mg/kg/día)')
  })
})
