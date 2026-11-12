import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  curvaToken, duracionMovimiento, duracionToken, incumplimientosDeMovimiento, interpretarDuracion,
  prefiereMenosMovimiento, type AnimacionObservada,
} from '@/lib/agenda/movimientoAgenda'

/** Simula un navegador mínimo: tokens en la raíz y la preferencia de movimiento. */
function navegador(tokens: Record<string, string>, reducido = false): void {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reducido }) })
  vi.stubGlobal('document', { documentElement: {} })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (k: string) => tokens[k] ?? '' }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('interpretarDuracion', () => {
  it('lee ms y s, con o sin cero delante', () => {
    expect(interpretarDuracion('120ms')).toBe(120)
    expect(interpretarDuracion(' .18s ')).toBe(180)
    expect(interpretarDuracion('0.01ms')).toBe(0.01)
  })
  it('devuelve null con lo que no es una duración', () => {
    expect(interpretarDuracion('')).toBeNull()
    expect(interpretarDuracion('rápido')).toBeNull()
    expect(interpretarDuracion('120')).toBeNull()
  })
})

describe('duracionToken y curvaToken', () => {
  it('sin navegador cae a los respaldos, que son la escala de la hoja', () => {
    expect(duracionToken('--ag-dur-micro')).toBe(120)
    expect(duracionToken('--ag-dur-base')).toBe(180)
    expect(duracionToken('--ag-dur-lento')).toBe(240)
    expect(curvaToken('--ag-ease')).toBe('cubic-bezier(.4, 0, .2, 1)')
  })
  it('con navegador lee el token computado', () => {
    navegador({ '--ag-dur-base': '200ms', '--ag-ease-out': 'linear' })
    expect(duracionToken('--ag-dur-base')).toBe(200)
    expect(curvaToken('--ag-ease-out')).toBe('linear')
  })
  it('un token ilegible no devuelve NaN: vuelve al respaldo', () => {
    navegador({ '--ag-dur-micro': 'nada' })
    expect(duracionToken('--ag-dur-micro')).toBe(120)
  })
})

describe('prefiereMenosMovimiento y duracionMovimiento', () => {
  it('sin window contesta que no', () => {
    expect(prefiereMenosMovimiento()).toBe(false)
  })
  it('con reduce la duración efectiva es 0', () => {
    navegador({ '--ag-dur-micro': '120ms' }, true)
    expect(prefiereMenosMovimiento()).toBe(true)
    expect(duracionMovimiento('--ag-dur-micro')).toBe(0)
  })
  it('sin reduce la duración efectiva es la del token', () => {
    navegador({ '--ag-dur-micro': '120ms' })
    expect(duracionMovimiento('--ag-dur-micro')).toBe(120)
  })
})

describe('incumplimientosDeMovimiento', () => {
  const buena: AnimacionObservada = { nombre: 'ag-entra', propiedades: ['opacity', 'transform'], duracionMs: 180, elemento: 'a.fc-event' }

  it('acepta opacidad y transform dentro del tope', () => {
    expect(incumplimientosDeMovimiento([buena])).toEqual([])
  })
  it('MUTACIÓN: una transición de width sembrada sale como incumplimiento', () => {
    const ancho: AnimacionObservada = { nombre: 'width', propiedades: ['width'], duracionMs: 120, elemento: 'div.ag-x' }
    const salida = incumplimientosDeMovimiento([buena, ancho])
    expect(salida).toHaveLength(1)
    expect(salida[0]).toContain('anima width')
  })
  it('lo que dura más de 240 ms incumple, aunque sólo anime opacidad', () => {
    const larga: AnimacionObservada = { ...buena, nombre: 'ag-pulso', duracionMs: 900 }
    expect(incumplimientosDeMovimiento([larga])[0]).toContain('dura 900 ms')
  })
  it('la barra de carga es la única excepción', () => {
    const bucle: AnimacionObservada = { nombre: 'ag-barra-carga', propiedades: ['transform'], duracionMs: 1100, elemento: 'div' }
    expect(incumplimientosDeMovimiento([bucle])).toEqual([])
  })
  it('una duración infinita o no numérica incumple', () => {
    expect(incumplimientosDeMovimiento([{ ...buena, duracionMs: Infinity }])).toHaveLength(1)
  })
})
