/**
 * Límites de médicos y secretarias (fase 3, P3).
 *
 * Fija lo que se rompe en silencio: que 0 sea «ninguno» y no «sin límite» (R6),
 * que pasar del límite nunca pinte negativos, y que la línea «Límite ampliado»
 * solo salga cuando la base devolvió un límite efectivo mayor que el del plan.
 */

import { describe, it, expect } from 'vitest'
import { puedeAgregar, mensajeLimite, textoLimite } from '@/lib/limitesUsuarios'

describe('puedeAgregar', () => {
  it.each([
    [0, null, true],
    [5, null, true],
    [0, 1, true],
    [1, 1, false],
    [3, 2, false],
    [0, 0, false],
  ] as const)('(%i, %s) → %s', (usados, limite, esperado) => {
    expect(puedeAgregar(usados, limite)).toBe(esperado)
  })
})

describe('mensajeLimite', () => {
  it('no da mensaje si cabe uno más', () => {
    expect(mensajeLimite('medico', 0, 1)).toBeNull()
    expect(mensajeLimite('secretaria', 4, null)).toBeNull()
  })

  it('en el límite da el mensaje de siempre', () => {
    expect(mensajeLimite('medico', 1, 1)).toBe('Has alcanzado el límite de médicos de tu plan')
    expect(mensajeLimite('secretaria', 2, 2)).toBe('Has alcanzado el límite de asistentes de tu plan')
  })

  it('con límite 0 rechaza a la primera secretaria (R6)', () => {
    expect(mensajeLimite('secretaria', 0, 0)).toBe('Has alcanzado el límite de asistentes de tu plan')
  })

  it('con más usuarios que el límite agrega que conservan su acceso', () => {
    expect(mensajeLimite('medico', 3, 2)).toBe(
      'Has alcanzado el límite de médicos de tu plan. Los usuarios que ya tienes conservan su acceso.',
    )
  })

  it('invitar secretaria: con límite efectivo 0 se rechaza y con un ajuste de 1 se acepta', () => {
    // Los números que lee la ruta: 0 secretarias, limite_efectivo(0, null, null) = 0
    // y limite_efectivo(0, 1, null) = 1 (p3_limite_efectivo_clinica.sql).
    expect(mensajeLimite('secretaria', 0, 0)).not.toBeNull()
    expect(mensajeLimite('secretaria', 0, 1)).toBeNull()
  })
})

describe('textoLimite', () => {
  it('sin ajuste vigente: el contador de hoy y sin línea nueva', () => {
    expect(textoLimite(1, 1, 1, null)).toEqual({ usado: '1', limite: '1', ampliado: null })
  })

  it('con ajuste vigente con fecha: la fecha en dd/mm/aaaa, zona America/Merida', () => {
    expect(textoLimite(2, 3, 1, '2026-11-15T18:00:00Z')).toEqual({
      usado: '2',
      limite: '3',
      ampliado: 'Límite ampliado: tu plan incluye 1; tienes 3 hasta el 15/11/2026.',
    })
  })

  it('la fecha es la de Mérida, no la de UTC', () => {
    // 03:00 UTC del 16 son las 21:00 del 15 en Mérida (UTC-6)
    expect(textoLimite(1, 3, 1, '2026-11-16T03:00:00Z').ampliado).toBe(
      'Límite ampliado: tu plan incluye 1; tienes 3 hasta el 15/11/2026.',
    )
  })

  it('cerca de la medianoche: 05:30 UTC del 16 son las 23:30 del 15 en Mérida', () => {
    expect(textoLimite(1, 3, 1, '2026-11-16T05:30:00Z').ampliado).toBe(
      'Límite ampliado: tu plan incluye 1; tienes 3 hasta el 15/11/2026.',
    )
  })

  it('con ajuste vigente sin fecha', () => {
    expect(textoLimite(1, 3, 1, null).ampliado).toBe('Límite ampliado: tu plan incluye 1; tienes 3 sin fecha de fin.')
  })

  it('con más usuarios que el límite: «3/2», nunca negativos', () => {
    expect(textoLimite(3, 2, 2, null)).toEqual({ usado: '3', limite: '2', ampliado: null })
  })

  it('con límite 0: «0/0» (no es «sin límite»)', () => {
    expect(textoLimite(0, 0, 0, null)).toEqual({ usado: '0', limite: '0', ampliado: null })
  })

  it('sin límite: «/∞» como hoy, sin línea nueva', () => {
    expect(textoLimite(4, null, null, null)).toEqual({ usado: '4', limite: '∞', ampliado: null })
  })

  it('si el plan manda sobre el ajuste (efectivo = base), no hay línea nueva', () => {
    expect(textoLimite(1, 5, 5, null).ampliado).toBeNull()
  })
})
