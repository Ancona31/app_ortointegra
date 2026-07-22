import { describe, it, expect } from 'vitest'
import {
  evaluarEstado,
  evaluarPA,
  fueraDeLimitesDuros,
  LIMITES_DUROS,
} from '@/lib/signosVitalesRangos'

describe('evaluarEstado — vacíos', () => {
  it('undefined / null / NaN → vacio', () => {
    expect(evaluarEstado('fc', undefined)).toBe('vacio')
    expect(evaluarEstado('fc', null)).toBe('vacio')
    expect(evaluarEstado('fc', NaN)).toBe('vacio')
    expect(evaluarEstado('temp', Infinity)).toBe('vacio')
  })
})

describe('evaluarEstado — ta_sistolica (bordes 90/130/139/140)', () => {
  it('sys < 90 → fuera', () => {
    expect(evaluarEstado('ta_sistolica', 89)).toBe('fuera')
  })
  it('90..129 → normal', () => {
    expect(evaluarEstado('ta_sistolica', 90)).toBe('normal')
    expect(evaluarEstado('ta_sistolica', 129)).toBe('normal')
  })
  it('130..139 → vigilar', () => {
    expect(evaluarEstado('ta_sistolica', 130)).toBe('vigilar')
    expect(evaluarEstado('ta_sistolica', 139)).toBe('vigilar')
  })
  it('≥ 140 → fuera', () => {
    expect(evaluarEstado('ta_sistolica', 140)).toBe('fuera')
  })
})

describe('evaluarEstado — ta_diastolica (bordes 60/85/89/90)', () => {
  it('dia < 60 → fuera', () => {
    expect(evaluarEstado('ta_diastolica', 59)).toBe('fuera')
  })
  it('60..84 → normal', () => {
    expect(evaluarEstado('ta_diastolica', 60)).toBe('normal')
    expect(evaluarEstado('ta_diastolica', 84)).toBe('normal')
  })
  it('85..89 → vigilar', () => {
    expect(evaluarEstado('ta_diastolica', 85)).toBe('vigilar')
    expect(evaluarEstado('ta_diastolica', 89)).toBe('vigilar')
  })
  it('≥ 90 → fuera', () => {
    expect(evaluarEstado('ta_diastolica', 90)).toBe('fuera')
  })
})

describe('evaluarEstado — fc (bordes 50/59/60/100/101/120/121)', () => {
  it('60..100 → normal', () => {
    expect(evaluarEstado('fc', 60)).toBe('normal')
    expect(evaluarEstado('fc', 100)).toBe('normal')
  })
  it('50..59 y 101..120 → vigilar', () => {
    expect(evaluarEstado('fc', 50)).toBe('vigilar')
    expect(evaluarEstado('fc', 59)).toBe('vigilar')
    expect(evaluarEstado('fc', 101)).toBe('vigilar')
    expect(evaluarEstado('fc', 120)).toBe('vigilar')
  })
  it('< 50 ó > 120 → fuera', () => {
    expect(evaluarEstado('fc', 49)).toBe('fuera')
    expect(evaluarEstado('fc', 121)).toBe('fuera')
  })
})

describe('evaluarEstado — fr (bordes 10/11/12/20/21/24/25)', () => {
  it('12..20 → normal', () => {
    expect(evaluarEstado('fr', 12)).toBe('normal')
    expect(evaluarEstado('fr', 20)).toBe('normal')
  })
  it('10..11 y 21..24 → vigilar', () => {
    expect(evaluarEstado('fr', 10)).toBe('vigilar')
    expect(evaluarEstado('fr', 11)).toBe('vigilar')
    expect(evaluarEstado('fr', 21)).toBe('vigilar')
    expect(evaluarEstado('fr', 24)).toBe('vigilar')
  })
  it('< 10 ó > 24 → fuera', () => {
    expect(evaluarEstado('fr', 9)).toBe('fuera')
    expect(evaluarEstado('fr', 25)).toBe('fuera')
  })
})

describe('evaluarEstado — temp (bordes 35.0/35.9/36.0/37.4/37.5/37.9/38.0)', () => {
  it('36.0..37.4 → normal', () => {
    expect(evaluarEstado('temp', 36.0)).toBe('normal')
    expect(evaluarEstado('temp', 37.4)).toBe('normal')
  })
  it('37.5..37.9 y 35.0..35.9 → vigilar', () => {
    expect(evaluarEstado('temp', 37.5)).toBe('vigilar')
    expect(evaluarEstado('temp', 37.9)).toBe('vigilar')
    expect(evaluarEstado('temp', 35.0)).toBe('vigilar')
    expect(evaluarEstado('temp', 35.9)).toBe('vigilar')
  })
  it('≥ 38 ó < 35 → fuera', () => {
    expect(evaluarEstado('temp', 38.0)).toBe('fuera')
    expect(evaluarEstado('temp', 34.9)).toBe('fuera')
  })
})

describe('evaluarEstado — spo2 (bordes 89/90/94/95)', () => {
  it('≥ 95 → normal', () => {
    expect(evaluarEstado('spo2', 95)).toBe('normal')
    expect(evaluarEstado('spo2', 100)).toBe('normal')
  })
  it('90..94 → vigilar', () => {
    expect(evaluarEstado('spo2', 90)).toBe('vigilar')
    expect(evaluarEstado('spo2', 94)).toBe('vigilar')
  })
  it('< 90 → fuera', () => {
    expect(evaluarEstado('spo2', 89)).toBe('fuera')
  })
})

describe('evaluarPA — peor de dos / uno solo / vacíos', () => {
  it('ambos vacíos → vacio', () => {
    expect(evaluarPA(undefined, undefined)).toBe('vacio')
    expect(evaluarPA(null, null)).toBe('vacio')
  })
  it('gana el peor de sys/dia', () => {
    expect(evaluarPA(120, 80)).toBe('normal')
    expect(evaluarPA(135, 80)).toBe('vigilar') // sys vigilar, dia normal → vigilar
    expect(evaluarPA(120, 95)).toBe('fuera') // dia fuera domina
    expect(evaluarPA(135, 88)).toBe('vigilar') // ambos vigilar
  })
  it('uno solo capturado → evalúa el presente', () => {
    expect(evaluarPA(125, undefined)).toBe('normal')
    expect(evaluarPA(undefined, 92)).toBe('fuera')
    expect(evaluarPA(135, null)).toBe('vigilar')
  })
})

describe('fueraDeLimitesDuros', () => {
  it('dentro del rango → false', () => {
    expect(fueraDeLimitesDuros('fc', 20)).toBe(false)
    expect(fueraDeLimitesDuros('fc', 300)).toBe(false)
    expect(fueraDeLimitesDuros('temp', 30)).toBe(false)
    expect(fueraDeLimitesDuros('temp', 45)).toBe(false)
  })
  it('fuera del rango → true', () => {
    expect(fueraDeLimitesDuros('fc', 19)).toBe(true)
    expect(fueraDeLimitesDuros('fc', 301)).toBe(true)
    expect(fueraDeLimitesDuros('spo2', 39)).toBe(true)
    expect(fueraDeLimitesDuros('spo2', 101)).toBe(true)
    expect(fueraDeLimitesDuros('fr', 3)).toBe(true)
    expect(fueraDeLimitesDuros('fr', 81)).toBe(true)
  })
  it('no finito → true', () => {
    expect(fueraDeLimitesDuros('temp', NaN)).toBe(true)
  })
  it('LIMITES_DUROS expone los 6 rangos', () => {
    expect(LIMITES_DUROS.ta_sistolica).toEqual([40, 300])
    expect(LIMITES_DUROS.spo2).toEqual([40, 100])
  })
})
