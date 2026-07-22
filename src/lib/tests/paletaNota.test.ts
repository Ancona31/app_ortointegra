import { describe, it, expect } from 'vitest'
import {
  derivarPaletaNota,
  mix,
  luminanciaRelativa,
  ratioContraste,
  PALETA_FALLBACK,
} from '@/lib/pdf/paletaNota'

describe('mix', () => {
  it('ratio 0 devuelve A, ratio 1 devuelve B', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('mezcla intermedia real (50%)', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clampa ratio fuera de rango', () => {
    expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', -1)).toBe('#000000')
  })
})

describe('luminanciaRelativa / ratioContraste (WCAG)', () => {
  it('negro=0, blanco=1', () => {
    expect(luminanciaRelativa('#000000')).toBeCloseTo(0, 5)
    expect(luminanciaRelativa('#ffffff')).toBeCloseTo(1, 5)
  })

  it('contraste blanco/negro = 21:1', () => {
    expect(ratioContraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('es simétrico', () => {
    expect(ratioContraste('#123456', '#abcdef')).toBeCloseTo(ratioContraste('#abcdef', '#123456'), 6)
  })
})

describe('derivarPaletaNota — fallback total', () => {
  it('sin cp devuelve EXACTAMENTE la paleta azul del mockup', () => {
    expect(derivarPaletaNota()).toEqual(PALETA_FALLBACK)
  })

  it('cp inválido (no hex) devuelve el fallback', () => {
    expect(derivarPaletaNota('rojo')).toEqual(PALETA_FALLBACK)
    expect(derivarPaletaNota('#12')).toEqual(PALETA_FALLBACK)
    expect(derivarPaletaNota('')).toEqual(PALETA_FALLBACK)
  })

  it('el fallback cumple AA en sus propios roles clave', () => {
    expect(ratioContraste(PALETA_FALLBACK.textStrong, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ratioContraste(PALETA_FALLBACK.vitalsTitle, PALETA_FALLBACK.structure)).toBeGreaterThanOrEqual(4.5)
    expect(ratioContraste(PALETA_FALLBACK.vitalsSub, PALETA_FALLBACK.structure)).toBeGreaterThanOrEqual(3.0)
  })
})

describe('derivarPaletaNota — primario oscuro (#1a3a5c, azul corporativo)', () => {
  const P = derivarPaletaNota('#1a3a5c')

  it('textStrong es AA (≥4.5) sobre blanco', () => {
    expect(ratioContraste(P.textStrong, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('vitalsTitle es AA (≥4.5) sobre structure', () => {
    expect(ratioContraste(P.vitalsTitle, P.structure)).toBeGreaterThanOrEqual(4.5)
  })

  it('vitalsSub es ≥3.0 sobre structure', () => {
    expect(ratioContraste(P.vitalsSub, P.structure)).toBeGreaterThanOrEqual(3.0)
  })

  it('accent = cp; roles claros más claros que los oscuros', () => {
    expect(P.accent).toBe('#1a3a5c')
    expect(luminanciaRelativa(P.bgSoft)).toBeGreaterThan(luminanciaRelativa(P.borderSoft))
    expect(luminanciaRelativa(P.textStrong)).toBeLessThan(luminanciaRelativa(P.structure))
  })
})

describe('derivarPaletaNota — primario CLARO (#ffd700, oro)', () => {
  const P = derivarPaletaNota('#ffd700')

  it('textStrong se oscurece hasta AA sobre blanco pese al primario claro', () => {
    expect(ratioContraste('#ffd700', '#ffffff')).toBeLessThan(4.5) // premisa: el oro crudo NO es legible
    expect(ratioContraste(P.textStrong, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('vitalsTitle mantiene AA sobre structure', () => {
    expect(ratioContraste(P.vitalsTitle, P.structure)).toBeGreaterThanOrEqual(4.5)
  })

  it('vitalsSub mantiene ≥3.0 sobre structure', () => {
    expect(ratioContraste(P.vitalsSub, P.structure)).toBeGreaterThanOrEqual(3.0)
  })
})

describe('derivarPaletaNota — primario verde (#1d6b4f)', () => {
  const P = derivarPaletaNota('#1d6b4f')

  it('cumple todas las guardas de contraste', () => {
    expect(ratioContraste(P.textStrong, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ratioContraste(P.vitalsTitle, P.structure)).toBeGreaterThanOrEqual(4.5)
    expect(ratioContraste(P.vitalsSub, P.structure)).toBeGreaterThanOrEqual(3.0)
  })

  it('accent conserva el verde del perfil', () => {
    expect(P.accent).toBe('#1d6b4f')
  })
})

describe('derivarPaletaNota — color secundario', () => {
  it('accentSoft usa cs cuando se provee', () => {
    const P = derivarPaletaNota('#1a3a5c', '#2b74bd')
    expect(P.accentSoft).toBe('#2b74bd')
  })

  it('accentSoft cae a un tint del primario cuando no hay cs', () => {
    const P = derivarPaletaNota('#1a3a5c')
    expect(P.accentSoft).toBe(mix('#1a3a5c', '#fff', 0.15))
    // cs inválido se trata como ausente
    expect(derivarPaletaNota('#1a3a5c', 'nope').accentSoft).toBe(mix('#1a3a5c', '#fff', 0.15))
  })
})
