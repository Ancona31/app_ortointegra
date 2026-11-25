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

interface Respuesta { data: { id: string; cerrada_en?: string | null }[] | null; count: number | null; error: { message: string } | null }

interface RespuestaBloqueos { data: unknown[] | null; error: { code?: string; message: string } | null }

const h = vi.hoisted(() => {
  const estado: { llamadas: unknown[][]; respuesta: Respuesta; bloqueos: unknown[][]; respuestaBloqueos: RespuestaBloqueos } = {
    llamadas: [], respuesta: { data: [], count: 0, error: null },
    bloqueos: [], respuestaBloqueos: { data: [], error: null },
  }
  return estado
})

/* K1 · La lectura de `agenda_bloqueos`, que va en paralelo: su propio registro. */
class BloqueosFalsa {
  constructor() { h.bloqueos.push(['from', 'agenda_bloqueos']) }
  select(...args: unknown[]): this { h.bloqueos.push(['select', ...args]); return this }
  eq(...args: unknown[]): this { h.bloqueos.push(['eq', ...args]); return this }
  lt(...args: unknown[]): this { h.bloqueos.push(['lt', ...args]); return this }
  gt(...args: unknown[]): this { h.bloqueos.push(['gt', ...args]); return this }
  order(...args: unknown[]): this { h.bloqueos.push(['order', ...args]); return this }
  limit(...args: unknown[]): this { h.bloqueos.push(['limit', ...args]); return this }
  then<A, B>(ok: (r: RespuestaBloqueos) => A, ko?: (e: unknown) => B): Promise<A | B> {
    return Promise.resolve(h.respuestaBloqueos).then(ok, ko)
  }
}

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
  createClient: async () => ({ from: (t: string) => (t === 'agenda_bloqueos' ? new BloqueosFalsa() : new ConsultaFalsa()) }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

const { createClient } = await import('@/lib/supabase/server')
const { consultaCitas } = await import('@/lib/agenda/consultaCitas')

const DESDE = '2026-11-09T06:00:00.000Z'
const HASTA = '2026-11-16T06:00:00.000Z'

beforeEach(() => {
  h.llamadas = []
  h.respuesta = { data: [{ id: 'a' }, { id: 'b' }], count: 2, error: null }
  h.bloqueos = []
  h.respuestaBloqueos = { data: [], error: null }
})

describe('K1 · los bloqueos de horario en el mismo viaje', () => {
  const FILA = { id: 'b1', medico_id: 'm1', inicio: DESDE, fin: HASTA, todo_el_dia: false, zona: 'America/Merida', motivo: null }

  it('lee la clínica, el médico y la ventana por solape (inicio < hasta, fin > desde)', async () => {
    h.respuestaBloqueos = { data: [FILA, { id: 'roto' }], error: null }
    const r = await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: 'm1' })
    expect(h.bloqueos).toEqual([
      ['from', 'agenda_bloqueos'],
      ['select', 'id, medico_id, inicio, fin, todo_el_dia, zona, motivo'],
      ['eq', 'clinica_id', 'c1'],
      ['eq', 'medico_id', 'm1'],
      ['lt', 'inicio', HASTA],
      ['gt', 'fin', DESDE],
      ['order', 'inicio', { ascending: true }],
      ['limit', 500],
    ])
    expect(r.ok && r.bloqueos).toEqual([FILA])
  })

  it('sin la tabla (42P01 / PGRST205) o con error: ninguno, y las citas llegan igual', async () => {
    h.respuestaBloqueos = { data: null, error: { code: 'PGRST205', message: 'no existe' } }
    const r = await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: '' })
    expect(r.ok && r.bloqueos).toEqual([])
    expect(r.ok && r.appointments.length).toBe(2)
  })
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
    expect(r).toEqual({ ok: true, appointments: [{ id: 'a' }, { id: 'b' }], incompleta: false, bloqueos: [] })
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
      .toEqual({ ok: true, appointments: [], incompleta: false, bloqueos: [] })
    h.respuesta = { data: null, count: null, error: { message: 'boom' } }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toEqual({ ok: false, error: 'boom' })
  })
})

describe('Tanda I (punto 12) · la cancelada cerrada no se pinta', () => {
  it('quita las filas con `cerrada_en`; sin la columna, ninguna; `incompleta` cuenta las crudas', async () => {
    h.respuesta = { data: [{ id: 'a' }, { id: 'b', cerrada_en: '2026-11-17T10:00:00.000Z' }, { id: 'c', cerrada_en: null }], count: 3, error: null }
    expect(await consultaCitas(await createClient(), { clinicaId: 'c1', from: DESDE, to: HASTA, medicoId: null }))
      .toEqual({ ok: true, appointments: [{ id: 'a' }, { id: 'c', cerrada_en: null }], incompleta: false, bloqueos: [] })
  })
})
