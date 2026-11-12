/**
 * B3 · Cancelar en vez de borrar (plan del bloque B), contra un Google SIMULADO.
 *
 * Fija, en la ruta `DELETE /api/appointments/[id]` y en el `PUT` de la
 * cancelación, lo que el navegador no puede ver porque la base local no tiene
 * ninguna clínica conectada a Google:
 *
 *   · interruptor ENCENDIDO + cita con paciente → 409 `cita_con_paciente`, sin
 *     borrar la fila y SIN programar el `events.delete` del `after()`;
 *   · interruptor encendido + evento sin paciente → se borra como siempre, y
 *     Google recibe su `events.delete`;
 *   · interruptor APAGADO (o tabla ausente: el lector falla cerrado) + cita con
 *     paciente → la baja de siempre, con su `events.delete`;
 *   · la cancelación (`PUT {status:'cancelled'}`) parchea el evento con el
 *     prefijo «CANCELADA — », color 11 y `sendUpdates:'all'` (P4), y la
 *     descripción NO lleva las observaciones de la cita (S1);
 *   · con el interruptor encendido, el PUT no deja una cita sin paciente.
 *
 * Nada aquí habla con Google ni con ninguna base: `conCalendarioSpinus` es un
 * doble que apunta cada llamada, y `after()` se recoge para ejecutarlo a mano.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Op = { tabla: string; verbo: 'select' | 'delete' | 'update'; filtros: Record<string, unknown> }
interface Estado {
  ops: Op[]
  google: string[]
  parches: Record<string, unknown>[]
  despues: Array<() => Promise<void>>
  /** `null` = la tabla `agenda_ajustes` no existe (error de PostgREST). */
  interruptor: boolean | null
  fila: Record<string, unknown> | null
}

const h = vi.hoisted(() => {
  const estado: Estado = { ops: [], google: [], parches: [], despues: [], interruptor: false, fila: null }
  return { estado }
})

/* Un builder perezoso de PostgREST: encadena, y al resolver contesta según la
   tabla y el verbo. Apunta cada operación con sus filtros `eq`. */
class Consulta implements PromiseLike<unknown> {
  private op: Op
  constructor(tabla: string) {
    this.op = { tabla, verbo: 'select', filtros: {} }
  }
  select(): this { return this }
  delete(): this { this.op.verbo = 'delete'; return this }
  update(): this { this.op.verbo = 'update'; return this }
  eq(col: string, v: unknown): this { this.op.filtros[col] = v; return this }
  is(): this { return this }
  single(): Promise<unknown> { return this.resolver() }
  maybeSingle(): Promise<unknown> { return this.resolver() }
  then<A = unknown, B = never>(
    ok?: ((v: unknown) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.resolver().then(ok, ko)
  }
  private resolver(): Promise<unknown> {
    h.estado.ops.push(this.op)
    const { tabla, verbo } = this.op
    if (tabla === 'profiles') {
      return Promise.resolve({ data: { id: 'u1', clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true } })
    }
    if (tabla === 'agenda_ajustes') {
      if (h.estado.interruptor === null) return Promise.resolve({ data: null, error: { message: 'relation does not exist' } })
      return Promise.resolve({ data: { agenda_v2_encendida: h.estado.interruptor }, error: null })
    }
    if (tabla === 'appointments' && verbo === 'select') return Promise.resolve({ data: h.estado.fila, error: null })
    if (tabla === 'appointments' && verbo === 'delete') return Promise.resolve({ error: null })
    if (tabla === 'appointments' && verbo === 'update') {
      return Promise.resolve({ data: { ...h.estado.fila, status: 'cancelled' }, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('next/server', async (original) => {
  const real = await original<typeof import('next/server')>()
  return { ...real, after: (fn: () => Promise<void>) => { h.estado.despues.push(fn) } }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (tabla: string) => new Consulta(tabla),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (tabla: string) => new Consulta(`admin:${tabla}`) }),
}))

vi.mock('@/lib/gcalConexion', () => ({
  resolverConexionClinica: async () => ({ id: 'conexion-1', clinicaId: 'clinica-1', userId: 'u1' }),
}))

vi.mock('@/lib/medicoCorreo', () => ({
  correoDelMedico: async () => ({ ok: true, correo: 'medico@semilla.test' }),
}))

vi.mock('@/lib/gcal', () => ({
  conCalendarioSpinus: async (
    _conexion: unknown,
    _admin: unknown,
    operacion: (calendar: unknown, calendarId: string) => Promise<unknown>,
  ) => {
    const calendar = {
      events: {
        delete: async () => { h.estado.google.push('events.delete'); return {} },
        get: async () => { h.estado.google.push('events.get'); return { data: { attendees: [] } } },
        patch: async (p: { requestBody: Record<string, unknown>; sendUpdates: string }) => {
          h.estado.google.push('events.patch')
          h.estado.parches.push({ ...p.requestBody, sendUpdates: p.sendUpdates })
          return { data: {} }
        },
      },
    }
    return operacion(calendar, 'cal-1')
  },
  registrarFalloGCal: vi.fn(),
}))

import { DELETE, PUT } from '@/app/api/appointments/[id]/route'

const ID = '11111111-1111-4111-8111-111111111111'
const CTX = { params: Promise.resolve({ id: ID }) }

const CITA = {
  id: ID, google_event_id: 'ev-1', paciente_id: 'p1', gcal_sync_status: 'synced', updated_at: '2026-11-11T10:00:00Z',
  medico_id: 'u1', status: 'scheduled', start_time: '2026-11-18T16:00:00Z', end_time: '2026-11-18T16:30:00Z',
  consultorio_timezone: 'America/Merida', all_day: false, title: 'Paciente Prueba', notes: 'OBSERVACION-PRIVADA',
  pacientes: { id: 'p1', nombre: 'Paciente', apellidos: 'Prueba' }, clinicas: { nombre: 'Clínica Semilla A' },
}
const EVENTO = { ...CITA, paciente_id: null, pacientes: null, title: 'Junta' }

async function correrDespues(): Promise<void> {
  for (const fn of h.estado.despues) await fn()
}
const borrados = (): Op[] => h.estado.ops.filter(o => o.tabla === 'appointments' && o.verbo === 'delete')

function borrar(): Promise<Response> {
  return DELETE(new NextRequest(`http://localhost/api/appointments/${ID}`, { method: 'DELETE' }), CTX)
}
function editar(cuerpo: Record<string, unknown>): Promise<Response> {
  return PUT(new NextRequest(`http://localhost/api/appointments/${ID}`, {
    method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' },
  }), CTX)
}

beforeEach(() => {
  h.estado.ops = []
  h.estado.google = []
  h.estado.parches = []
  h.estado.despues = []
  h.estado.interruptor = false
  h.estado.fila = CITA
})

describe('DELETE /api/appointments/[id] — B3', () => {
  it('encendido + cita con paciente: 409, sin borrar y sin tocar Google', async () => {
    h.estado.interruptor = true
    const res = await borrar()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'cita_con_paciente' })
    expect(borrados()).toHaveLength(0)
    expect(h.estado.despues).toHaveLength(0)
    expect(h.estado.google).toEqual([])
  })

  it('encendido + cita con paciente YA CANCELADA: tampoco se borra', async () => {
    h.estado.interruptor = true
    h.estado.fila = { ...CITA, status: 'cancelled' }
    expect((await borrar()).status).toBe(409)
    expect(borrados()).toHaveLength(0)
  })

  it('encendido + evento sin paciente: se borra como siempre y Google recibe events.delete', async () => {
    h.estado.interruptor = true
    h.estado.fila = EVENTO
    const res = await borrar()
    expect(res.status).toBe(200)
    expect(borrados()).toEqual([{ tabla: 'appointments', verbo: 'delete', filtros: { id: ID, clinica_id: 'clinica-1' } }])
    await correrDespues()
    expect(h.estado.google).toEqual(['events.delete'])
  })

  it('apagado + cita con paciente: la baja de siempre', async () => {
    const res = await borrar()
    expect(res.status).toBe(200)
    expect(borrados()).toHaveLength(1)
    await correrDespues()
    expect(h.estado.google).toEqual(['events.delete'])
  })

  it('tabla agenda_ajustes ausente: cuenta como apagado, sin error', async () => {
    h.estado.interruptor = null
    const res = await borrar()
    expect(res.status).toBe(200)
    expect(borrados()).toHaveLength(1)
  })
})

describe('PUT /api/appointments/[id] — la cancelación en Google (P4, S1)', () => {
  it('status cancelled: patch con «CANCELADA — », color 11, aviso a todos y sin observaciones', async () => {
    h.estado.interruptor = true
    const res = await editar({ status: 'cancelled', client_id: '22222222-2222-4222-8222-222222222222' })
    expect(res.status).toBe(200)
    await correrDespues()
    expect(h.estado.google).toEqual(['events.get', 'events.patch'])
    expect(h.estado.google).not.toContain('events.delete')
    const [parche] = h.estado.parches
    expect(String(parche.summary).startsWith('CANCELADA — ')).toBe(true)
    expect(parche.colorId).toBe('11')
    expect(parche.sendUpdates).toBe('all')
    expect(String(parche.description)).not.toContain('OBSERVACION-PRIVADA')
  })

  it('encendido: una cita con paciente no se queda sin paciente (409)', async () => {
    h.estado.interruptor = true
    const res = await editar({ paciente_id: null })
    expect(res.status).toBe(409)
    expect(h.estado.ops.some(o => o.tabla === 'appointments' && o.verbo === 'update')).toBe(false)
  })

  it('apagado: desligar al paciente sigue como hoy (no lo frena B3)', async () => {
    const res = await editar({ paciente_id: null })
    expect(res.status).not.toBe(409)
  })
})
