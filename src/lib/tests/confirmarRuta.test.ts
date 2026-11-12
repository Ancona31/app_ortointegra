/**
 * E3 · `POST /api/confirmar/[codigo]`, la respuesta del paciente por el enlace.
 * Fija: sólo hay POST (un GET da 405); el origen ajeno o un código sin forma no
 * llegan a la base; cada resultado sale como 303 (nunca 307) a la página con
 * su `?r=`; Google sólo con confirmada/cancelada y evento; el límite da
 * `?r=limite` sin responder; `invalido` o una RPC ausente, 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ContextoConfirmacion, RespuestaConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'

const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const CTX: ContextoConfirmacion = {
  clinica_id: '00000000-0000-4000-8000-000000000001', estado: 'agendada',
  inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T16:30:00.000Z', zona: 'America/Merida',
  medico: { titulo: 'Dr.', nombres: 'Uno', apellido_paterno: 'Dos', apellido_materno: null },
  consultorio: { nombre: 'Centro', direccion: null, telefono: '9991234567' },
  puede_confirmar: true, puede_cancelar: true, corte_cancelar: '2031-05-06T15:00:00.000Z', respuesta: null,
  codigo_hash: 'a'.repeat(64),
}

const h = vi.hoisted(() => ({
  orden: [] as string[],
  ctx: null as unknown,
  resp: null as unknown,
  limite: true,
  despues: [] as (() => unknown)[],
  google: [] as unknown[],
  limites: [] as unknown[],
}))

vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (f: () => unknown) => { h.despues.push(f) },
}))
vi.mock('@/lib/confirmacion/enlaceConfirmacion', () => ({
  resolverEnlaceConfirmacion: async () => { h.orden.push('contexto'); return h.ctx },
  responderEnlaceConfirmacion: async (_c: unknown, accion: string) => { h.orden.push(`responder:${accion}`); return h.resp },
}))
vi.mock('@/lib/reserva/limitesReserva', () => ({
  ipDe: () => '203.0.113.9',
  seudonimoRed: () => 'b'.repeat(64),
  dentroDeLimites: async (accion: string, s: unknown) => { h.orden.push(`limites:${accion}`); h.limites.push(s); return h.limite },
}))
vi.mock('@/lib/confirmacion/googleConfirmacion', () => ({ reflejarEnGoogle: async (c: unknown) => { h.google.push(c) } }))

const ruta = await import('@/app/api/confirmar/[codigo]/route')

function respuesta(r: Partial<RespuestaConfirmacion>): RespuestaConfirmacion {
  return { r_resultado: 'confirmada', r_cita_id: '00000000-0000-4000-8000-0000000000c1', r_google_event_id: null, r_gcal_etag: null, ...r }
}

async function post(o: { codigo?: string; accion?: string | null; origin?: string | null; sfs?: string } = {}): Promise<Response> {
  const headers = new Headers({ host: 'localhost:3001' })
  const origin = o.origin === undefined ? 'http://localhost:3001' : o.origin
  if (origin !== null) headers.set('origin', origin)
  if (o.sfs) headers.set('sec-fetch-site', o.sfs)
  const cuerpo = new URLSearchParams()
  if (o.accion !== null) cuerpo.set('accion', o.accion ?? 'confirmar')
  headers.set('content-type', 'application/x-www-form-urlencoded')
  const codigo = o.codigo ?? COD
  const req = new NextRequest(`http://localhost:3001/api/confirmar/${codigo}`, { method: 'POST', headers, body: cuerpo.toString() })
  return ruta.POST(req, { params: Promise.resolve({ codigo }) })
}

beforeEach(() => {
  h.orden = []; h.ctx = CTX; h.resp = respuesta({}); h.limite = true; h.despues = []; h.google = []; h.limites = []
})

describe('POST /api/confirmar/[codigo]', () => {
  it('sólo exporta POST: GET y HEAD no existen (Next responde 405)', () => {
    expect(Object.keys(ruta).filter(k => /^[A-Z]+$/.test(k))).toEqual(['POST'])
  })

  it('origen ajeno, Origin null o sin Origin ni Sec-Fetch-Site: 403 sin tocar la base', async () => {
    for (const o of [{ origin: 'https://otro.mx' }, { origin: 'null' }, { origin: null }, { origin: null, sfs: 'cross-site' }]) {
      expect((await post(o)).status).toBe(403)
    }
    expect(h.orden).toEqual([])
  })

  it('sin Origin pero con Sec-Fetch-Site: same-origin, pasa', async () => {
    expect((await post({ origin: null, sfs: 'same-origin' })).status).toBe(303)
  })

  it('código sin forma: 404 sin tocar la base; acción desconocida o ausente: 400', async () => {
    expect((await post({ codigo: 'corto' })).status).toBe(404)
    expect((await post({ accion: 'borrar' })).status).toBe(400)
    expect((await post({ accion: null })).status).toBe(400)
    expect(h.orden).toEqual([])
  })

  it('enlace sin contexto (revocado, apagado, suspendida, RPC ausente): 404 sin límites ni respuesta', async () => {
    h.ctx = null
    expect((await post()).status).toBe(404)
    expect(h.orden).toEqual(['contexto'])
  })

  it('cada resultado es un 303 a la página con su ?r=, nunca 307', async () => {
    for (const r of ['confirmada', 'cancelada', 'ya_confirmada', 'ya_cancelada', 'cerrada', 'pasada', 'fuera_de_plazo'] as const) {
      h.resp = respuesta({ r_resultado: r })
      const res = await post({ accion: r === 'cancelada' || r === 'fuera_de_plazo' ? 'cancelar' : 'confirmar' })
      expect(res.status, r).toBe(303)
      expect(res.headers.get('location'), r).toBe(`http://localhost:3001/confirmar/${COD}?r=${r}`)
    }
  })

  it('el límite va por la IP y por el hash del enlace, y al pasarlo no responde: ?r=limite', async () => {
    h.limite = false
    const res = await post()
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`http://localhost:3001/confirmar/${COD}?r=limite`)
    expect(h.orden).toEqual(['contexto', 'limites:confirmar'])
    expect(h.limites[0]).toEqual({ ip: 'b'.repeat(64), enlace: CTX.codigo_hash })
  })

  it('invalido o RPC caída: 404', async () => {
    h.resp = respuesta({ r_resultado: 'invalido', r_cita_id: null })
    expect((await post()).status).toBe(404)
    h.resp = null
    expect((await post()).status).toBe(404)
  })

  it('Google sólo con confirmada/cancelada y evento, con la clínica del contexto y el etag guardado', async () => {
    h.resp = respuesta({ r_resultado: 'ya_confirmada', r_google_event_id: 'ev1', r_gcal_etag: '"e1"' })
    await post()
    h.resp = respuesta({ r_resultado: 'confirmada' })
    await post()
    expect(h.despues).toHaveLength(0)
    h.resp = respuesta({ r_resultado: 'cancelada', r_google_event_id: 'ev1', r_gcal_etag: '"e1"' })
    await post({ accion: 'cancelar' })
    expect(h.despues).toHaveLength(1)
    await h.despues[0]?.()
    expect(h.google).toEqual([{ clinicaId: CTX.clinica_id, citaId: '00000000-0000-4000-8000-0000000000c1', eventId: 'ev1', etag: '"e1"' }])
  })

  it('la acción del formulario llega tal cual a la base', async () => {
    await post({ accion: 'cancelar' })
    expect(h.orden).toEqual(['contexto', 'limites:confirmar', 'responder:cancelar'])
  })
})
