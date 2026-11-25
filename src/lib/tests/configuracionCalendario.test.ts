/**
 * configuracionCalendario.test.ts — la pantalla de configuración del
 * calendario (plan del bloque B, paso B4), sin base:
 *
 *   · `PUT /api/me/ajustes-agenda`: 403 a quien no administra, 404 con el
 *     interruptor apagado, 400 fuera de rango o con una clave de más
 *     (`agenda_v2_encendida`, `candado_*`) SIN llegar a escribir, y la
 *     escritura con el cliente de SESIÓN, sólo los cuatro ajustes y
 *     `clinica_id` explícito;
 *   · `ajustesDesdeFormulario` y `leerMotivoError`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Op = { cliente: 'sesion' | 'admin'; tabla: string; verbo: 'select' | 'update'; valores: unknown; filtros: Record<string, unknown> }
interface Perfil { clinica_id: string | null; role: string; es_admin_de_clinica: boolean }

const h = vi.hoisted(() => ({
  ops: [] as Op[],
  perfil: { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true } as Perfil,
  interruptor: true,
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
    if (tabla === 'agenda_ajustes') return Promise.resolve({ data: { agenda_v2_encendida: h.interruptor }, error: null })
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
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))

const { PUT: putAjustes } = await import('@/app/api/me/ajustes-agenda/route')
const { FABRICA_AJUSTES_AGENDA, ajustesDesdeFormulario } = await import('@/lib/agenda/ajustesAgenda')
const { leerMotivoError } = await import('@/components/agenda/configuracion/leerMotivoError')

const peticion = (url: string, cuerpo: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } })
const escrituras = () => h.ops.filter(o => o.verbo === 'update')

beforeEach(() => {
  h.ops = []
  h.perfil = { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true }
  h.interruptor = true
  h.errorUpdate = null
})

describe('PUT /api/me/ajustes-agenda', () => {
  const AJUSTES = { recordatorio_horas: 12, anticipacion_min_horas: 0, horizonte_dias: 90, vigencia_enlace_unico_dias: 14 }

  it('guarda los cuatro ajustes con el cliente de sesión y la clínica del perfil', async () => {
    const res = await putAjustes(peticion('/api/me/ajustes-agenda', AJUSTES))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ajustes: AJUSTES })
    expect(escrituras()).toEqual([{ cliente: 'sesion', tabla: 'agenda_ajustes', verbo: 'update', valores: AJUSTES, filtros: { clinica_id: 'clinica-1' } }])
    expect(h.ops.some(o => o.cliente === 'admin')).toBe(false)
  })

  it.each<[string, Perfil]>([
    ['la secretaria', { clinica_id: 'clinica-1', role: 'secretaria', es_admin_de_clinica: false }],
    ['el médico invitado', { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: false }],
    ['un perfil sin clínica', { clinica_id: null, role: 'medico', es_admin_de_clinica: true }],
  ])('403 para %s, sin escribir', async (_quien, perfil) => {
    h.perfil = perfil
    expect((await putAjustes(peticion('/api/me/ajustes-agenda', AJUSTES))).status).toBe(403)
    expect(escrituras()).toHaveLength(0)
  })

  it('404 con el interruptor apagado, sin escribir', async () => {
    h.interruptor = false
    expect((await putAjustes(peticion('/api/me/ajustes-agenda', AJUSTES))).status).toBe(404)
    expect(escrituras()).toHaveLength(0)
  })

  it.each([
    ['un ajuste fuera de rango', { ...AJUSTES, recordatorio_horas: 73 }],
    ['el interruptor', { ...AJUSTES, agenda_v2_encendida: true }],
    ['el candado', { ...AJUSTES, candado_citas_activas: 5 }],
    ['la clínica', { ...AJUSTES, clinica_id: 'otra' }],
    ['un ajuste de menos', { recordatorio_horas: 12 }],
  ])('400 con %s, sin escribir', async (_caso, cuerpo) => {
    const res = await putAjustes(peticion('/api/me/ajustes-agenda', cuerpo))
    expect(res.status).toBe(400)
    expect(escrituras()).toHaveLength(0)
  })

  it('el 400 de rango dice qué ajuste y sus límites', async () => {
    const res = await putAjustes(peticion('/api/me/ajustes-agenda', { ...AJUSTES, recordatorio_horas: 0 }))
    expect(await res.json()).toEqual({ error: 'Recordatorio por correo: de 1 a 72 horas antes de la cita' })
  })

  it.each([['42501', 403], ['23514', 400], ['XX000', 500]])('traduce el error %s de la base a %i', async (code, status) => {
    h.errorUpdate = { code, message: 'mensaje crudo de la base' }
    const res = await putAjustes(peticion('/api/me/ajustes-agenda', AJUSTES))
    expect(res.status).toBe(status)
    expect(JSON.stringify(await res.json())).not.toContain('mensaje crudo')
  })
})

describe('ajustesDesdeFormulario', () => {
  const texto = { recordatorio_horas: '24', anticipacion_min_horas: '0', horizonte_dias: '60', vigencia_enlace_unico_dias: '7' }

  it('convierte el formulario a los cuatro ajustes', () => {
    expect(ajustesDesdeFormulario(texto)).toEqual({ ok: true, ajustes: { ...FABRICA_AJUSTES_AGENDA, anticipacion_min_horas: 0 } })
  })

  it('un campo vacío es un error, no un 0', () => {
    expect(ajustesDesdeFormulario({ ...texto, anticipacion_min_horas: ' ' }))
      .toEqual({ ok: false, error: 'Anticipación mínima para reservar por enlace: escribe un número' })
  })

  it('fuera de rango o con decimales, el mismo mensaje que el servidor', () => {
    expect(ajustesDesdeFormulario({ ...texto, vigencia_enlace_unico_dias: '31' }))
      .toEqual({ ok: false, error: 'Vigencia del enlace de un solo uso: de 1 a 30 días' })
    expect(ajustesDesdeFormulario({ ...texto, horizonte_dias: '1.5' }))
      .toEqual({ ok: false, error: 'Hasta cuándo se puede reservar: tiene que ser un número entero' })
  })
})

describe('leerMotivoError', () => {
  const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status })

  it('prefiere `mensaje`', async () => {
    expect(await leerMotivoError(respuesta(409, { error: 'nombre_repetido', mensaje: 'Ya hay uno' }), 'x')).toBe('Ya hay uno')
  })
  it('usa `error` sólo en 400 y 409', async () => {
    expect(await leerMotivoError(respuesta(400, { error: 'Fuera de rango' }), 'x')).toBe('Fuera de rango')
    expect(await leerMotivoError(respuesta(404, { error: 'no_disponible' }), 'x')).toBe('x')
    expect(await leerMotivoError(respuesta(403, { error: 'Sin permisos' }), 'x')).toBe('x')
  })
  it('cae al mensaje por defecto sin cuerpo legible', async () => {
    expect(await leerMotivoError(new Response('<html>', { status: 500 }), 'por defecto')).toBe('por defecto')
  })
})
