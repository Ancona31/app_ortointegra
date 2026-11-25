/**
 * avisoCancelacion.test.ts — agenda E8: cuándo la agenda abierta pregunta y
 * cuándo avisa «Un paciente canceló…».
 */
import { describe, it, expect } from 'vitest'
import { esCancelacionAjena, esRespuestaReciente, leerRespuesta, textoAvisoCancelacion } from '@/lib/agenda/avisoCancelacion'

describe('esCancelacionAjena', () => {
  const base = { tipo: 'UPDATE' as const, statusNuevo: 'cancelled', statusPintado: 'scheduled', esEco: false }
  it('UPDATE ajeno a cancelada de una cita pintada sin cancelar → sí', () => {
    expect(esCancelacionAjena(base)).toBe(true)
    expect(esCancelacionAjena({ ...base, statusPintado: 'confirmed' })).toBe(true)
  })
  it('eco propio, otro estado, ya cancelada, no pintada, INSERT o DELETE → no', () => {
    expect(esCancelacionAjena({ ...base, esEco: true })).toBe(false)
    expect(esCancelacionAjena({ ...base, statusNuevo: 'confirmed' })).toBe(false)
    expect(esCancelacionAjena({ ...base, statusPintado: 'cancelled' })).toBe(false)
    expect(esCancelacionAjena({ ...base, statusPintado: undefined })).toBe(false)
    expect(esCancelacionAjena({ ...base, tipo: 'INSERT' })).toBe(false)
    expect(esCancelacionAjena({ ...base, tipo: 'DELETE' })).toBe(false)
  })
})

describe('esRespuestaReciente', () => {
  const AHORA = Date.parse('2026-11-12T12:00:00Z')
  it('«cancelo» de hace menos de 2 min → sí', () => {
    expect(esRespuestaReciente('cancelo', '2026-11-12T11:59:00Z', AHORA)).toBe(true)
  })
  it('vieja, «confirmo», sin respuesta o fecha rota → no', () => {
    expect(esRespuestaReciente('cancelo', '2026-11-12T11:57:59Z', AHORA)).toBe(false)
    expect(esRespuestaReciente('confirmo', '2026-11-12T11:59:30Z', AHORA)).toBe(false)
    expect(esRespuestaReciente(null, null, AHORA)).toBe(false)
    expect(esRespuestaReciente('cancelo', 'ayer', AHORA)).toBe(false)
  })
})

describe('textoAvisoCancelacion y leerRespuesta', () => {
  it('fecha y hora en la zona del consultorio, sin nombre', () => {
    expect(textoAvisoCancelacion('2026-11-17T16:00:00Z', 'America/Mexico_City')).toMatch(/^Un paciente canceló su cita del martes,? 17 de noviembre a las 10:00\.$/)
    expect(textoAvisoCancelacion('2026-11-17T16:00:00Z', 'America/Cancun')).toContain('11:00')
    expect(textoAvisoCancelacion(null, null)).toBe('Un paciente canceló su cita por el enlace.')
  })
  it('lee la respuesta sin fiarse de la forma', () => {
    expect(leerRespuesta({ respuesta: 'cancelo', respondido_en: 'x' })).toEqual({ respuesta: 'cancelo', respondidoEn: 'x' })
    expect(leerRespuesta(null)).toEqual({ respuesta: null, respondidoEn: null })
    expect(leerRespuesta({ respuesta: 3 })).toEqual({ respuesta: null, respondidoEn: null })
  })
})
