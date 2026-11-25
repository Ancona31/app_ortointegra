/**
 * avisoReserva.test.ts — agenda D9 y privacidad 2026-12: el aviso de la
 * reserva es el texto APROBADO, byte a byte; un borrador con la marca de
 * pendiente no se publica (salvo el desvío de e2e, sólo con la base local y
 * fuera de Vercel); y la huella cubre la plantilla Y la casilla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AVISO_CASILLA, AVISO_PLANTILLA, AVISO_VERSION, MARCA_PENDIENTE, avisoPublicable, hashAviso, rutaAvisoIntegral,
  sqlAprobacion, textoAviso, urlAvisoIntegral,
} from '@/lib/reserva/avisoReserva'

const aprobado = (archivo: string) => readFileSync(resolve(process.cwd(), 'docs/spec/privacidad-2026-12', archivo), 'utf8')
const BORRADOR = `${MARCA_PENDIENTE}\n\nBorrador`

const LOCAL = 'http://127.0.0.1:54321'
const REMOTA = 'https://abcdefgh.supabase.co'

describe('avisoPublicable', () => {
  it('el texto aprobado no lleva la marca y se publica (la base sigue exigiendo la huella aprobada)', () => {
    expect(AVISO_PLANTILLA).not.toContain(MARCA_PENDIENTE)
    expect(avisoPublicable({})).toBe(true)
    expect(avisoPublicable({ NEXT_PUBLIC_SUPABASE_URL: REMOTA, VERCEL: '1' })).toBe(true)
  })
  it('un borrador con la marca de pendiente no se publica', () => {
    expect(avisoPublicable({}, BORRADOR)).toBe(false)
    expect(avisoPublicable({ NEXT_PUBLIC_SUPABASE_URL: LOCAL }, BORRADOR)).toBe(false)
  })
  it('el desvío de e2e sólo vale con base local y fuera de Vercel', () => {
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL }, BORRADOR)).toBe(true)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: REMOTA }, BORRADOR)).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, VERCEL: '1' }, BORRADOR)).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: 'true', NEXT_PUBLIC_SUPABASE_URL: LOCAL }, BORRADOR)).toBe(false)
    // Sin URL o con una que no es loopback: la duda cuenta como producción.
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1' }, BORRADOR)).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'no es url' }, BORRADOR)).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://kong:8000' }, BORRADOR)).toBe(false)
    expect(avisoPublicable({ RESERVA_AVISO_BORRADOR_LOCAL: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }, BORRADOR)).toBe(true)
  })
  it('sin la marca se publica (la base sigue exigiendo el hash aprobado)', () => {
    expect(avisoPublicable({ NEXT_PUBLIC_SUPABASE_URL: REMOTA }, 'Aviso revisado')).toBe(true)
  })
})

describe('hash y aprobación', () => {
  it('la huella es sha256 de plantilla + casilla y cambia con una coma de CUALQUIERA de las dos', () => {
    expect(hashAviso()).toMatch(/^[0-9a-f]{64}$/)
    expect(hashAviso(AVISO_PLANTILLA + ',')).not.toBe(hashAviso())
    expect(hashAviso(AVISO_PLANTILLA, AVISO_CASILLA + ',')).not.toBe(hashAviso())
  })
  it('es la huella de referencia del texto aprobado (3-huellas.txt: aviso + "\\n\\n" + casilla)', () => {
    expect(hashAviso()).toBe('04e1c370fc803665957655ce8f0876e6443d823a9b76d38c11f5afc0ac7e4054')
    expect(aprobado('3-huellas.txt')).toContain(hashAviso())
  })
  it('la versión cabe en el CHECK de reserva_avisos y el INSERT la lleva', () => {
    expect(AVISO_VERSION).toMatch(/^[a-z0-9][a-z0-9.-]{2,40}$/)
    expect(sqlAprobacion()).toContain(`'${AVISO_VERSION}', '${hashAviso()}', true, now()`)
    expect(() => sqlAprobacion("x'; drop", hashAviso())).toThrow()
    expect(() => sqlAprobacion(AVISO_VERSION, "x'); drop table x; --")).toThrow()
  })
})

describe('contenido', () => {
  it('la plantilla y la casilla son el texto aprobado, byte a byte', () => {
    expect(AVISO_PLANTILLA).toBe(aprobado('3-aviso-simplificado-reserva.txt'))
    expect(AVISO_CASILLA).toBe(aprobado('3-casilla.txt'))
    expect(AVISO_PLANTILLA).toContain(`Versión ${AVISO_VERSION}`)
    expect(AVISO_VERSION).toBe('reserva-2026-12-v1')
  })
  it('cubre el historial de cancelaciones, nombra a la SABG y no al INAI ni artículos', () => {
    expect(AVISO_PLANTILLA).toMatch(/historial de las citas que reservas en línea/)
    expect(AVISO_PLANTILLA).toMatch(/cancelan/)
    expect(AVISO_PLANTILLA).toContain('Secretaría Anticorrupción y Buen Gobierno')
    expect(AVISO_PLANTILLA).not.toMatch(/INAI/)
    expect(AVISO_PLANTILLA).not.toMatch(/art[íi]culo\s+\d|art\.\s*\d/i)
  })
  it('no queda nada de borrador: ni [VERIFICAR], ni plazo, ni marcadores sin rellenar', () => {
    expect(AVISO_PLANTILLA).not.toContain('[VERIFICAR')
    expect(AVISO_PLANTILLA).not.toContain('{PLAZO}')
    expect(AVISO_PLANTILLA.match(/\{[A-Z_]+\}/g)?.every(m => /^\{(MEDICO|CONSULTORIO|DIRECCION|TELEFONO|URL)\}$/.test(m))).toBe(true)
  })
  it('rellena los marcadores', () => {
    const t = textoAviso({ medico: 'Dr. X', consultorio: 'Uno', direccion: 'Calle 1', telefono: '9991234567', url: 'https://e/p' })
    expect(t).not.toMatch(/\{(MEDICO|CONSULTORIO|DIRECCION|TELEFONO|PLAZO|URL)\}/)
    expect(t).toContain('Dr. X, con domicilio en Calle 1 (Uno), es responsable')
    expect(t).toContain('comunícate con el consultorio al 9991234567 o acude a Calle 1.')
    expect(t.endsWith('Consúltalo en https://e/p')).toBe(true)
  })
  it('la dirección del aviso integral cuelga del código del enlace', () => {
    expect(rutaAvisoIntegral('abc')).toBe('/reservar/abc/privacidad')
    expect(urlAvisoIntegral('abc', { NEXT_PUBLIC_APP_URL: 'https://x.test/' })).toBe('https://x.test/reservar/abc/privacidad')
    expect(urlAvisoIntegral('abc', {})).toBe('https://www.spinus.com.mx/reservar/abc/privacidad')
  })
})
