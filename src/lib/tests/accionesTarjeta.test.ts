import { describe, expect, it } from 'vitest'
import {
  accionesDeTarjeta, esConvertible, horarioDeTarjeta, nombreDeTarjeta, pideConfirmacion, puedeIniciarConsulta, telefonoDeTarjeta,
  textoDeConfirmacion,
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

/* ── F3 · el enchufe de la tarjeta ─────────────────────────────────────── */

describe('accionesDeTarjeta sin `cambiarEstadoCita`', () => {
  it('no ofrece «Confirmar» aunque la cita esté agendada', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, false, false)).toEqual(['reagendar', 'cancelar', 'editar'])
  })
})

describe('puedeIniciarConsulta (las condiciones del modal)', () => {
  const medico = { esMedico: true, perfilId: 'm1', consultorioExiste: true }
  const conPaciente = { pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null }, paciente_id: 'p', reserva_canal: null, medico_id: 'm1' }
  it('médico, su cita, su consultorio y con paciente: sí', () => {
    expect(puedeIniciarConsulta(conPaciente, medico)).toBe(true)
  })
  it('una por ligar suya también (D7 la liga en el modal)', () => {
    expect(puedeIniciarConsulta({ ...conPaciente, pacientes: null, paciente_id: null, reserva_canal: 'fijo' }, medico)).toBe(true)
  })
  it('no: si no es médico, si la cita es de otro, si el consultorio no está o si es un evento', () => {
    expect(puedeIniciarConsulta(conPaciente, { ...medico, esMedico: false })).toBe(false)
    expect(puedeIniciarConsulta({ ...conPaciente, medico_id: 'otro' }, medico)).toBe(false)
    expect(puedeIniciarConsulta(conPaciente, { ...medico, consultorioExiste: false })).toBe(false)
    expect(puedeIniciarConsulta({ ...conPaciente, pacientes: null, paciente_id: null }, medico)).toBe(false)
  })
})

describe('textoDeConfirmacion', () => {
  const base = { title: 'Junta', pacientes: null, reserva_nombre: null, paciente_id: null, reserva_canal: null }
  it('cancelar nombra al paciente y dice que la cita se queda (B3)', () => {
    expect(textoDeConfirmacion('cancelar', { ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null } }))
      .toMatch(/^¿Cancelar la cita de Ana Pech\?.*cancelada\.$/)
  })
  it('eliminar nombra el evento', () => {
    expect(textoDeConfirmacion('eliminar', base)).toBe('¿Eliminar el evento «Junta»? No se puede deshacer.')
  })
})

/* T3 · punto 6 (AG-DT-29). MUTACIÓN: devolver siempre `['editar', 'eliminar']`
   a los eventos → «nacido en Google, con hora…» en rojo. */
describe('«Convertir en cita» (un evento nacido en Google)', () => {
  const EVENTO_GOOGLE = { paciente_id: null, reserva_canal: null, origen: 'google', all_day: false, medico_id: 'm1' } as const
  it('nacido en Google, con hora, con médico y vivo: editar, convertir y eliminar', () => {
    for (const status of ['scheduled', 'confirmed'] as const) {
      expect(accionesDeTarjeta({ ...EVENTO_GOOGLE, status }, false)).toEqual(['editar', 'convertir', 'eliminar'])
    }
  })
  it('no: nacido en Spinus, de todo el día, sin médico, cancelado, con paciente o por ligar', () => {
    const casos = [
      { ...EVENTO_GOOGLE, origen: 'spinus' as const }, { ...EVENTO_GOOGLE, origen: undefined },
      { ...EVENTO_GOOGLE, all_day: true }, { ...EVENTO_GOOGLE, medico_id: null },
    ]
    for (const c of casos) expect(esConvertible({ ...c, status: 'scheduled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, status: 'cancelled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, paciente_id: 'p1', status: 'scheduled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, reserva_canal: 'fijo', status: 'scheduled' })).toBe(false)
  })
})
