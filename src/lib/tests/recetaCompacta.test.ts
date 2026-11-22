import { describe, expect, it } from 'vitest'
import { MEDICAMENTOS, VIAS } from '@/data/medicamentos'
import {
  anadirFrase, buscarEnCatalogo, colorVia, conTexto, estaCompleto, faltasDe, pautaDeIndicacion,
  sinPauta, textoAvisoPauta, VIAS_OTRAS, VIAS_RAPIDAS, type MedicamentoConVia,
} from '@/components/documentos/recetaCompacta'

const med = (d: Partial<MedicamentoConVia> = {}): MedicamentoConVia => ({
  nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: '', ...d,
})

describe('catálogo: la vía derivada', () => {
  it('toda vía del catálogo es una de las doce', () => {
    for (const m of MEDICAMENTOS) if (m.via !== undefined) expect(VIAS).toContain(m.via)
  })
  it('tabletas y cápsulas (no sublinguales) son orales', () => {
    for (const m of MEDICAMENTOS) {
      if (/^(Tabletas|Cápsulas)/.test(m.presentacion) && !/sublingual/i.test(m.presentacion)) expect(m.via, m.nombre_comercial).toBe('Oral')
    }
  })
  it('un inyectable sólo lleva vía si su presentación o su nombre la dicen', () => {
    for (const m of MEDICAMENTOS) {
      if (!/inyectable|jeringa|vial|pluma/i.test(m.presentacion)) continue
      if (m.via === undefined) continue
      expect(`${m.nombre_comercial} ${m.presentacion}`, m.nombre_comercial).toMatch(/\bIV\b|\bIM\b|\bSC\b/)
    }
  })
  it('gel y crema son tópicas; los parches transdérmicos lo dicen en el genérico', () => {
    for (const m of MEDICAMENTOS) {
      if (/^(Gel|Crema)/.test(m.presentacion)) expect(m.via).toBe('Tópica')
      if (m.via === 'Transdérmica') expect(m.principio_activo).toMatch(/transdérmic/i)
    }
  })
  it('los botones rápidos y «Otra…» cubren las doce sin repetir', () => {
    expect([...VIAS_RAPIDAS.map(r => r.via), ...VIAS_OTRAS].sort()).toEqual([...VIAS].sort())
  })
  it('colores por familia; lo demás gris', () => {
    expect(colorVia('Oral')).toBe('oral')
    expect(colorVia('Intramuscular')).toBe('im')
    expect(colorVia('Intravenosa')).toBe('iv')
    expect(colorVia('Transdérmica')).toBe('top')
    expect(colorVia('Subcutánea')).toBe('sc')
    expect(colorVia('Oftálmica')).toBe('otra')
  })
})

describe('buscador', () => {
  it('busca sin acentos por comercial y por genérico', () => {
    expect(buscarEnCatalogo('ker').map(m => m.nombre_comercial)).toContain('Keral')
    expect(buscarEnCatalogo('KETOROLACO').length).toBeGreaterThan(0)
    expect(buscarEnCatalogo('neurobion').map(m => m.nombre_comercial)).toContain('Neurobión')
    expect(buscarEnCatalogo('dexketoprofeno').some(m => m.nombre_comercial === 'Keral')).toBe(true)
  })
  it('menos de dos letras no busca; como mucho ocho', () => {
    expect(buscarEnCatalogo('k')).toEqual([])
    expect(buscarEnCatalogo('ta').length).toBeLessThanOrEqual(8)
  })
  it('primero los comerciales que empiezan por lo escrito', () => {
    const r = buscarEnCatalogo('dic')
    expect(r[0].nombre_comercial.toLowerCase().startsWith('dic')).toBe(true)
  })
})

describe('validación (a, b)', () => {
  it('un bloque vacío no falta nada (se ignora)', () => {
    expect(faltasDe(med())).toEqual([])
    expect(faltasDe(med({ via_administracion: 'Oral' }))).toEqual([])
  })
  it('(a) sin vía no se imprime', () => {
    expect(faltasDe(med({ nombre_comercial: 'Keral', principio_activo: 'Dexketoprofeno' }))).toEqual(['via'])
  })
  it('(b) a medias bloquea y dice qué falta', () => {
    expect(faltasDe(med({ indicacion: 'cada 8 horas' }))).toEqual(['comercial', 'generico', 'via'])
    expect(faltasDe(med({ nombre_comercial: 'X', via_administracion: 'Oral' }))).toEqual(['generico'])
    expect(faltasDe(med({ principio_activo: 'Y', via_administracion: 'Oral' }))).toEqual(['comercial'])
  })
  it('completo: nada', () => {
    const m = med({ nombre_comercial: 'Keral', principio_activo: 'Dexketoprofeno', via_administracion: 'Oral' })
    expect(faltasDe(m)).toEqual([])
    expect(estaCompleto(m)).toBe(true)
    expect(conTexto(m)).toBe(true)
  })
})

describe('heurística de la pauta (c)', () => {
  it.each([
    ['Tomar 1 tableta cada 8 horas por 7 días', false],
    ['1 tableta c/12 h x 5 días', false],
    ['1 cápsula diaria durante 3 semanas', false],
    ['Aplicar dosis única', false],
    ['1 tableta cada 8 horas en caso de dolor', false],
    ['1 tableta dos veces al día por un mes', false],
    ['', true],
    ['Tomar 1 tableta', true],
    ['cada 8 horas', true],
    ['por 7 días', true],
  ])('«%s» → sin pauta: %s', (texto, esperado) => {
    expect(sinPauta(texto)).toBe(esperado)
  })
  it('separa frecuencia y duración', () => {
    expect(pautaDeIndicacion('cada 8 horas')).toEqual({ frecuencia: true, duracion: false })
    expect(pautaDeIndicacion('por 5 días')).toEqual({ frecuencia: false, duracion: true })
  })
  it('texto del aviso en singular y plural', () => {
    expect(textoAvisoPauta(1)).toBe('A 1 medicamento le falta la frecuencia o la duración en las indicaciones.')
    expect(textoAvisoPauta(3)).toBe('A 3 medicamentos les falta la frecuencia o la duración en las indicaciones.')
  })
  it('las fichas añaden al final; vacío, con mayúscula', () => {
    expect(anadirFrase('', 'cada 8 horas')).toBe('Cada 8 horas')
    expect(anadirFrase('1 tableta ', 'por 5 días')).toBe('1 tableta por 5 días')
  })
})
