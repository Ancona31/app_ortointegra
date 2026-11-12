/**
 * avisoReserva.test.ts — agenda D9: el aviso de la reserva no se publica
 * mientras lleve la marca de pendiente (salvo el desvío de e2e, sólo con la
 * base local y fuera de Vercel), el hash es de la plantilla, y el texto
 * cubre lo que el encargo exige.
 */
import { describe, it, expect } from 'vitest'
import {
  AVISO_PLANTILLA, AVISO_VERSION, MARCA_PENDIENTE, avisoPublicable, hashAviso, sqlAprobacion, textoAviso,
} from '@/lib/reserva/avisoReserva'

const LOCAL = 'http://127.0.0.1:54321'
const REMOTA = 'https://abcdefgh.supabase.co'

describe('avisoPublicable', () => {
  it('con la marca de pendiente no se publica', () => {
    expect(AVISO_PLANTILLA.startsWith(MARCA_PENDIENTE)).toBe(true)
    expect(avisoPublicable({})).toBe(false)
    expect(avisoPublicable({ NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(false)
  })
  it('el desvío de e2e sólo vale con base local y fuera de Vercel', () => {
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(true)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: REMOTA })).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, VERCEL: '1' })).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: 'true', NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(false)
    // Sin URL o con una que no es loopback: la duda cuenta como producción.
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1' })).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'no es url' })).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://kong:8000' })).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' })).toBe(true)
  })
  it('sin la marca se publica (la base sigue exigiendo el hash aprobado)', () => {
    expect(avisoPublicable({ NEXT_PUBLIC_SUPABASE_URL: REMOTA }, 'Aviso revisado')).toBe(true)
  })
})

describe('hash y aprobación', () => {
  it('el hash es sha256 hex de la plantilla y cambia con una coma', () => {
    expect(hashAviso()).toMatch(/^[0-9a-f]{64}$/)
    expect(hashAviso(AVISO_PLANTILLA + ',')).not.toBe(hashAviso())
  })
  it('la versión cabe en el CHECK de reserva_avisos y el INSERT la lleva', () => {
    expect(AVISO_VERSION).toMatch(/^[a-z0-9][a-z0-9.-]{2,40}$/)
    expect(sqlAprobacion()).toContain(`'${AVISO_VERSION}', '${hashAviso()}', true, now()`)
    expect(() => sqlAprobacion("x'; drop", hashAviso())).toThrow()
    expect(() => sqlAprobacion(AVISO_VERSION, "x'); drop table x; --")).toThrow()
  })
})

describe('contenido', () => {
  it('cubre el historial de cancelaciones, nombra a la SABG y no al INAI ni artículos', () => {
    expect(AVISO_PLANTILLA).toMatch(/historial de las citas que reservas en línea/)
    expect(AVISO_PLANTILLA).toMatch(/cancelan/)
    expect(AVISO_PLANTILLA).toContain('Secretaría Anticorrupción y Buen Gobierno')
    expect(AVISO_PLANTILLA).not.toMatch(/INAI/)
    expect(AVISO_PLANTILLA).not.toMatch(/art[íi]culo\s+\d|art\.\s*\d/i)
    expect(AVISO_PLANTILLA).toContain('[VERIFICAR')
  })
  it('rellena los marcadores', () => {
    const t = textoAviso({ medico: 'Dr. X', consultorio: 'Uno', direccion: 'Calle 1', telefono: '9991234567', url: 'https://e/p' })
    expect(t).not.toMatch(/\{(MEDICO|CONSULTORIO|DIRECCION|TELEFONO|PLAZO|URL)\}/)
    expect(t).toContain('Dr. X (Uno, Calle 1)')
    expect(t).toContain('9991234567')
  })
})
