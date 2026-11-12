/** esquemasReserva.test.ts — agenda D5: strictObject (claves de más → error) y la casilla del aviso obligatoria. */
import { describe, it, expect } from 'vitest'
import { PedirCodigoSchema, ReservarSchema, TurnosQuerySchema, VerificarCodigoSchema } from '@/lib/reserva/esquemasReserva'

const ID = '00000000-0000-4000-8000-000000000001'
const BASE = {
  consultorio_id: ID, tipo_cita_id: ID, inicio: '2031-05-06T16:00:00.000Z', nombre: 'Ana', telefono: '5512345678',
  correo: 'ana@x.mx', acepta_aviso: true, client_id: ID,
}

describe('esquemas de la reserva', () => {
  it('reservar: válido, y cualquier clave de más se rechaza', () => {
    expect(ReservarSchema.safeParse(BASE).success).toBe(true)
    expect(ReservarSchema.safeParse({ ...BASE, clinica_id: ID }).success).toBe(false)
    expect(ReservarSchema.safeParse({ ...BASE, medico_id: ID }).success).toBe(false)
    expect(ReservarSchema.safeParse({ ...BASE, fin: BASE.inicio }).success).toBe(false)
  })
  it('reservar: sin aceptar el aviso no pasa', () => {
    expect(ReservarSchema.safeParse({ ...BASE, acepta_aviso: false }).success).toBe(false)
    const { acepta_aviso: _quitado, ...sin } = BASE
    void _quitado
    expect(ReservarSchema.safeParse(sin).success).toBe(false)
  })
  it('reservar: la ficha tiene forma de 43 caracteres base64url', () => {
    expect(ReservarSchema.safeParse({ ...BASE, ficha: 'a'.repeat(43) }).success).toBe(true)
    expect(ReservarSchema.safeParse({ ...BASE, ficha: 'a'.repeat(42) }).success).toBe(false)
  })
  it('turnos, código y verificar también son estrictos', () => {
    expect(TurnosQuerySchema.safeParse({ consultorio: ID, tipo: ID, desde: '2031-05-06' }).success).toBe(true)
    expect(TurnosQuerySchema.safeParse({ consultorio: ID, tipo: ID, desde: '2031-05-06', medico: ID }).success).toBe(false)
    expect(PedirCodigoSchema.safeParse({ correo: 'a@b.mx', extra: 1 }).success).toBe(false)
    expect(VerificarCodigoSchema.safeParse({ correo: 'a@b.mx', codigo: '12345' }).success).toBe(false)
    expect(VerificarCodigoSchema.safeParse({ correo: 'a@b.mx', codigo: '123456' }).success).toBe(true)
  })
})

describe('fecha de turnos', () => {
  it('rechaza fechas que no existen (no llegan a romper el cálculo con un 500)', () => {
    const ID = '00000000-0000-4000-8000-000000000001'
    expect(TurnosQuerySchema.safeParse({ consultorio: ID, tipo: ID, desde: '2026-13-45' }).success).toBe(false)
    expect(TurnosQuerySchema.safeParse({ consultorio: ID, tipo: ID, desde: '2026-02-30' }).success).toBe(false)
  })
})
