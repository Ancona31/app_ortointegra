/**
 * horarioClinica.test.ts — P8 (`mejora_agendaV2.md` §6-bis), sin base:
 * `PUT /api/me/horario` responde 400 con fin ≤ inicio en un día activo o con
 * un cuerpo mal formado, sin escribir ni auditar; la escritura conserva el
 * filtro por clínica del cliente de servicio y deja el `logAudit` del hecho,
 * sin valores; y no pierde la validación de rol.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Op = { cliente: 'sesion' | 'admin'; tabla: string; verbo: 'select' | 'update'; valores: unknown; filtros: Record<string, unknown> }
interface Perfil { clinica_id: string | null; role: string; es_admin_de_clinica: boolean }

const h = vi.hoisted(() => ({
  ops: [] as Op[],
  auditorias: [] as Record<string, unknown>[],
  perfil: { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true } as Perfil,
  errorUpdate: null as { code: string; message: string } | null,
}))

class Consulta implements PromiseLike<unknown> {
  private op: Op
  constructor(cliente: Op['cliente'], tabla: string) {
    this.op = { cliente, tabla, verbo: 'select', valores: null, filtros: {} }
  }
  select(): this { return this }
  update(v: unknown): this { this.op.verbo = 'update'; this.op.valores = v; return this }
  eq(col: string, v: unknown): this { this.op.filtros[col] = v; return this }
  single(): Promise<unknown> { return this.resolver() }
  maybeSingle(): Promise<unknown> { return this.resolver() }
  then<A = unknown, B = never>(
    ok?: ((v: unknown) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.resolver().then(ok, ko)
  }
  private resolver(): Promise<unknown> {
    h.ops.push(this.op)
    const { tabla, verbo, valores } = this.op
    if (tabla === 'profiles') return Promise.resolve({ data: h.perfil, error: null })
    if (verbo === 'update') return Promise.resolve(h.errorUpdate ? { data: null, error: h.errorUpdate } : { data: valores, error: null })
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (tabla: string) => new Consulta('sesion', tabla),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (tabla: string) => new Consulta('admin', tabla) }),
}))
vi.mock('@/lib/audit', () => ({
  logAudit: async (p: Record<string, unknown>) => { h.auditorias.push(p) },
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))

const { PUT: putHorario } = await import('@/app/api/me/horario/route')
const { HORARIO_DEFAULT } = await import('@/lib/agenda/horarioAgenda')

const peticion = (url: string, cuerpo: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } })
const escrituras = () => h.ops.filter(o => o.verbo === 'update')

beforeEach(() => {
  h.ops = []
  h.auditorias = []
  h.perfil = { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true }
  h.errorUpdate = null
})

describe('PUT /api/me/horario (P8)', () => {
  it('guarda con el filtro de clínica y audita el hecho, sin valores', async () => {
    const res = await putHorario(peticion('/api/me/horario', { horario: HORARIO_DEFAULT }))
    expect(res.status).toBe(200)
    expect(escrituras()).toEqual([{ cliente: 'admin', tabla: 'clinicas', verbo: 'update', valores: { horario_consulta: HORARIO_DEFAULT }, filtros: { id: 'clinica-1' } }])
    expect(h.auditorias).toEqual([{ userId: 'u1', accion: 'horario_clinica_editado', tabla: 'clinicas', registroId: 'clinica-1' }])
  })

  it('400 con el cierre igual o antes que la apertura en un día activo; no escribe ni audita', async () => {
    const horario = { ...HORARIO_DEFAULT, martes: { activo: true, inicio: '18:00', fin: '09:00' } }
    const res = await putHorario(peticion('/api/me/horario', { horario }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Martes: la hora de cierre tiene que ir después de la de apertura' })
    expect(escrituras()).toHaveLength(0)
    expect(h.auditorias).toHaveLength(0)
  })

  it.each([
    ['sin horario', {}],
    ['con una clave de más', { horario: HORARIO_DEFAULT, clinica_id: 'otra' }],
    ['con una hora mal escrita', { horario: { ...HORARIO_DEFAULT, lunes: { activo: true, inicio: '9', fin: '19:00' } } }],
  ])('400 %s', async (_caso, cuerpo) => {
    expect((await putHorario(peticion('/api/me/horario', cuerpo))).status).toBe(400)
    expect(escrituras()).toHaveLength(0)
  })

  it('sigue respondiendo 403 a quien no administra', async () => {
    h.perfil = { clinica_id: 'clinica-1', role: 'secretaria', es_admin_de_clinica: false }
    expect((await putHorario(peticion('/api/me/horario', { horario: HORARIO_DEFAULT }))).status).toBe(403)
    expect(escrituras()).toHaveLength(0)
  })
})
