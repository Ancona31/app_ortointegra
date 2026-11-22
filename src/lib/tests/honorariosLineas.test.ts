import { describe, expect, it } from 'vitest'
import {
  abrirTras, agregarAlFinal, conCampo, conTexto, enBlanco, esEmitible, filtrarSugerencias, quitarConRetroceso,
  type LineaConcepto,
} from '@/components/documentos/honorariosLineas'

const l = (id: number, concepto = '', origen = '', precio = 0, heredado?: boolean): LineaConcepto =>
  (heredado ? { id, concepto, origen, precio, heredado } : { id, concepto, origen, precio })

describe('líneas: altas', () => {
  it('Enter en el precio abre la siguiente DEBAJO y, en cotización, hereda el origen', () => {
    const r = abrirTras([l(1, 'Artrodesis', 'Honorarios médicos', 85000), l(2, 'Anestesia', 'Anestesiólogo', 22000)], 1, 3, true)
    expect(r.creada).toBe(true)
    expect(r.foco).toBe(3)
    expect(r.lineas.map(x => x.id)).toEqual([1, 3, 2])
    expect(r.lineas[1]).toEqual({ id: 3, concepto: '', origen: 'Honorarios médicos', precio: 0, heredado: true })
  })

  it('en el recibo la línea nueva no lleva origen', () => {
    expect(abrirTras([l(1, 'Consulta', 'Hospital', 1200)], 1, 2, false).lineas[1]).toEqual(l(2))
  })

  it('sobre una línea en blanco Enter no crea otra', () => {
    const r = abrirTras([l(1, 'A', '', 10), l(2, '', 'Hospital', 0)], 2, 3, true)
    expect(r).toEqual({ lineas: [l(1, 'A', '', 10), l(2, '', 'Hospital', 0)], foco: 2, creada: false })
    expect(abrirTras([l(1, '', '', 500)], 1, 2, false).creada).toBe(true)
  })

  it('«Agregar concepto» no apila líneas en blanco y hereda de la última', () => {
    expect(agregarAlFinal([l(1, 'A', '', 10), l(2)], 3, true)).toEqual({ lineas: [l(1, 'A', '', 10), l(2)], foco: 2, creada: false })
    const r = agregarAlFinal([l(1, 'A', 'Hospital', 10)], 2, true)
    expect(r.lineas[1]).toEqual(l(2, '', 'Hospital', 0, true))
  })
})

describe('líneas: bajas y origen heredado', () => {
  it('Retroceso en un concepto vacío sin precio quita la línea y sube al precio de la anterior', () => {
    expect(quitarConRetroceso([l(1, 'A', '', 10), l(2)], 2)).toEqual({ lineas: [l(1, 'A', '', 10)], foco: 1, campo: 'precio' })
    expect(quitarConRetroceso([l(1), l(2, 'B', '', 5)], 1)).toEqual({ lineas: [l(2, 'B', '', 5)], foco: 2, campo: 'concepto' })
  })

  it('no quita la única ni una con precio', () => {
    expect(quitarConRetroceso([l(1)], 1)).toBeNull()
    expect(quitarConRetroceso([l(1, 'A', '', 1), l(2, '', '', 300)], 2)).toBeNull()
  })

  it('un origen heredado en una línea en blanco no cuenta como escrito; uno tecleado sí', () => {
    expect(conTexto(l(1, '', 'Hospital', 0, true))).toBe(false)
    expect(conTexto(l(1, '', 'Hospital', 0))).toBe(true)
    expect(conTexto(l(1, 'Estancia', 'Hospital', 0, true))).toBe(true)
    expect(enBlanco(l(1, '', 'Hospital'))).toBe(true)
    const tocado = conCampo(l(1, '', 'Hospital', 0, true), 'origen', 'Hospital')
    expect(tocado.heredado).toBeUndefined()
    expect(conTexto(tocado)).toBe(true)
  })

  it('sólo se emite concepto con precio', () => {
    expect(esEmitible(l(1, 'A', '', 10))).toBe(true)
    expect(esEmitible(l(1, 'A', '', 0))).toBe(false)
    expect(esEmitible(l(1, ' ', '', 10))).toBe(false)
  })

  it('las sugerencias filtran sin acentos ni mayúsculas', () => {
    const o = ['Honorarios médicos', 'Hospital', 'Anestesiólogo', 'Material e implantes']
    expect(filtrarSugerencias(o, '')).toEqual(o)
    expect(filtrarSugerencias(o, 'ANESTESIOLOGO')).toEqual(['Anestesiólogo'])
    expect(filtrarSugerencias(o, 'medicos')).toEqual(['Honorarios médicos'])
  })
})
