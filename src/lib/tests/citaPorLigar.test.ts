/**
 * citaPorLigar.test.ts — D6: una cita POR LIGAR (reserva por enlace sin
 * paciente) es una CITA, no un evento genérico (lista A, punto 7), en la
 * clasificación, en el conteo de la cabecera, en el desglose de estados del
 * panel y en la marca de la tarjeta (lista A, punto 17). Y sin las columnas de
 * D1 (`reserva_canal` ausente) todo queda exactamente como antes.
 */
import { describe, it, expect } from 'vitest'
import type { EventApi } from '@fullcalendar/core'
import { esEventoGenerico, esPorLigar, marcaPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { contarVisibles } from '@/lib/agenda/conteoAgenda'
import { desgloseDeEstados } from '@/lib/agenda/huecosAgenda'

const PAC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('esEventoGenerico y esPorLigar', () => {
  it('sin reserva, decide el paciente como siempre (también con la columna ausente)', () => {
    expect(esEventoGenerico({ paciente_id: null })).toBe(true)
    expect(esEventoGenerico({})).toBe(true)
    expect(esEventoGenerico({ paciente_id: PAC })).toBe(false)
    expect(esEventoGenerico({ paciente_id: null, reserva_canal: null })).toBe(true)
  })
  it('una reserva sin paciente es una cita por ligar; ligada, una cita normal', () => {
    expect(esEventoGenerico({ paciente_id: null, reserva_canal: 'fijo' })).toBe(false)
    expect(esPorLigar({ paciente_id: null, reserva_canal: 'unico' })).toBe(true)
    expect(esPorLigar({ paciente_id: PAC, reserva_canal: 'unico' })).toBe(false)
    expect(esPorLigar({ paciente_id: null })).toBe(false)
  })
})

describe('marcaPorLigar', () => {
  it('«Por ligar» sin historial, «· N» con él y una frase entera para el title', () => {
    expect(marcaPorLigar({ paciente_id: null, reserva_canal: 'fijo', reserva_historial_previo: 0 })?.texto).toBe('Por ligar')
    const m = marcaPorLigar({ paciente_id: null, reserva_canal: 'fijo', reserva_historial_previo: 3 })
    expect(m?.texto).toBe('Por ligar · 3')
    expect(m?.titulo).toMatch(/3 cancelaciones o inasistencias/)
    expect(marcaPorLigar({ paciente_id: null, reserva_canal: 'fijo', reserva_historial_previo: 1 })?.titulo).toMatch(/1 cancelación o inasistencia/)
  })
  it('nada en una cita con paciente, en un evento o sin la columna', () => {
    expect(marcaPorLigar({ paciente_id: PAC, reserva_canal: 'fijo', reserva_historial_previo: 3 })).toBeNull()
    expect(marcaPorLigar({ paciente_id: null })).toBeNull()
  })
})

const DIA = new Date(2026, 10, 18)
const a = (h: number) => new Date(2026, 10, 18, h, 0)

describe('contarVisibles: la cita por ligar cuenta como cita', () => {
  const ev = (extendedProps: Record<string, unknown>, h = 10) => ({ start: a(h), end: a(h + 1), extendedProps })
  it('cita, por ligar, evento y Google', () => {
    const c = contarVisibles([
      ev({ paciente_id: PAC, status: 'scheduled' }),
      ev({ paciente_id: null, reserva_canal: 'unico', status: 'scheduled' }, 11),
      ev({ paciente_id: null, status: 'scheduled' }, 12),
      ev({ isGcalBlock: true }, 13),
    ], null, [])
    expect(c).toEqual({ citas: 2, eventos: 1, google: 1 })
  })
  it('sin la columna, una fila sin paciente sigue siendo evento', () => {
    expect(contarVisibles([ev({ paciente_id: null, status: 'scheduled' })], null, [])).toEqual({ citas: 0, eventos: 1, google: 0 })
  })
})

describe('desgloseDeEstados: la cita por ligar entra en el desglose del panel', () => {
  function evento(h: number, extendedProps: Record<string, unknown>): EventApi {
    return { start: a(h), end: a(h + 1), allDay: false, extendedProps } as unknown as EventApi
  }
  it('cuenta la por ligar y deja fuera el evento genérico', () => {
    const r = desgloseDeEstados([
      evento(9, { paciente_id: PAC, status: 'scheduled' }),
      evento(10, { paciente_id: null, reserva_canal: 'fijo', status: 'scheduled' }),
      evento(11, { paciente_id: null, status: 'scheduled' }),
    ], DIA)
    expect(r).toEqual([{ estado: 'scheduled', n: 2 }])
  })
})
