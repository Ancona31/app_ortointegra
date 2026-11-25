import { describe, expect, it } from 'vitest'
import { CATEGORIAS_LAB, ESTUDIOS_LAB } from '@/lib/estudiosLab'
import {
  alternarEstudio, anadirEstudio, buscarEstudios, estaPedido, FRECUENTES_LAB, mismoEstudio, pedidosEn, quitarEstudio,
} from '@/components/documentos/estudiosPedidos'
import { sinAcentos } from '@/components/documentos/recetaCompacta'

describe('catálogo de laboratorio', () => {
  it('las categorías cubren exactamente ESTUDIOS_LAB, en el mismo orden y sin duplicados', () => {
    const plano = CATEGORIAS_LAB.flatMap(c => c.estudios)
    expect(plano).toEqual(ESTUDIOS_LAB)
    expect(ESTUDIOS_LAB).toHaveLength(291)
    expect(CATEGORIAS_LAB).toHaveLength(24)
    expect(new Set(ESTUDIOS_LAB.map(e => sinAcentos(e))).size).toBe(ESTUDIOS_LAB.length)
    expect(new Set(CATEGORIAS_LAB.map(c => c.nombre)).size).toBe(CATEGORIAS_LAB.length)
    for (const c of CATEGORIAS_LAB) expect(c.estudios.length).toBeGreaterThan(0)
  })

  it('cada frecuente pide un nombre que existe literal en el catálogo', () => {
    expect(FRECUENTES_LAB).toHaveLength(10)
    for (const f of FRECUENTES_LAB) expect(ESTUDIOS_LAB).toContain(f.estudio)
    expect(FRECUENTES_LAB.map(f => f.rotulo)).toEqual([
      'Biometría Hemática', 'Glucosa', 'Urea', 'Creatinina', 'Examen General de Orina',
      'TP', 'TPT', 'Perfil Tiroideo Completo', 'Urocultivo', 'Cultivo de Secreción',
    ])
  })
})

describe('añadir y quitar', () => {
  it('añade al final, recortado, y no repite (sin acentos ni mayúsculas)', () => {
    let l: readonly string[] = []
    l = anadirEstudio(l, '  Urea ')
    l = anadirEstudio(l, 'Ácido Úrico')
    expect(l).toEqual(['Urea', 'Ácido Úrico'])
    expect(anadirEstudio(l, 'acido urico')).toBe(l)
    expect(anadirEstudio(l, 'UREA')).toBe(l)
    expect(anadirEstudio(l, '   ')).toBe(l)
    expect(mismoEstudio('Glucosa', 'GLUCOSÁ ')).toBe(true)
  })

  it('quita sin importar acentos y alterna', () => {
    const l = ['Urea', 'Ácido Úrico', 'algo raro']
    expect(quitarEstudio(l, 'ACIDO URICO')).toEqual(['Urea', 'algo raro'])
    expect(alternarEstudio(l, 'urea')).toEqual(['Ácido Úrico', 'algo raro'])
    expect(alternarEstudio(l, 'Creatinina')).toEqual([...l, 'Creatinina'])
    expect(estaPedido(l, 'ALGO RARO')).toBe(true)
    expect(pedidosEn(l, ['Urea', 'Creatinina', 'Ácido Úrico'])).toBe(2)
  })
})

describe('buscarEstudios', () => {
  it('menos de 2 letras no busca', () => {
    expect(buscarEstudios('q', [])).toEqual([])
    expect(buscarEstudios('  ', [])).toEqual([])
  })

  it('es insensible a acentos y mayúsculas y ordena por posición de la coincidencia', () => {
    const r = buscarEstudios('QUIM', [])
    expect(r[0]).toBe('Química Sanguínea 6 elementos')
    expect(r[1]).toBe('Química Sanguínea 27 elementos')
    const pos = r.map(e => sinAcentos(e).indexOf('quim'))
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(buscarEstudios('acido urico', [])).toContain('Ácido Úrico')
  })

  it('no ofrece lo ya pedido y respeta el tope', () => {
    expect(buscarEstudios('pcr', ['PCR (Proteína C Reactiva)'])).not.toContain('PCR (Proteína C Reactiva)')
    expect(buscarEstudios('in', []).length).toBe(8)
    expect(buscarEstudios('in', [], ESTUDIOS_LAB, 3).length).toBe(3)
  })
})
