/**
 * whatsappCita.test.ts — agenda E7: el número de wa.me para México es `521` +
 * 10 dígitos (documentación oficial de WhatsApp, citada en whatsappCita.ts),
 * el texto no lleva ni el paciente ni nada clínico, y «mañana» se calcula en
 * la zona del consultorio.
 */
import { describe, it, expect } from 'vitest'
import { enlaceWaMe, numeroWaMe, textoWhatsApp } from '@/lib/agenda/whatsappCita'
import { esDeManana } from '@/lib/agenda/whatsappServidor'

describe('numeroWaMe', () => {
  it.each([
    ['5512345678', '5215512345678'],
    ['+52 1 55 1234 5678', '5215512345678'],
    ['52 55 1234 5678', '5215512345678'],
    ['(55) 1234-5678', '5215512345678'],
    ['+52 (55) 1234-5678', '5215512345678'],
  ])('%s → %s', (crudo, esperado) => {
    expect(numeroWaMe(crudo)).toBe(esperado)
  })

  it.each(['551234567', '55123456789', 'cinco cinco', '', '   ', '+1 555 123 4567 8'])('%j → null', (crudo) => {
    expect(numeroWaMe(crudo)).toBeNull()
  })

  it('null o undefined → null', () => {
    expect(numeroWaMe(null)).toBeNull()
    expect(numeroWaMe(undefined)).toBeNull()
  })
})

describe('textoWhatsApp y enlaceWaMe', () => {
  const URL_ENLACE = 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv'
  const texto = textoWhatsApp({
    fecha: 'martes, 17 de noviembre', hora: '10:00', medico: 'Dra. Ana Pérez', consultorio: 'Consultorio Uno',
    url: URL_ENLACE, confirmada: false,
  })

  it('la URL empieza por https://wa.me/521 y el texto decodificado lleva fecha, hora y el enlace', () => {
    const url = enlaceWaMe('5512345678', texto)
    expect(url).not.toBeNull()
    expect(url?.startsWith('https://wa.me/5215512345678?text=')).toBe(true)
    const decodificado = decodeURIComponent(new URL(url ?? '').searchParams.get('text') ?? '')
    expect(decodificado).toContain('martes, 17 de noviembre')
    expect(decodificado).toContain('10:00')
    expect(decodificado).toContain('/confirmar/')
    expect(decodificado).toContain('Dra. Ana Pérez')
  })

  it('no hay sitio para título, notas, tipo ni paciente', () => {
    for (const prohibido of ['Paciente', 'Consulta:', 'nota', 'Ortopedia']) expect(texto).not.toContain(prohibido)
  })

  it('confirmada: sólo avisar que no podrá asistir', () => {
    const t = textoWhatsApp({ fecha: 'f', hora: 'h', medico: '', consultorio: '', url: URL_ENLACE, confirmada: true })
    expect(t).not.toContain('confirmar o')
    expect(t).toContain('Si no podrá asistir')
    expect(t).toContain('Le escribimos de su consultorio.')
  })

  it('teléfono sin formato válido → null', () => {
    expect(enlaceWaMe('123', texto)).toBeNull()
  })
})

describe('esDeManana (zona del consultorio)', () => {
  // 2026-11-17 05:30 UTC = 16 nov 23:30 en CDMX = 17 nov 00:30 en Cancún.
  const AHORA = Date.parse('2026-11-17T05:30:00Z')
  it('CDMX: mañana es el 17', () => {
    expect(esDeManana('2026-11-17T16:00:00Z', 'America/Mexico_City', AHORA)).toBe(true)
    expect(esDeManana('2026-11-18T16:00:00Z', 'America/Mexico_City', AHORA)).toBe(false)
  })
  it('Cancún: ya es 17, mañana es el 18', () => {
    expect(esDeManana('2026-11-17T16:00:00Z', 'America/Cancun', AHORA)).toBe(false)
    expect(esDeManana('2026-11-18T16:00:00Z', 'America/Cancun', AHORA)).toBe(true)
  })
  it('sin zona usa la de la clínica; zona inválida → false', () => {
    expect(esDeManana('2026-11-17T16:00:00Z', null, AHORA)).toBe(true)
    expect(esDeManana('2026-11-17T16:00:00Z', 'No/Existe', AHORA)).toBe(false)
  })
})
