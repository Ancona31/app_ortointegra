import { describe, expect, it } from 'vitest'
import {
  accionesDeTarjeta, horarioDeTarjeta, nombreDeTarjeta, pideConfirmacion, telefonoDeTarjeta,
} from '@/lib/agenda/accionesTarjeta'

const CITA = { paciente_id: 'p1', reserva_canal: null } as const

describe('accionesDeTarjeta', () => {
  it('cita agendada: iniciar (si se puede), confirmar, reagendar, cancelar y editar', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, true))
      .toEqual(['iniciar-consulta', 'confirmar', 'reagendar', 'cancelar', 'editar'])
  })
  it('confirmada: ya no ofrece confirmar', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'confirmed' }, false)).toEqual(['reagendar', 'cancelar', 'editar'])
  })
  it('atendida, cancelada o no asistió: sólo iniciar (si se puede) y editar', () => {
    for (const status of ['attended', 'cancelled', 'no_show'] as const) {
      expect(accionesDeTarjeta({ ...CITA, status }, false)).toEqual(['editar'])
    }
  })
  it('una cita con paciente NUNCA se puede eliminar desde la tarjeta', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, true)).not.toContain('eliminar')
  })
  it('un evento sin paciente se edita o se elimina, y nada más', () => {
    expect(accionesDeTarjeta({ paciente_id: null, reserva_canal: null, status: 'scheduled' }, true)).toEqual(['editar', 'eliminar'])
  })
  it('una por ligar es una cita, no un evento', () => {
    expect(accionesDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'scheduled' }, true)).toContain('iniciar-consulta')
  })
  it('cancelar y eliminar piden confirmación; el resto no', () => {
    expect(pideConfirmacion('cancelar')).toBe(true)
    expect(pideConfirmacion('eliminar')).toBe(true)
    expect(pideConfirmacion('confirmar')).toBe(false)
  })
})

describe('nombre y teléfono', () => {
  const base = { title: 'Junta', pacientes: null, reserva_nombre: null, paciente_id: null, reserva_canal: null }
  it('el paciente, luego quien reservó, luego el título', () => {
    expect(nombreDeTarjeta({ ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: '999' } })).toBe('Ana Pech')
    expect(nombreDeTarjeta({ ...base, reserva_canal: 'unico', reserva_nombre: 'Luis Can' })).toBe('Luis Can')
    expect(nombreDeTarjeta(base)).toBe('Junta')
  })
  it('el teléfono de la ficha o el de la reserva', () => {
    expect(telefonoDeTarjeta({ pacientes: { id: 'p', nombre: 'A', apellidos: 'B', telefono: '999' }, reserva_telefono: '111' })).toBe('999')
    expect(telefonoDeTarjeta({ pacientes: null, reserva_telefono: '111' })).toBe('111')
    expect(telefonoDeTarjeta({ pacientes: null })).toBeNull()
  })
})

describe('horarioDeTarjeta', () => {
  const cita = { start_time: '2026-11-11T16:00:00Z', end_time: '2026-11-11T17:00:00Z' }
  it('en la zona de quien mira, sin aviso si el consultorio da la misma hora', () => {
    expect(horarioDeTarjeta({ ...cita, consultorio_timezone: 'America/Merida' }, 'America/Mexico_City'))
      .toEqual({ tramo: '10:00–11:00', enConsultorio: null })
  })
  it('con la hora del consultorio aparte si difiere', () => {
    const h = horarioDeTarjeta({ ...cita, consultorio_timezone: 'America/Cancun' }, 'America/Merida')
    expect(h.tramo).toBe('10:00–11:00')
    expect(h.enConsultorio).toMatch(/^11:00–12:00 hora /)
  })
  it('sin zona del consultorio, sólo el tramo', () => {
    expect(horarioDeTarjeta({ ...cita, consultorio_timezone: null }, 'America/Merida').enConsultorio).toBeNull()
  })
})
