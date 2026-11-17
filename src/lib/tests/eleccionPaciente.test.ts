/**
 * eleccionPaciente.test.ts — tanda I, punto 9: el candado sobre lo que el
 * paciente eligió al reservar por enlace, la regla pura que comparten el PUT,
 * el formulario y el arrastre (la base la repite en `cita_proteger_eleccion`).
 */
import { describe, it, expect } from 'vitest'
import { eleccionFija, vetoPorEleccion, TEXTO_ELECCION, type FilaEleccion } from '@/lib/agenda/eleccionPaciente'

const AHORA = Date.parse('2026-11-17T12:00:00Z')
const FILA: FilaEleccion = {
  reserva_canal: 'unico', start_time: '2026-11-20T16:00:00Z', medico_id: 'm1', consultorio_id: 'k1', all_day: false,
}

describe('eleccionFija', () => {
  it('sólo por enlace y sólo si aún no empieza', () => {
    expect(eleccionFija(FILA, AHORA)).toBe(true)
    expect(eleccionFija({ ...FILA, reserva_canal: 'fijo' }, AHORA)).toBe(true)
    expect(eleccionFija({ ...FILA, reserva_canal: null }, AHORA)).toBe(false)
    expect(eleccionFija({ ...FILA, reserva_canal: undefined }, AHORA)).toBe(false)
    expect(eleccionFija({ ...FILA, start_time: '2026-11-17T12:00:00Z' }, AHORA)).toBe(false)
  })
})

describe('vetoPorEleccion', () => {
  it('el médico, con su propio mensaje', () => {
    expect(vetoPorEleccion(FILA, { medico_id: 'm2' }, AHORA)).toEqual({ campo: 'medico', mensaje: TEXTO_ELECCION.medico })
    expect(vetoPorEleccion(FILA, { medico_id: null }, AHORA)?.campo).toBe('medico')
  })
  it('inicio, consultorio y todo el día, a «Reagendar»', () => {
    for (const cambio of [{ start_time: '2026-11-20T17:00:00Z' }, { consultorio_id: 'k2' }, { all_day: true }]) {
      expect(vetoPorEleccion(FILA, cambio, AHORA)).toEqual({ campo: 'reagendar', mensaje: TEXTO_ELECCION.reagendar })
    }
  })
  it('reescribir lo mismo no cuenta (el mismo instante en otra zona, el mismo consultorio o médico)', () => {
    expect(vetoPorEleccion(FILA, { start_time: '2026-11-20T10:00:00-06:00', medico_id: 'm1', consultorio_id: 'k1', all_day: false }, AHORA)).toBeNull()
    expect(vetoPorEleccion(FILA, {}, AHORA)).toBeNull()
    expect(vetoPorEleccion(FILA, { all_day: null }, AHORA)).toBeNull()
  })
  it('sin candado (no vino de un enlace, o ya empezó) no veta nada', () => {
    expect(vetoPorEleccion({ ...FILA, reserva_canal: null }, { medico_id: 'm2', start_time: '2026-11-21T16:00:00Z' }, AHORA)).toBeNull()
    expect(vetoPorEleccion({ ...FILA, start_time: '2026-11-16T16:00:00Z' }, { consultorio_id: 'k2' }, AHORA)).toBeNull()
  })
})
