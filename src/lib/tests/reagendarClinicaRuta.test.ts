/**
 * reagendarClinicaRuta.test.ts — tanda I, punto 9: `POST
 * /api/appointments/[id]/reagendar`, el «Reagendar» de la clínica para una
 * cita reservada por enlace. Comprueba las puertas en orden (sesión,
 * confirmación explícita, la cita con la SESIÓN, por enlace, rango, empalmes),
 * que la RPC recibe la clínica de la sesión y el actor, y el aviso al paciente
 * (correo de CAMBIO si tiene; `sin_correo` si no). Todo en dobles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const ID = '00000000-0000-4000-8000-000000000001'
const CLINICA = '00000000-0000-4000-8000-0000000000c1'
const PERFIL = '00000000-0000-4000-8000-0000000000b1'

interface FilaCita { id: string; medico_id: string | null; status: string; paciente_id: string | null; reserva_canal: string | null
  reserva_correo: string | null; google_event_id: string | null; gcal_etag: string | null; pacientes: { email: string | null } | null }

const h = vi.hoisted(() => ({
  entrada: true,
  cita: null as FilaCita | null,
  filtros: [] as string[],
  empalme: false,
  bloqueado: false,
  bloqueoConsultado: [] as Array<Record<string, unknown>>,
  rpcBloqueada: false,
  rpc: [] as Array<Record<string, unknown>>,
  resultado: 'ok' as string,
  correos: [] as Array<{ cambio?: boolean }>,
  google: 0,
  despues: [] as Array<Promise<unknown>>,
}))

vi.mock('next/server', async (original) => {
  const real = await original<typeof import('next/server')>()
  return { ...real, after: (f: () => Promise<unknown>) => { h.despues.push(f()) } }
})
vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => {
    if (!h.entrada) return { ok: false, respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    const cadena = {
      select: () => cadena,
      eq: (col: string, v: string) => { h.filtros.push(`${col}=${v}`); return cadena },
      maybeSingle: async () => ({ data: h.cita, error: null }),
    }
    return { ok: true, clinicaId: CLINICA, perfil: { id: PERFIL }, supabase: { from: () => cadena } }
  },
}))
vi.mock('@/lib/agenda/empalmesServidor', () => ({
  comprobarEmpalmes: async () => (h.empalme
    ? { ok: false, status: 409, cuerpo: { error: 'empalme', message: 'x', empalmes: [] } }
    : { ok: true }),
}))
vi.mock('@/lib/agenda/eleccionServidor', () => ({
  reagendarCita: async (r: Record<string, unknown>) => {
    h.rpc.push(r)
    return h.rpcBloqueada ? { tipo: 'bloqueado' } : { tipo: 'hecho', resultado: h.resultado, updatedAt: '2031-01-01T00:00:00Z' }
  },
}))
/* L1 (punto 6): el veto del bloqueo, en doble (su consulta la prueba `bloqueoTotalServidor.test.ts`). */
vi.mock('@/lib/agenda/bloqueoTotalServidor', async (original) => {
  const real = await original<typeof import('@/lib/agenda/bloqueoTotalServidor')>()
  return { ...real, caeEnBloqueo: async (_s: unknown, p: Record<string, unknown>) => { h.bloqueoConsultado.push(p); return h.bloqueado } }
})
vi.mock('@/lib/confirmacion/confirmacionCita', () => ({
  enviarConfirmacionCita: async (_c: string, _i: string, _p: string, o: { cambio?: boolean }) => { h.correos.push(o); return { tipo: 'enviado' } },
}))
vi.mock('@/lib/confirmacion/googleConfirmacion', () => ({ reflejarEnGoogle: async () => { h.google += 1 } }))
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }))
vi.mock('@/lib/logger', () => ({ logger: { error: () => {}, warn: () => {}, info: () => {} } }))

const ruta = await import('@/app/api/appointments/[id]/reagendar/route')
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) })
const req = (cuerpo: unknown): NextRequest => new NextRequest(`http://localhost:3001/api/appointments/${ID}/reagendar`, {
  method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
})
const CUERPO = {
  consultorio_id: ID, start_time: '2031-05-07T16:00:00.000Z', end_time: '2031-05-07T16:30:00.000Z',
  updated_at: '2031-01-01T00:00:00Z', confirmado: true,
}
const POR_ENLACE: FilaCita = {
  id: ID, medico_id: PERFIL, status: 'scheduled', paciente_id: null, reserva_canal: 'unico', reserva_correo: 'ana@x.mx',
  google_event_id: 'ev1', gcal_etag: '"1"', pacientes: null,
}

beforeEach(() => {
  h.entrada = true; h.cita = { ...POR_ENLACE }; h.filtros = []; h.empalme = false; h.rpc = []; h.resultado = 'ok'
  h.bloqueado = false; h.bloqueoConsultado = []; h.rpcBloqueada = false
  h.correos = []; h.google = 0; h.despues = []
})

describe('POST /api/appointments/[id]/reagendar (I, punto 9)', () => {
  it('sin sesión: la respuesta de la entrada, sin leer ni escribir', async () => {
    h.entrada = false
    expect((await ruta.POST(req(CUERPO), ctx())).status).toBe(401)
    expect(h.rpc).toEqual([])
  })

  it('sin la confirmación explícita, o con campos de más (el médico): 400 sin RPC', async () => {
    const { confirmado: _c, ...sin } = CUERPO
    expect(_c).toBe(true)
    expect((await ruta.POST(req(sin), ctx())).status).toBe(400)
    expect((await ruta.POST(req({ ...CUERPO, confirmado: false }), ctx())).status).toBe(400)
    expect((await ruta.POST(req({ ...CUERPO, medico_id: ID }), ctx())).status).toBe(400)
    expect(h.rpc).toEqual([])
  })

  it('la cita se lee con la sesión y su clínica; si no la ve, 404; si no es por enlace, 409 no_aplica', async () => {
    h.cita = null
    expect((await ruta.POST(req(CUERPO), ctx())).status).toBe(404)
    expect(h.filtros).toEqual([`id=${ID}`, `clinica_id=${CLINICA}`])
    h.cita = { ...POR_ENLACE, reserva_canal: null }
    const r = await ruta.POST(req(CUERPO), ctx())
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('no_aplica')
    expect(h.rpc).toEqual([])
  })

  it('el fin antes del inicio: 400; un empalme: 409 con la lista, sin RPC', async () => {
    expect((await ruta.POST(req({ ...CUERPO, end_time: CUERPO.start_time }), ctx())).status).toBe(400)
    h.empalme = true
    expect((await ruta.POST(req(CUERPO), ctx())).status).toBe(409)
    expect(h.rpc).toEqual([])
  })

  it('L1 · en un bloqueo: 409 con el mensaje de Angel, sin RPC ni correo (MUTACIÓN: sin el veto)', async () => {
    h.bloqueado = true
    const r = await ruta.POST(req(CUERPO), ctx())
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'horario_bloqueado', message: 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.' })
    expect(h.bloqueoConsultado).toEqual([{ clinicaId: CLINICA, medicoId: PERFIL, inicio: CUERPO.start_time, fin: CUERPO.end_time }])
    expect(h.rpc).toEqual([])
    expect(h.correos).toEqual([])
  })

  it('L1 · la base lo rechaza en la carrera (42501 del disparador): el mismo 409, sin correo (MUTACIÓN: sin la rama)', async () => {
    h.rpcBloqueada = true
    const r = await ruta.POST(req(CUERPO), ctx())
    expect(r.status).toBe(409)
    expect((await r.json()).message).toBe('Este horario está bloqueado. Quita el bloqueo para agendar aquí.')
    expect(h.correos).toEqual([])
  })

  it('ok: la RPC con la clínica de la sesión y el actor; correo de CAMBIO; Google después', async () => {
    const r = await ruta.POST(req(CUERPO), ctx())
    await Promise.all(h.despues)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ updated_at: '2031-01-01T00:00:00Z', correo: 'enviado' })
    expect(h.rpc).toEqual([{ clinicaId: CLINICA, actorId: PERFIL, citaId: ID, consultorioId: ID,
      inicio: CUERPO.start_time, fin: CUERPO.end_time, esperado: CUERPO.updated_at }])
    expect(h.correos).toEqual([{ cambio: true }])
    expect(h.google).toBe(1)
  })

  it('sin correo (único sin correo y sin paciente con correo): reagenda y dice sin_correo, sin intentar el envío', async () => {
    h.cita = { ...POR_ENLACE, reserva_correo: null, pacientes: { email: null } }
    const r = await ruta.POST(req(CUERPO), ctx())
    expect((await r.json()).correo).toBe('sin_correo')
    expect(h.correos).toEqual([])
  })

  it('lo que la base rechaza llega con su estado y su mensaje', async () => {
    for (const [resultado, estado] of [['modificada', 409], ['sin_permiso', 403], ['consultorio_invalido', 400], ['pasada', 409]] as const) {
      h.resultado = resultado
      const r = await ruta.POST(req(CUERPO), ctx())
      expect(r.status).toBe(estado)
      expect((await r.json()).error).toBe(resultado)
    }
    expect(h.correos).toEqual([])
  })
})
