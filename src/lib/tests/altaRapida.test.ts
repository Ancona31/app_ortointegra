import { describe, expect, it } from 'vitest'
import {
  consultorioPropuesto, datosDeAltaRapida, duracionDeSeleccion, etiquetaBurbuja, medicoPropuesto,
  motivoParaNoGuardar, necesitaElegirMedico, sumarMinutos, type EntradaAltaRapida,
} from '@/lib/agenda/altaRapida'
import { DEFAULT_DURATION } from '@/lib/agenda/duracionCita'

/* Instantes en hora LOCAL, como los que entrega FullCalendar con `timeZone: 'local'`. */
const D = (h: number, m = 0, dia = 11) => new Date(2026, 10, dia, h, m)

describe('duracionDeSeleccion', () => {
  it('MUTACIÓN: arrastrar más de una franja respeta lo arrastrado (10:00–11:30 = 90)', () => {
    expect(duracionDeSeleccion(D(10), D(11, 30), false)).toBe(90)
  })
  it('un clic o una sola franja dan la duración por omisión', () => {
    expect(duracionDeSeleccion(D(10), null, false)).toBe(DEFAULT_DURATION)
    expect(duracionDeSeleccion(D(10), D(10, 30), false)).toBe(DEFAULT_DURATION)
  })
  it('MUTACIÓN: un hueco del panel nunca propone su largo entero', () => {
    expect(duracionDeSeleccion(D(10), D(13), true)).toBe(DEFAULT_DURATION)
  })
  it('una selección que cruza a otro día cae a la duración por omisión', () => {
    expect(duracionDeSeleccion(D(23), D(1, 0, 12), false)).toBe(DEFAULT_DURATION)
    expect(duracionDeSeleccion(D(10), D(11, 0, 12), false)).toBe(DEFAULT_DURATION)
  })
})

describe('sumarMinutos', () => {
  it('suma y no pasa de las 23:59', () => {
    expect(sumarMinutos('10:00', 90)).toBe('11:30')
    expect(sumarMinutos('23:30', 60)).toBe('23:59')
  })
})

describe('médico y consultorio', () => {
  const uno = [{ id: 'm1' }]
  const dos = [{ id: 'm1' }, { id: 'm2' }]
  it('el del filtro; con «Todos», el único si sólo hay uno; si hay varios, se pide', () => {
    expect(medicoPropuesto('m2', dos)).toBe('m2')
    expect(medicoPropuesto(null, uno)).toBe('m1')
    expect(medicoPropuesto(null, dos)).toBeNull()
    expect(necesitaElegirMedico(null, dos)).toBe(true)
    expect(necesitaElegirMedico('m1', dos)).toBe(false)
    expect(necesitaElegirMedico(null, uno)).toBe(false)
  })
  it('el consultorio activo sólo si es del médico', () => {
    expect(consultorioPropuesto({ id: 'c1', medico_id: 'm1' }, 'm1')).toBe('c1')
    expect(consultorioPropuesto({ id: 'c1', medico_id: 'm1' }, 'm2')).toBeNull()
    expect(consultorioPropuesto(null, 'm1')).toBeNull()
    expect(consultorioPropuesto({ id: 'c1', medico_id: 'm1' }, null)).toBeNull()
  })
})

const PACIENTE = { id: 'p1', nombre: 'Hugo', apellidos: 'Interián Pech', telefono: null }
const BASE: EntradaAltaRapida = {
  fecha: '2026-11-11', horaInicio: '10:00', horaFin: '11:30', paciente: PACIENTE, medicoId: 'm1', consultorioId: 'c1',
}

describe('motivoParaNoGuardar', () => {
  it('pide paciente, médico, consultorio y un fin posterior al inicio', () => {
    expect(motivoParaNoGuardar(BASE)).toBeNull()
    expect(motivoParaNoGuardar({ ...BASE, paciente: null })).toMatch(/paciente/)
    expect(motivoParaNoGuardar({ ...BASE, medicoId: null })).toMatch(/médico/)
    expect(motivoParaNoGuardar({ ...BASE, consultorioId: null })).toMatch(/Más opciones/)
    expect(motivoParaNoGuardar({ ...BASE, horaFin: '10:00' })).toMatch(/posterior/)
    expect(motivoParaNoGuardar({ ...BASE, horaFin: '' })).toMatch(/hora/)
  })
})

describe('datosDeAltaRapida', () => {
  it('tiene la forma del alta de una cita del modal', () => {
    const d = datosDeAltaRapida(BASE)
    expect(d).toEqual({
      title: 'Hugo Interián Pech',
      all_day: false,
      start_time: new Date('2026-11-11T10:00').toISOString(),
      end_time: new Date('2026-11-11T11:30').toISOString(),
      notes: null,
      status: 'scheduled',
      paciente_id: 'p1',
      pacientes: PACIENTE,
      icono: null,
      color: null,
      medico_id: 'm1',
      consultorio_id: 'c1',
    })
  })
  it('no lleva tipo de cita, ni id, ni nada de reserva', () => {
    const d = datosDeAltaRapida(BASE) ?? {}
    expect('tipo_cita_id' in d).toBe(false)
    expect('id' in d).toBe(false)
    expect('reserva_canal' in d).toBe(false)
  })
  it('sin paciente no arma nada (nunca un evento ni una cita por ligar)', () => {
    expect(datosDeAltaRapida({ ...BASE, paciente: null })).toBeNull()
  })
})

describe('etiquetaBurbuja', () => {
  it('nombra la burbuja con el día y el tramo', () => {
    expect(etiquetaBurbuja('2026-11-11', '10:00', '11:30')).toBe('Nueva cita · mié 11, 10:00–11:30')
  })
})
