/**
 * secretosReserva.test.ts — agenda D1: el código del enlace se deriva (no se
 * guarda), las subllaves por propósito no se cruzan, y sin RESERVA_SECRETO
 * todo devuelve null (falla cerrado).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  secretoDisponible, codigoDeEnlace, esCodigoDeEnlace, hashDeCodigo, hmacContacto, hmacCodigoCorreo,
  hmacRed, hmacFicha, nuevaFicha,
} from '@/lib/reserva/secretos'

const SECRETO = 'a1'.repeat(32)
const OTRO = 'b2'.repeat(32)
const ID = '00000000-0000-4000-8000-0000000000d1'
const ID2 = '00000000-0000-4000-8000-0000000000d2'
const HEX64 = /^[0-9a-f]{64}$/

beforeEach(() => { vi.stubEnv('RESERVA_SECRETO', SECRETO) })
afterEach(() => { vi.unstubAllEnvs() })

describe('código del enlace', () => {
  it('es determinista, 22 caracteres base64url, y cambia con el id y con el secreto', () => {
    const c = codigoDeEnlace(ID)
    expect(c).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(codigoDeEnlace(ID)).toBe(c)
    expect(codigoDeEnlace(ID2)).not.toBe(c)
    vi.stubEnv('RESERVA_SECRETO', OTRO)
    expect(codigoDeEnlace(ID)).not.toBe(c)
  })

  it('el secreto se lee en minúsculas y sin espacios', () => {
    const c = codigoDeEnlace(ID)
    vi.stubEnv('RESERVA_SECRETO', ` ${SECRETO.toUpperCase()}\n`)
    expect(codigoDeEnlace(ID)).toBe(c)
  })

  it('rechaza ids que no son uuid en minúsculas', () => {
    expect(codigoDeEnlace('')).toBeNull()
    expect(codigoDeEnlace(ID.toUpperCase())).toBeNull()
    expect(codigoDeEnlace(`${ID}x`)).toBeNull()
  })

  it('hashDeCodigo es sha256 en hex, y esCodigoDeEnlace mira la forma', () => {
    expect(hashDeCodigo('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    const c = codigoDeEnlace(ID) ?? ''
    expect(hashDeCodigo(c)).toBe(createHash('sha256').update(c).digest('hex'))
    expect(esCodigoDeEnlace(c)).toBe(true)
    expect(esCodigoDeEnlace(`${c}=`)).toBe(false)
    expect(esCodigoDeEnlace('corto')).toBe(false)
    expect(esCodigoDeEnlace('a/b+c'.padEnd(22, 'x'))).toBe(false)
  })
})

describe('subllaves por propósito', () => {
  it('el mismo texto como teléfono y como correo da HMAC distintos', () => {
    const t = hmacContacto('telefono', '5512345678')
    const c = hmacContacto('correo', '5512345678')
    expect(t).toMatch(HEX64)
    expect(c).toMatch(HEX64)
    expect(t).not.toBe(c)
  })

  it('subllaves y clases distintas no coinciden (contacto ≠ red ≠ codigo; ip ≠ dispositivo)', () => {
    const contacto = hmacContacto('telefono', '5512345678')
    const red = hmacRed('ip', '5512345678')
    expect(red).toMatch(HEX64)
    expect(red).not.toBe(contacto)
    const ficha = 'f'.repeat(43)
    expect(hmacRed('ip', 'x')).not.toBe(hmacRed('dispositivo', 'x'))
    expect(hmacFicha(ficha)).not.toBe(hmacRed('ip', ficha))
  })

  it('el código del correo se ata al enlace, al correo y al código', () => {
    const correo = hmacContacto('correo', 'ana@ejemplo.mx') ?? ''
    const base = hmacCodigoCorreo(ID, correo, '123456')
    expect(base).toMatch(HEX64)
    expect(hmacCodigoCorreo(ID, correo, '123456')).toBe(base)
    expect(hmacCodigoCorreo(ID2, correo, '123456')).not.toBe(base)
    expect(hmacCodigoCorreo(ID, hmacContacto('correo', 'otro@ejemplo.mx') ?? '', '123456')).not.toBe(base)
    expect(hmacCodigoCorreo(ID, correo, '123457')).not.toBe(base)
    expect(hmacCodigoCorreo(ID, correo, '12345')).toBeNull()
    expect(hmacCodigoCorreo(ID, 'no-hex', '123456')).toBeNull()
  })

  it('valores vacíos no se seudonimizan', () => {
    expect(hmacContacto('correo', '')).toBeNull()
    expect(hmacRed('ip', '')).toBeNull()
  })
})

describe('ficha de verificación', () => {
  it('es al azar, de 43 caracteres, y su HMAC se puede recalcular', () => {
    const a = nuevaFicha()
    const b = nuevaFicha()
    expect(a?.ficha).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a?.fichaHmac).toMatch(HEX64)
    expect(a?.ficha).not.toBe(b?.ficha)
    expect(hmacFicha(a?.ficha ?? '')).toBe(a?.fichaHmac)
    expect(hmacFicha('corta')).toBeNull()
  })
})

describe('sin secreto utilizable, todo falla cerrado', () => {
  it.each([undefined, '', 'a1'.repeat(31), 'zz'.repeat(32), `${'a1'.repeat(32)}f`])('RESERVA_SECRETO=%s', (v) => {
    vi.stubEnv('RESERVA_SECRETO', v)
    expect(secretoDisponible()).toBe(false)
    expect(codigoDeEnlace(ID)).toBeNull()
    expect(hmacContacto('telefono', '5512345678')).toBeNull()
    expect(hmacCodigoCorreo(ID, 'a'.repeat(64), '123456')).toBeNull()
    expect(hmacRed('ip', '1.2.3.4')).toBeNull()
    expect(nuevaFicha()).toBeNull()
  })

  it('con el secreto bueno, disponible', () => {
    expect(secretoDisponible()).toBe(true)
  })
})
