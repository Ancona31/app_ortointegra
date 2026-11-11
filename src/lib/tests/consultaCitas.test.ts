/**
 * consultaCitas.test.ts — la consulta de citas de `GET /api/appointments` y de
 * la semilla de la agenda (A1.4b): qué filtros manda, y cuándo es `incompleta`.
 *
 * El doble del cliente sale de `vi.mock('@/lib/supabase/server')`, como en
 * `googleEventsParalelo.test.ts`: así `createClient()` conserva su tipo real y
 * no hace falta ningún `as`. El builder es un thenable que apunta cada llamada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APPOINTMENT_SELECT } from '@/lib/appointments'

interface Respuesta { data: { id: string }[] | null; count: number | null; error: { message: string } | null }

const h = vi.hoisted(() => {
  const estado: { llamadas: unknown[][]; respuesta: Respuesta } = {
    llamadas: [], respuesta: { data: [], count: 0, error: null },
  }
  return estado
})

class ConsultaFalsa {
  constructor() { h.llamadas.push(['from', 'appointments']) }
  select(...args: unknown[]): this { h.llamadas.push(['select', ...args]); return this }
  eq(...args: unknown[]): this { h.llamadas.push(['eq', ...args]); return this }
  order(...args: unknown[]): this { h.llamadas.push(['order', ...args]); return this }
  lt(...args: unknown[]): this { h.llamadas.push(['lt', ...args]); return this }
  gte(...args: unknown[]): this { h.llamadas.push(['gte', ...args]); return this }
  then<A, B>(ok: (r: Respuesta) => A, ko?: (e: unknown) => B): Promise<A | B> {
    return Promise.resolve(h.respuesta).then(ok, ko)
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => new ConsultaFalsa() }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

const { createClient } = await import('@/lib/supabase/server')
const { consultaCitas } = await import('@/lib/agenda/consultaCitas')

const DESDE = '2026-11-09T06:00:00.000Z'
const HASTA = '2026-11-16T06:00:00.000Z'

beforeEach(() => {
  h.llamadas = []
  h.respuesta = { data: [{ id: 'a' }, { id: 'b' }], count: 2, error: null }
})

describe('consultaCitas', () => {
  it('manda select con count exacto, la clínica, el orden, el médico y la ventana por solape', async () => {
    const r = await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: 'm1' })
    expect(h.llamadas).toEqual([
      ['from', 'appointments'],
      ['select', APPOINTMENT_SELECT, { count: 'exact' }],
      ['eq', 'clinica_id', 'c1'],
      ['order', 'start_time', { ascending: true }],
      ['eq', 'medico_id', 'm1'],
      ['lt', 'start_time', HASTA],
      ['gte', 'end_time', DESDE],
    ])
    expect(r).toEqual({ ok: true, appointments: [{ id: 'a' }, { id: 'b' }], incompleta: false })
  })

  it('sin médico (`null` o `\'\'`) ni ventana: sólo la clínica y el orden', async () => {
    for (const medicoId of [null, '']) {
      h.llamadas = []
      await consultaCitas(await createClient(), { clinicaId: 'c1', from: null, to: null, medicoId })
      expect(h.llamadas.map(l => l[0])).toEqual(['from', 'select', 'eq', 'order'])
    }
  })

  it('incompleta si el conteo supera a las filas, o si no llegó', async () => {
    h.respuesta = { data: [{ id: 'a' }], count: 1000, error: null }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toMatchObject({ ok: true, incompleta: true })
    h.respuesta = { data: [{ id: 'a' }], count: null, error: null }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toMatchObject({ ok: true, incompleta: true })
  })

  it('sin datos y conteo 0: lista vacía, completa; con error: `ok: false` con el mensaje', async () => {
    h.respuesta = { data: null, count: 0, error: null }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toEqual({ ok: true, appointments: [], incompleta: false })
    h.respuesta = { data: null, count: null, error: { message: 'boom' } }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toEqual({ ok: false, error: 'boom' })
  })
})
