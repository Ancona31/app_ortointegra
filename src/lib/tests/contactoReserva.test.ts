/** contactoReserva.test.ts — agenda D5: normalización del teléfono (México, 10 dígitos) y del correo (llave del candado). */
import { describe, it, expect } from 'vitest'
import { correoValido, normalizarCorreo, normalizarTelefonoMx } from '@/lib/reserva/contacto'

describe('normalizarTelefonoMx', () => {
  it('acepta 10 dígitos con o sin adornos y quita +52 / +52 1', () => {
    expect(normalizarTelefonoMx('5512345678')).toBe('5512345678')
    expect(normalizarTelefonoMx('(55) 1234-5678')).toBe('5512345678')
    expect(normalizarTelefonoMx('+52 55 1234 5678')).toBe('5512345678')
    expect(normalizarTelefonoMx('+52 1 55 1234 5678')).toBe('5512345678')
  })
  it('rechaza lo que no da 10 dígitos', () => {
    for (const t of ['', '12345', '551234567', '55123456789', 'abc', '+1 555 123 4567', '52 551234567']) {
      expect(normalizarTelefonoMx(t), t).toBeNull()
    }
  })
})

describe('normalizarCorreo', () => {
  it('minúsculas y sin +etiqueta; los puntos se quedan', () => {
    expect(normalizarCorreo('  Ana.Lopez+citas@Correo.MX ')).toBe('ana.lopez@correo.mx')
    expect(normalizarCorreo('ana@correo.mx')).toBe(normalizarCorreo('ANA+x+y@correo.mx'))
    expect(normalizarCorreo('a.n.a@gmail.com')).toBe('a.n.a@gmail.com')
  })
  it('basura → null', () => {
    for (const c of ['', 'ana', 'ana@', '@x.mx', 'ana@x', '+x@a.mx', 'a b@c.mx']) expect(normalizarCorreo(c), c).toBeNull()
    expect(correoValido('x'.repeat(250) + '@a.mx')).toBe(false)
  })
})
