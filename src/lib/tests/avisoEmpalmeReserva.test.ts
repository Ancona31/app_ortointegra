/** D11 · qué avisos de empalme con reservas por enlace siguen vigentes (puro). */
import { describe, it, expect } from 'vitest'
import {
  empalmesVigentes, esEmpalmeReciente, textoAvisoEmpalme, type CitaDelPar, type ParEmpalme,
} from '@/lib/agenda/avisoEmpalmeReserva'

const AHORA = Date.parse('2031-06-01T12:00:00Z')
const reserva: CitaDelPar = {
  id: 'r1', title: 'Persona Reserva', start_time: '2031-06-03T16:00:00Z', end_time: '2031-06-03T16:30:00Z',
  consultorio_timezone: 'America/Merida', status: 'scheduled', all_day: false, medico_id: 'm1',
}
const evento: CitaDelPar = { ...reserva, id: 'g1', title: 'Junta', start_time: '2031-06-03T16:15:00Z', end_time: '2031-06-03T17:00:00Z' }
const par: ParEmpalme = { cita_reserva_id: 'r1', cita_otra_id: 'g1', detectado_en: '2031-06-01T11:59:00Z' }

describe('empalmesVigentes', () => {
  it('el par en pie sale con la hora de la reserva y su zona', () => {
    expect(empalmesVigentes([par], [reserva, evento], AHORA)).toEqual([
      { id: 'r1', inicio: reserva.start_time, zona: 'America/Merida', titulo: 'Persona Reserva', detectado_en: par.detectado_en },
    ])
  })

  it.each([
    ['la reserva cancelada', [{ ...reserva, status: 'cancelled' }, evento]],
    ['la reserva ya pasó', [{ ...reserva, start_time: '2031-05-01T10:00:00Z', end_time: '2031-05-01T10:30:00Z' }, evento]],
    ['el evento cancelado', [reserva, { ...evento, status: 'cancelled' }]],
    ['el evento no_show', [reserva, { ...evento, status: 'no_show' }]],
    ['el evento movido fuera (justo al acabar)', [reserva, { ...evento, start_time: '2031-06-03T16:30:00Z' }]],
    ['el evento de otro médico', [reserva, { ...evento, medico_id: 'm2' }]],
    ['una de las dos no se ve (RLS) o ya no existe', [reserva]],
  ] as Array<[string, CitaDelPar[]]>)('no sale: %s', (_n, citas) => {
    expect(empalmesVigentes([par], citas, AHORA)).toEqual([])
  })

  it('dos pares con la misma reserva: una fila, la detección más reciente', () => {
    const otro: CitaDelPar = { ...evento, id: 'g2' }
    const filas = empalmesVigentes([par, { cita_reserva_id: 'r1', cita_otra_id: 'g2', detectado_en: '2031-06-01T11:59:30Z' }], [reserva, evento, otro], AHORA)
    expect(filas).toHaveLength(1)
    expect(filas[0].detectado_en).toBe('2031-06-01T11:59:30Z')
  })
})

describe('aviso emergente', () => {
  it('reciente = menos de 2 min', () => {
    expect(esEmpalmeReciente('2031-06-01T11:58:30Z', AHORA)).toBe(true)
    expect(esEmpalmeReciente('2031-06-01T11:57:59Z', AHORA)).toBe(false)
    expect(esEmpalmeReciente('no es fecha', AHORA)).toBe(false)
  })

  it('el texto lleva fecha y hora en la zona del consultorio y ningún nombre', () => {
    const t = textoAvisoEmpalme(reserva.start_time, 'America/Merida')
    expect(t).toContain('10:00')
    expect(t).toMatch(/junio/)
    expect(t).not.toContain('Persona')
  })
})
