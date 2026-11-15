/**
 * porConfirmarTiempoReal.test.ts — H4 (punto 18): qué le hace a la lista
 * «Por confirmar» cada cambio del canal de tiempo real de la agenda.
 *
 * MUTACIONES (comprobadas en rojo): `entraEnPorConfirmar` sin `status ===
 * 'scheduled'` (una confirmada se queda); `efectoEnPorConfirmar` devolviendo
 * 'nada' a una listada que ya no entra (la fila no sale); sin `esDeManana`
 * (una cita de pasado mañana recarga la lista).
 */
import { describe, it, expect } from 'vitest'
import { desplazarFecha, fechaHoraLocalAInstante, hoyEnTZ } from '@/lib/dates'
import { efectoEnPorConfirmar, entraEnPorConfirmar, type CambioCita, type FilaCambioCita } from '@/lib/agenda/porConfirmarTiempoReal'

const TZ = 'America/Merida'
const AHORA = Date.now()
const dia = (n: number): string => desplazarFecha(hoyEnTZ(TZ), { dias: n })
const MANANA_10 = fechaHoraLocalAInstante(dia(1), '10:00', TZ)
const MANANA_11 = fechaHoraLocalAInstante(dia(1), '11:00', TZ)
const PASADO_10 = fechaHoraLocalAInstante(dia(2), '10:00', TZ)

function fila(extra: Partial<FilaCambioCita> = {}): FilaCambioCita {
  return { id: 'c1', paciente_id: 'p1', reserva_canal: null, status: 'scheduled', all_day: false, start_time: MANANA_10, consultorio_timezone: TZ, ...extra }
}
const update = (extra: Partial<FilaCambioCita> = {}): CambioCita => ({ tipo: 'UPDATE', fila: fila(extra) })
const LISTADA = new Map([['c1', MANANA_10]])
const VACIA = new Map<string, string>()

describe('entraEnPorConfirmar (la regla de la ruta)', () => {
  it('agendada de mañana con paciente o por ligar, con hora', () => {
    expect(entraEnPorConfirmar(fila(), AHORA)).toBe(true)
    expect(entraEnPorConfirmar(fila({ paciente_id: null, reserva_canal: 'enlace_unico' }), AHORA)).toBe(true)
  })
  it.each([
    ['confirmada', { status: 'confirmed' }],
    ['cancelada', { status: 'cancelled' }],
    ['sin paciente', { paciente_id: null }],
    ['de todo el día', { all_day: true }],
    ['de pasado mañana', { start_time: PASADO_10 }],
  ] as const)('%s no entra', (_n, extra) => {
    expect(entraEnPorConfirmar(fila(extra), AHORA)).toBe(false)
  })
})

describe('efectoEnPorConfirmar', () => {
  it('confirmada a mano o por el paciente: la fila sale sin pedir nada', () => {
    expect(efectoEnPorConfirmar(LISTADA, update({ status: 'confirmed' }), AHORA)).toBe('quitar')
  })
  it('cancelada: sale y se recarga (puede haber sido el paciente)', () => {
    expect(efectoEnPorConfirmar(LISTADA, update({ status: 'cancelled' }), AHORA)).toBe('quitar_y_recargar')
  })
  it('movida a otro día o borrada: sale', () => {
    expect(efectoEnPorConfirmar(LISTADA, update({ start_time: PASADO_10 }), AHORA)).toBe('quitar')
    expect(efectoEnPorConfirmar(LISTADA, { tipo: 'DELETE', id: 'c1' }, AHORA)).toBe('quitar')
  })
  it('una nueva o reagendada para mañana recarga; una listada que cambia de hora, también', () => {
    expect(efectoEnPorConfirmar(VACIA, { tipo: 'INSERT', fila: fila() }, AHORA)).toBe('recargar')
    expect(efectoEnPorConfirmar(VACIA, update(), AHORA)).toBe('recargar')
    expect(efectoEnPorConfirmar(LISTADA, update({ start_time: MANANA_11 }), AHORA)).toBe('recargar')
  })
  it('en reposo, nada: el eco de Google de una listada, lo de otro día, el borrado de una ajena', () => {
    expect(efectoEnPorConfirmar(LISTADA, update(), AHORA)).toBe('nada')
    expect(efectoEnPorConfirmar(VACIA, update({ start_time: PASADO_10 }), AHORA)).toBe('nada')
    expect(efectoEnPorConfirmar(VACIA, update({ status: 'confirmed' }), AHORA)).toBe('nada')
    expect(efectoEnPorConfirmar(LISTADA, { tipo: 'DELETE', id: 'otra' }, AHORA)).toBe('nada')
  })
})
