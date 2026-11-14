/**
 * C5 · La escritura SALIENTE a Google con la agenda v2 (mejora_agendaV2.md
 * §6-bis), contra un Google SIMULADO: `conCalendarioSpinus` es un doble con un
 * calendario guionado (`get`, `patch`, `insert`) y `after()` se recoge para
 * ejecutarlo a mano. Nada sale a la red ni toca una base.
 *
 * Fija:
 *   · POST: con v2, la marca privada (`extendedProperties.private`, nunca
 *     `shared`) y el `etag` guardado; apagado, el alta de siempre.
 *   · PUT: `get` + `patch` con `If-Match`; conflicto en los dos sentidos (gana
 *     Google: no se escribe y se audita; gana Spinus: estado completo y se
 *     audita); 412 con UN reintento; releer `updated_at` evita pisar al sondeo;
 *     S1 (filas nacidas en Google: la descripción sólo viaja si cambian las
 *     notas; ligadas a un paciente, formato fijo); apagado, como hoy.
 *   · `attended` (consultas): sólo `colorId`, sin `get` y sin reparar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Op = { tabla: string; verbo: 'select' | 'insert' | 'update'; filtros: Record<string, unknown>; valores?: Record<string, unknown> }
interface Llamada { metodo: 'get' | 'patch' | 'insert'; params: Record<string, unknown>; opciones?: unknown }

const h = vi.hoisted(() => ({
  ops: [] as Op[],
  google: [] as Llamada[],
  despues: [] as Array<() => Promise<void>>,
  interruptor: false,
  fila: null as Record<string, unknown> | null,
  /** Lo que devuelve el `update` de la ruta (la fila YA escrita). */
  escrita: null as Record<string, unknown> | null,
  /** Lo que devuelve la relectura de `updated_at` con el cliente de servicio. */
  vigente: null as string | null,
  /** Respuestas de `events.get`, en orden. */
  gets: [] as Array<Record<string, unknown>>,
  /** Fallos de `events.patch`, en orden (null = sale bien). */
  fallosPatch: [] as Array<number | null>,
  reparar: [] as boolean[],
  /** T3 · Lo que contestan las tres puertas del alta por RPC (convertir en cita). */
  puertas: true,
}))

class Consulta implements PromiseLike<unknown> {
  private op: Op
  constructor(tabla: string) { this.op = { tabla, verbo: 'select', filtros: {} } }
  select(): this { return this }
  insert(v: Record<string, unknown>): this { this.op.verbo = 'insert'; this.op.valores = v; return this }
  update(v: Record<string, unknown>): this { this.op.verbo = 'update'; this.op.valores = v; return this }
  eq(col: string, v: unknown): this { this.op.filtros[col] = v; return this }
  is(): this { return this }
  in(): this { return this }
  or(): this { return this }
  neq(): this { return this }
  lt(): this { return this }
  gt(): this { return this }
  limit(): this { return this }
  single(): Promise<unknown> { return this.resolver() }
  maybeSingle(): Promise<unknown> { return this.resolver() }
  then<A = unknown, B = never>(ok?: ((v: unknown) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.resolver().then(ok, ko)
  }
  private resolver(): Promise<unknown> {
    h.ops.push(this.op)
    const { tabla, verbo } = this.op
    if (tabla === 'profiles') {
      return Promise.resolve({ data: { id: 'u1', clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true } })
    }
    if (tabla === 'agenda_ajustes') return Promise.resolve({ data: { agenda_v2_encendida: h.interruptor }, error: null })
    if (tabla === 'pacientes') return Promise.resolve({ data: { id: 'p1' }, error: null })
    if (tabla === 'clinicas') return Promise.resolve({ data: { suscripcion_estado: 'activo', es_vip_grant: false }, error: null })
    if (tabla === 'admin:consultorios') {
      return Promise.resolve({ data: { id: 'c1', nombre: 'Centro', nombre_corto: null, direccion: null, telefono: null, timezone: 'America/Merida' }, error: null })
    }
    if (tabla === 'appointments' && verbo === 'select') return Promise.resolve({ data: h.fila, error: null })
    if (tabla === 'appointments' && (verbo === 'update' || verbo === 'insert')) return Promise.resolve({ data: h.escrita, error: null })
    if (tabla === 'admin:appointments' && verbo === 'select') {
      return Promise.resolve({ data: h.vigente === null ? null : { updated_at: h.vigente }, error: null })
    }
    if (tabla === 'admin:appointments' && verbo === 'update') return Promise.resolve({ data: [{ id: 'x' }], error: null })
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('next/server', async (original) => {
  const real = await original<typeof import('next/server')>()
  return { ...real, after: (fn: () => Promise<void>) => { h.despues.push(fn) } }
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (tabla: string) => new Consulta(tabla),
    rpc: async (nombre: string) => { h.ops.push({ tabla: `rpc:${nombre}`, verbo: 'select', filtros: {} }); return { data: h.puertas, error: null } },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (tabla: string) => new Consulta(`admin:${tabla}`) }) }))
vi.mock('@/lib/gcalConexion', () => ({
  resolverConexionClinica: async () => ({ id: 'conexion-1', clinicaId: 'clinica-1', userId: 'u1' }),
}))
vi.mock('@/lib/medicoCorreo', () => ({ correoDelMedico: async () => ({ ok: true, correo: 'medico@semilla.test' }) }))
vi.mock('@/lib/agenda/empalmesServidor', () => ({ comprobarEmpalmes: async () => ({ ok: true }) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => undefined) }))
vi.mock('@/lib/gcal', () => ({
  conCalendarioSpinus: async (
    _c: unknown, _a: unknown,
    operacion: (calendar: unknown, calendarId: string) => Promise<unknown>,
    opciones: { puedeReparar: boolean },
  ) => {
    h.reparar.push(opciones.puedeReparar)
    const calendar = {
      events: {
        get: async (params: Record<string, unknown>) => {
          h.google.push({ metodo: 'get', params })
          return { data: h.gets.shift() ?? { etag: '"e1"', attendees: [] } }
        },
        patch: async (params: Record<string, unknown>, opciones?: unknown) => {
          h.google.push({ metodo: 'patch', params, opciones })
          const falla = h.fallosPatch.shift()
          if (falla) throw Object.assign(new Error(`HTTP ${falla}`), { code: falla })
          return { data: { etag: '"nuevo"' } }
        },
        insert: async (params: Record<string, unknown>) => {
          h.google.push({ metodo: 'insert', params })
          return { data: { id: 'ev-creado', etag: '"creado"' } }
        },
      },
    }
    return operacion(calendar, 'cal-1')
  },
  registrarFalloGCal: vi.fn(),
}))

import { POST } from '@/app/api/appointments/route'
import { PUT } from '@/app/api/appointments/[id]/route'
import { logAudit } from '@/lib/audit'
import {
  camposEditados, descripcionV2, esPrecondicionFallida, googleEsMasReciente, prepararAtendidaEnGoogle,
} from '@/lib/gcalEscritura'

const ID = '11111111-1111-4111-8111-111111111111'
const CTX = { params: Promise.resolve({ id: ID }) }
const ANTES = '2026-11-11T10:00:00.000001+00:00'
const DESPUES = '2026-11-12T10:00:00.000002+00:00'

const CITA = {
  id: ID, google_event_id: 'ev-1', paciente_id: 'p1', gcal_sync_status: 'synced', updated_at: ANTES, gcal_etag: '"e1"',
  medico_id: 'u1', status: 'scheduled', start_time: '2026-11-18T16:00:00+00:00', end_time: '2026-11-18T16:30:00+00:00',
  consultorio_timezone: 'America/Merida', all_day: false, title: 'Paciente Prueba', notes: 'OBSERVACION-PRIVADA', origen: 'spinus',
  pacientes: { id: 'p1', nombre: 'Paciente', apellidos: 'Prueba' }, clinicas: { nombre: 'Clínica Semilla A' },
}
const DE_GOOGLE = { ...CITA, paciente_id: null, pacientes: null, title: 'Junta', notes: 'texto de Google', origen: 'google' }

async function correrDespues(): Promise<void> {
  for (const fn of h.despues) await fn()
}
function editar(cuerpo: Record<string, unknown>): Promise<Response> {
  return PUT(new NextRequest(`http://localhost/api/appointments/${ID}`, {
    method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' },
  }), CTX)
}
function crear(): Promise<Response> {
  return POST(new NextRequest('http://localhost/api/appointments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Junta', start_time: '2026-11-18T16:00:00.000Z', end_time: '2026-11-18T16:30:00.000Z',
      medico_id: 'u1', consultorio_id: '33333333-3333-4333-8333-333333333333', client_id: '22222222-2222-4222-8222-222222222222',
    }),
  }))
}
const metodos = (): string[] => h.google.map((l) => l.metodo)
const parches = (): Llamada[] => h.google.filter((l) => l.metodo === 'patch')
const cuerpo = (l: Llamada): Record<string, unknown> => l.params.requestBody as Record<string, unknown>
const guardados = (): Array<Record<string, unknown>> =>
  h.ops.filter((o) => o.tabla === 'admin:appointments' && o.verbo === 'update').map((o) => o.valores ?? {})

beforeEach(() => {
  Object.assign(h, {
    ops: [], google: [], despues: [], interruptor: false, fila: CITA, vigente: null, gets: [], fallosPatch: [], reparar: [], puertas: true,
    escrita: { ...CITA, status: 'confirmed', updated_at: DESPUES },
  })
  vi.mocked(logAudit).mockClear()
})

describe('POST /api/appointments — C5', () => {
  it('v2: el insert lleva la marca privada y se guarda el etag', async () => {
    h.interruptor = true
    h.escrita = { ...CITA, id: ID, origen: 'spinus' }
    const res = await crear()
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200)
    await correrDespues()
    const [alta] = h.google
    expect(alta.metodo).toBe('insert')
    expect(cuerpo(alta).extendedProperties).toEqual({ private: { spinus_cita: ID, spinus_v: '2' } })
    expect(guardados()).toEqual([expect.objectContaining({ google_event_id: 'ev-creado', gcal_etag: '"creado"' })])
  })

  it('apagado: el alta de siempre, sin marca y sin nombrar gcal_etag', async () => {
    h.escrita = { ...CITA, id: ID }
    await crear()
    await correrDespues()
    expect(cuerpo(h.google[0])).not.toHaveProperty('extendedProperties')
    expect(guardados()[0]).not.toHaveProperty('gcal_etag')
  })
})

describe('PUT /api/appointments/[id] — C5 con v2', () => {
  beforeEach(() => { h.interruptor = true })

  it('sin conflicto: get + patch con If-Match y marca; guarda el etag nuevo; sin auditar', async () => {
    h.gets = [{ etag: '"e1"', attendees: [] }]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch'])
    expect(parches()[0].opciones).toEqual({ headers: { 'If-Match': '"e1"' } })
    expect(cuerpo(parches()[0])).toMatchObject({ colorId: '2', extendedProperties: { private: { spinus_cita: ID, spinus_v: '2' } } })
    expect(cuerpo(parches()[0])).not.toHaveProperty('status')
    expect(String(cuerpo(parches()[0]).description)).not.toContain('OBSERVACION-PRIVADA')
    expect(guardados()).toEqual([expect.objectContaining({ gcal_sync_status: 'synced', gcal_etag: '"nuevo"' })])
    expect(vi.mocked(logAudit)).not.toHaveBeenCalled()
  })

  it('gana Google (etag distinto y más reciente): no hay patch, no se toca la fila y se audita', async () => {
    h.gets = [{ etag: '"e9"', updated: '2026-11-13T00:00:00Z', attendees: [] }]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get'])
    expect(guardados()).toEqual([])
    const desc = JSON.parse(vi.mocked(logAudit).mock.calls[0][0].descripcion ?? '{}')
    expect(desc).toEqual({ clinica: 'clinica-1', gana: 'google', motivo: 'mas_reciente', campos: ['estado'], via: 'edicion' })
  })

  it('gana Spinus (etag distinto, Google más viejo): estado COMPLETO, confirmed, y se audita sin valores', async () => {
    h.gets = [{ etag: '"e9"', updated: '2026-11-11T11:00:00Z', attendees: [] }]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch'])
    expect(cuerpo(parches()[0])).toMatchObject({
      status: 'confirmed', start: { dateTime: CITA.start_time }, end: { dateTime: CITA.end_time },
    })
    expect(parches()[0].opciones).toEqual({ headers: { 'If-Match': '"e9"' } })
    const desc = JSON.parse(vi.mocked(logAudit).mock.calls[0][0].descripcion ?? '{}')
    expect(desc).toMatchObject({ gana: 'spinus', campos: ['estado'], via: 'edicion' })
    expect(JSON.stringify(desc)).not.toContain('Paciente')
  })

  it('empate exacto de fechas: gana Spinus', () => {
    expect(googleEsMasReciente('2026-11-12T10:00:00Z', '2026-11-12T10:00:00+00:00')).toBe(false)
    expect(googleEsMasReciente('2026-11-12T10:00:01Z', '2026-11-12T10:00:00+00:00')).toBe(true)
    expect(googleEsMasReciente(null, '2026-11-12T10:00:00+00:00')).toBe(false)
  })

  it('412: repite get y decisión UNA vez', async () => {
    h.fallosPatch = [412, null]
    h.gets = [{ etag: '"e1"' }, { etag: '"e1"' }]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch', 'get', 'patch'])
    expect(guardados()[0]).toMatchObject({ gcal_sync_status: 'synced', gcal_etag: '"nuevo"' })
  })

  it('dos 412 seguidos: no hay tercer intento y la fila queda failed', async () => {
    h.fallosPatch = [412, 412, null]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch', 'get', 'patch'])
    expect(guardados()[0]).toMatchObject({ gcal_sync_status: 'failed' })
    expect(guardados()[0]).not.toHaveProperty('gcal_etag')
  })

  it('releer updated_at: si otro escritor pasó (el sondeo), no se llama a Google', async () => {
    h.vigente = '2026-11-12T10:00:05.000000+00:00'
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual([])
    expect(guardados()).toEqual([])
  })

  it('releer updated_at igual al escrito: sigue', async () => {
    h.vigente = DESPUES
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch'])
  })

  it('S1 · fila de Google sin paciente: la descripción viaja SÓLO si cambian las notas', async () => {
    h.fila = DE_GOOGLE
    h.escrita = { ...DE_GOOGLE, notes: 'nota nueva', updated_at: DESPUES }
    await editar({ notes: 'nota nueva' })
    await correrDespues()
    expect(cuerpo(parches()[0]).description).toBe('nota nueva')

    Object.assign(h, { google: [], despues: [], ops: [] })
    h.escrita = { ...DE_GOOGLE, title: 'Junta 2', updated_at: DESPUES }
    await editar({ title: 'Junta 2', notes: 'texto de Google' })
    await correrDespues()
    expect(cuerpo(parches()[0])).not.toHaveProperty('description')
    expect(cuerpo(parches()[0]).summary).toBe('Junta 2')
  })

  it('S1 · fila de Google ligada a un paciente: formato fijo, sin sus notas', async () => {
    h.fila = DE_GOOGLE
    h.escrita = { ...DE_GOOGLE, paciente_id: 'p1', pacientes: CITA.pacientes, notes: 'texto de Google', updated_at: DESPUES }
    // T3 · convertir en cita (AG-DT-29): el alta pide consultorio y pasa las puertas.
    await editar({ paciente_id: 'p1', consultorio_id: '33333333-3333-4333-8333-333333333333' })
    await correrDespues()
    const d = String(cuerpo(parches()[0]).description)
    expect(d).toContain('Paciente Prueba')
    expect(d).not.toContain('texto de Google')
    expect(String(cuerpo(parches()[0]).summary)).toBe('Cita médica: Paciente Prueba')
  })

  /* T3 · MUTACIÓN: quitar `vetoDeConversion` del PUT → la fila se escribe. */
  it('convertir con la clínica sin acceso: 403, sin escribir ni tocar Google', async () => {
    h.fila = DE_GOOGLE
    h.puertas = false
    const res = await editar({ paciente_id: 'p1', consultorio_id: '33333333-3333-4333-8333-333333333333' })
    expect(res.status).toBe(403)
    expect(h.ops.filter(o => o.tabla.startsWith('rpc:')).map(o => o.tabla).sort())
      .toEqual(['rpc:clinica_no_suspendida', 'rpc:clinica_tiene_acceso', 'rpc:perfil_completo'])
    expect(h.ops.some(o => o.tabla === 'appointments' && o.verbo === 'update')).toBe(false)
    await correrDespues()
    expect(h.google).toEqual([])
  })

  it('fila sin etag guardado (de antes de v2): no hay conflicto posible, parchea', async () => {
    h.fila = { ...CITA, gcal_etag: null }
    h.gets = [{ etag: '"e9"', updated: '2027-01-01T00:00:00Z' }]
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch'])
    expect(vi.mocked(logAudit)).not.toHaveBeenCalled()
  })

  it('reparación de una cita sin evento: insert con marca y etag guardado', async () => {
    h.fila = { ...CITA, google_event_id: null }
    h.escrita = { ...CITA, google_event_id: null, updated_at: DESPUES }
    await editar({ status: 'confirmed' })
    await correrDespues()
    const [alta] = h.google
    expect(alta.metodo).toBe('insert')
    expect(cuerpo(alta).extendedProperties).toEqual({ private: { spinus_cita: ID, spinus_v: '2' } })
    expect(guardados()[0]).toMatchObject({ google_event_id: 'ev-creado', gcal_etag: '"creado"' })
  })
})

describe('PUT /api/appointments/[id] — apagado, como hoy', () => {
  it('patch sin If-Match, sin marca, sin releer y sin nombrar gcal_etag', async () => {
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(metodos()).toEqual(['get', 'patch'])
    expect(parches()[0].opciones).toBeUndefined()
    expect(cuerpo(parches()[0])).not.toHaveProperty('extendedProperties')
    expect(h.ops.some((o) => o.tabla === 'admin:appointments' && o.verbo === 'select')).toBe(false)
    expect(guardados()[0]).toEqual({ gcal_sync_status: 'synced', gcal_calendar_id: 'cal-1' })
  })

  it('reparación apagada: sin marca y sin gcal_etag', async () => {
    h.fila = { ...CITA, google_event_id: null }
    await editar({ status: 'confirmed' })
    await correrDespues()
    expect(cuerpo(h.google[0])).not.toHaveProperty('extendedProperties')
    expect(guardados()[0]).not.toHaveProperty('gcal_etag')
  })
})

describe('attended (POST /api/consultas) — prepararAtendidaEnGoogle', () => {
  const sesion = { from: (t: string) => new Consulta(t) } as unknown as Parameters<typeof prepararAtendidaEnGoogle>[0]

  it('apagado: no programa nada', async () => {
    h.interruptor = false
    expect(await prepararAtendidaEnGoogle(sesion, { clinicaId: 'clinica-1', eventId: 'ev-1', userId: 'u1' })).toBeNull()
  })

  it('v2: patch SÓLO con colorId 8, sin get, sin reparar y sin guardar etag', async () => {
    h.interruptor = true
    const tarea = await prepararAtendidaEnGoogle(sesion, { clinicaId: 'clinica-1', eventId: 'ev-1', userId: 'u1' })
    expect(tarea).not.toBeNull()
    await tarea?.()
    expect(metodos()).toEqual(['patch'])
    expect(h.google[0].params).toEqual({ calendarId: 'cal-1', eventId: 'ev-1', sendUpdates: 'none', requestBody: { colorId: '8' } })
    expect(h.reparar).toEqual([false])
    expect(guardados()).toEqual([])
  })
})

describe('gcalEscritura — piezas', () => {
  it('412 en sus tres formas', () => {
    expect(esPrecondicionFallida({ code: 412 })).toBe(true)
    expect(esPrecondicionFallida({ status: 412 })).toBe(true)
    expect(esPrecondicionFallida({ response: { status: 412 } })).toBe(true)
    expect(esPrecondicionFallida({ code: 409 })).toBe(false)
  })

  it('camposEditados: nombres, horas por instante', () => {
    const base = { start_time: '2026-11-18T16:00:00+00:00', end_time: '2026-11-18T16:30:00+00:00', all_day: false, title: 'a', notes: null, status: 'scheduled', paciente_id: null, medico_id: 'm' }
    expect(camposEditados(base, { ...base, start_time: '2026-11-18T16:00:00.000Z' })).toEqual([])
    expect(camposEditados(base, { ...base, end_time: '2026-11-18T17:00:00Z', notes: 'x', medico_id: 'n' })).toEqual(['hora', 'notas', 'medico'])
  })

  it('descripcionV2: S1', () => {
    expect(descripcionV2({ origen: 'spinus', paciente_id: null, notes: 'n' }, 'FIJA', true)).toBe('FIJA')
    expect(descripcionV2({ origen: 'google', paciente_id: 'p', notes: 'n' }, 'FIJA', true)).toBe('FIJA')
    expect(descripcionV2({ origen: 'google', paciente_id: null, notes: 'n' }, 'FIJA', true)).toBe('n')
    expect(descripcionV2({ origen: 'google', paciente_id: null, notes: 'n' }, 'FIJA', false)).toBeUndefined()
  })
})
