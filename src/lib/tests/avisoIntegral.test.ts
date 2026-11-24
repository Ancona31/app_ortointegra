/**
 * avisoIntegral.test.ts — privacidad 2026-12: el aviso integral del
 * consultorio es el documento 2 aprobado, con los DOS cambios que manda
 * PENDIENTES-TECNICOS.md y ninguno más, y se rellena sin dejar huecos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AVISO_INTEGRAL_FECHA, AVISO_INTEGRAL_PLANTILLA, AVISO_INTEGRAL_VERSION } from '@/lib/reserva/avisoIntegral'
import { textoAviso } from '@/lib/reserva/avisoReserva'

const DOCUMENTO = readFileSync(
  resolve(process.cwd(), 'docs/spec/privacidad-2026-12/2-aviso-consultorio-pacientes-y-reserva.md'), 'utf8',
).replace(/\n+$/, '')

describe('aviso integral del consultorio', () => {
  it('es el documento aprobado, salvo la fecha y el correo de privacidad que aún no existe', () => {
    const esperado = DOCUMENTO
      .replace('[FECHA DE PUBLICACIÓN]', '{FECHA}')
      .replace(' al correo {CORREO_PRIVACIDAD} o,', '')
    expect(esperado).not.toBe(DOCUMENTO)
    expect(AVISO_INTEGRAL_PLANTILLA).toBe(esperado)
    expect(AVISO_INTEGRAL_PLANTILLA).toContain(`Versión ${AVISO_INTEGRAL_VERSION} · Última actualización: {FECHA}`)
  })
  it('no promete un correo que no hay, ni nombra al INAI, ni cita artículos', () => {
    expect(AVISO_INTEGRAL_PLANTILLA).not.toContain('CORREO_PRIVACIDAD')
    expect(AVISO_INTEGRAL_PLANTILLA).toContain('**Medios.** Por escrito en {DIRECCION}, para orientación, al teléfono {TELEFONO}.')
    expect(AVISO_INTEGRAL_PLANTILLA).toContain('Secretaría Anticorrupción y Buen Gobierno')
    expect(AVISO_INTEGRAL_PLANTILLA).not.toMatch(/INAI/)
    expect(AVISO_INTEGRAL_PLANTILLA).not.toMatch(/art[íi]culo\s+\d|art\.\s*\d/i)
    expect(AVISO_INTEGRAL_PLANTILLA).not.toContain('®')
  })
  it('rellenado no deja ningún marcador', () => {
    const t = textoAviso(
      { medico: 'Dr. X', consultorio: 'Uno', direccion: 'Calle 1', telefono: '9991234567', url: '' },
      AVISO_INTEGRAL_PLANTILLA.replace('{FECHA}', AVISO_INTEGRAL_FECHA),
    )
    expect(t).not.toMatch(/\{[A-Z_]+\}|\[FECHA/)
    expect(t).toContain('Dr. X, con domicilio en Calle 1 (Uno), es responsable del tratamiento')
    expect(t).toContain('**Quién atiende.** Dr. X.')
  })
})
