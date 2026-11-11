/**
 * ajustesAgenda.test.ts — los ajustes de la agenda por clínica y el interruptor
 * de la agenda v2 (plan del bloque B, paso B1): valores de fábrica de §2, bordes
 * de los límites, claves que el esquema rechaza, y que las dos lecturas fallan
 * CERRADO (fábrica / apagado) ante cualquier cosa que no sea una fila buena.
 *
 * El doble del cliente sale de `vi.mock('@/lib/supabase/server')`, como en
 * `consultaCitas.test.ts`: así `createClient()` conserva su tipo real y no
 * hace falta ningún `as`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Respuesta { data: Record<string, unknown> | null; error: { message: string } | null }

const h = vi.hoisted(() => {
  const estado: { llamadas: unknown[][]; respuesta: Respuesta | Error } = {
    llamadas: [], respuesta: { data: null, error: null },
  }
  return estado
})

class ConsultaFalsa {
  constructor(tabla: string) { h.llamadas.push(['from', tabla]) }
  select(...args: unknown[]): this { h.llamadas.push(['select', ...args]); return this }
  eq(...args: unknown[]): this { h.llamadas.push(['eq', ...args]); return this }
  maybeSingle(): Promise<Respuesta> {
    return h.respuesta instanceof Error ? Promise.reject(h.respuesta) : Promise.resolve(h.respuesta)
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (tabla: string) => new ConsultaFalsa(tabla) }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

const { createClient } = await import('@/lib/supabase/server')
const {
  FABRICA_AJUSTES_AGENDA, LIMITES_AJUSTES_AGENDA, AjustesAgendaSchema, leerAjustesAgenda, agendaV2Encendida,
} = await import('@/lib/agenda/ajustesAgenda')

const CLINICA = '00000000-0000-4000-8000-0000000000c1'

beforeEach(() => {
  h.llamadas = []
  h.respuesta = { data: null, error: null }
})

describe('valores de fábrica y límites (§2)', () => {
  it('la fábrica es 24 h / 2 h / 60 d / 7 d', () => {
    expect(FABRICA_AJUSTES_AGENDA).toEqual({
      recordatorio_horas: 24, anticipacion_min_horas: 2, horizonte_dias: 60, vigencia_enlace_unico_dias: 7,
    })
    expect(AjustesAgendaSchema.safeParse(FABRICA_AJUSTES_AGENDA).success).toBe(true)
  })

  it('los límites son los de §2 (y los de los CHECK de la tabla)', () => {
    expect(LIMITES_AJUSTES_AGENDA).toEqual({
      recordatorio_horas: { min: 1, max: 72 },
      anticipacion_min_horas: { min: 0, max: 72 },
      horizonte_dias: { min: 1, max: 365 },
      vigencia_enlace_unico_dias: { min: 1, max: 30 },
    })
  })

  it.each([
    ['recordatorio_horas', 1, 72],
    ['anticipacion_min_horas', 0, 72],
    ['horizonte_dias', 1, 365],
    ['vigencia_enlace_unico_dias', 1, 30],
  ] as const)('%s acepta %i y %i, y rechaza uno menos y uno más', (campo, min, max) => {
    const con = (v: number) => AjustesAgendaSchema.safeParse({ ...FABRICA_AJUSTES_AGENDA, [campo]: v }).success
    expect(con(min)).toBe(true)
    expect(con(max)).toBe(true)
    expect(con(min - 1)).toBe(false)
    expect(con(max + 1)).toBe(false)
  })

  it('rechaza decimales y textos', () => {
    expect(AjustesAgendaSchema.safeParse({ ...FABRICA_AJUSTES_AGENDA, horizonte_dias: 1.5 }).success).toBe(false)
    expect(AjustesAgendaSchema.safeParse({ ...FABRICA_AJUSTES_AGENDA, horizonte_dias: '60' }).success).toBe(false)
  })

  it.each(['agenda_v2_encendida', 'candado_citas_activas', 'candado_reagendados', 'clinica_id'])(
    'rechaza la clave extra %s (el interruptor y el candado no se cambian por aquí)',
    (clave) => {
      expect(AjustesAgendaSchema.safeParse({ ...FABRICA_AJUSTES_AGENDA, [clave]: 1 }).success).toBe(false)
    },
  )

  it('rechaza un objeto al que le falta un ajuste', () => {
    const { horizonte_dias, ...incompleto } = FABRICA_AJUSTES_AGENDA
    expect(horizonte_dias).toBe(60)
    expect(AjustesAgendaSchema.safeParse(incompleto).success).toBe(false)
  })
})

describe('leerAjustesAgenda', () => {
  it('lee de agenda_ajustes por clínica, sin pedir el candado ni el interruptor', async () => {
    h.respuesta = { data: { recordatorio_horas: 12, anticipacion_min_horas: 0, horizonte_dias: 90, vigencia_enlace_unico_dias: 14 }, error: null }
    expect(await leerAjustesAgenda(await createClient(), CLINICA)).toEqual({
      recordatorio_horas: 12, anticipacion_min_horas: 0, horizonte_dias: 90, vigencia_enlace_unico_dias: 14,
    })
    expect(h.llamadas[0]).toEqual(['from', 'agenda_ajustes'])
    expect(h.llamadas).toContainEqual(['eq', 'clinica_id', CLINICA])
    const select = h.llamadas.find((l) => l[0] === 'select')?.[1]
    expect(select).not.toMatch(/candado|agenda_v2/)
  })

  it.each<[string, Respuesta | Error]>([
    ['sin fila', { data: null, error: null }],
    ['con error (p. ej. la tabla aún no existe)', { data: null, error: { message: 'relation does not exist' } }],
    ['si la promesa rechaza', new Error('red caída')],
    ['con una fila fuera de rango', { data: { recordatorio_horas: 0, anticipacion_min_horas: 2, horizonte_dias: 60, vigencia_enlace_unico_dias: 7 }, error: null }],
  ])('cae a la fábrica %s', async (_caso, respuesta) => {
    h.respuesta = respuesta
    expect(await leerAjustesAgenda(await createClient(), CLINICA)).toEqual(FABRICA_AJUSTES_AGENDA)
  })
})

describe('agendaV2Encendida (falla cerrado)', () => {
  it('true sólo cuando la fila dice true', async () => {
    h.respuesta = { data: { agenda_v2_encendida: true }, error: null }
    expect(await agendaV2Encendida(await createClient(), CLINICA)).toBe(true)
    expect(h.llamadas).toContainEqual(['eq', 'clinica_id', CLINICA])
  })

  it.each<[string, Respuesta | Error]>([
    ['la fila dice false', { data: { agenda_v2_encendida: false }, error: null }],
    ['no hay fila', { data: null, error: null }],
    ['hay error', { data: null, error: { message: 'relation "public.agenda_ajustes" does not exist' } }],
    ['la promesa rechaza', new Error('red caída')],
    ['el valor no es booleano', { data: { agenda_v2_encendida: 'true' }, error: null }],
  ])('apagado cuando %s', async (_caso, respuesta) => {
    h.respuesta = respuesta
    expect(await agendaV2Encendida(await createClient(), CLINICA)).toBe(false)
  })
})
