/**
 * whatsappRuta.test.ts — agenda E7: `POST /api/agenda/whatsapp` y
 * `GET /api/agenda/por-confirmar`.
 *
 * `entradaGestion()` (getUser → perfil → interruptor) y el enlace de E2 son
 * dobles; el cliente de SESIÓN es un doble que apunta cada llamada. Se prueba
 * que `preparar` no escribe nada, que `abierto` escribe UNA columna (y no
 * `updated_at`) con `clinica_id`, el cuerpo estricto, la cita que la RLS no
 * deja ver (404), y la lista de mañana.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

type Llamada = { op: string; args: unknown[] }
const h = vi.hoisted(() => ({
  entrada: 'ok' as 'ok' | 401 | 403 | 404,
  llamadas: [] as Llamada[],
  fila: null as Record<string, unknown> | null,
  filas: [] as Array<Record<string, unknown>>,
  /** E8: lo que devuelve `cita_confirmaciones` (o su error). */
  respuestas: [] as Array<Record<string, unknown>>,
  errorRespuestas: null as { code: string } | null,
  /** D11: lo que devuelve `reserva_empalmes_google` (o su error). */
  empalmes: [] as Array<Record<string, unknown>>,
  errorEmpalmes: null as { code: string } | null,
  enlace: { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' } as { id: string; codigo: string; url: string } | null,
  emisiones: [] as unknown[][],
}))

function cadena(tabla: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const op of ['select', 'update', 'eq', 'gt', 'gte', 'lt', 'in', 'not', 'order', 'limit']) {
    c[op] = (...args: unknown[]) => { h.llamadas.push({ op, args }); return c }
  }
  c.maybeSingle = async () => ({ data: h.fila, error: null })
  const resultado = tabla === 'cita_confirmaciones' ? { data: h.respuestas, error: h.errorRespuestas }
    : tabla === 'reserva_empalmes_google' ? { data: h.empalmes, error: h.errorEmpalmes }
      : { data: h.filas, error: null }
  c.then = (ok: (r: unknown) => unknown) => Promise.resolve(resultado).then(ok)
  return c
}

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => (h.entrada === 'ok'
    ? { ok: true, clinicaId: 'clinica-1', perfil: { id: 'perfil-1', role: 'secretaria', es_admin_de_clinica: false },
        supabase: { from: (t: string) => { h.llamadas.push({ op: 'from', args: [t] }); return cadena(t) } } }
    : { ok: false, respuesta: NextResponse.json({ error: 'x' }, { status: h.entrada }) }),
}))
vi.mock('@/lib/confirmacion/enlaceConfirmacion', () => ({
  emitirEnlaceConfirmacion: async (...args: unknown[]) => { h.emisiones.push(args); return h.enlace },
}))

const { POST } = await import('@/app/api/agenda/whatsapp/route')
const { GET } = await import('@/app/api/agenda/por-confirmar/route')

const CITA = '00000000-0000-4000-8000-00000000e7a1'
const FUTURO = new Date(Date.now() + 26 * 3_600_000).toISOString()

function cita(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CITA, title: 'Juana Pérez', status: 'scheduled', start_time: FUTURO, all_day: false,
    paciente_id: 'p1', reserva_canal: null, reserva_telefono: null,
    consultorio_nombre: 'Consultorio Uno', consultorio_timezone: 'America/Mexico_City',
    whatsapp_sent_at: null, whatsapp_reminder_sent_at: null, pacientes: { telefono: '55 1234 5678' },
    medico: { titulo: 'Dra.', nombres: 'Ana', apellido_paterno: 'Pérez', apellido_materno: null },
    ...extra,
  }
}

function post(cuerpo: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agenda/whatsapp', { method: 'POST', body: JSON.stringify(cuerpo) })
}
const updates = (): Llamada[] => h.llamadas.filter((l) => l.op === 'update')

beforeEach(() => {
  h.entrada = 'ok'
  h.llamadas = []
  h.fila = cita()
  h.filas = []
  h.respuestas = []
  h.errorRespuestas = null
  h.empalmes = []
  h.errorEmpalmes = null
  h.emisiones = []
  h.enlace = { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' }
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://spinus.prueba')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /api/agenda/whatsapp — puertas', () => {
  it.each([401, 403, 404] as const)('la entrada común responde %i (404 = interruptor apagado)', async (s) => {
    h.entrada = s
    expect((await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).status).toBe(s)
    expect(h.emisiones).toEqual([])
  })

  it('cuerpo estricto: claves de más, paso o tipo inventados → 400', async () => {
    for (const malo of [{ cita_id: CITA, paso: 'preparar', tipo: 'enlace', x: 1 }, { cita_id: CITA, paso: 'enviar', tipo: 'enlace' },
      { cita_id: CITA, paso: 'abierto', tipo: 'otro' }, { cita_id: 'no-uuid', paso: 'preparar', tipo: 'enlace' }]) {
      expect((await POST(post(malo))).status).toBe(400)
    }
  })

  it('la cita que la RLS no deja ver (otro médico para el invitado) → 404', async () => {
    h.fila = null
    expect((await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).status).toBe(404)
  })

  it('cancelada, pasada, de todo el día o evento sin paciente → 409 no_aplica', async () => {
    for (const extra of [{ status: 'cancelled' }, { start_time: new Date(Date.now() - 60_000).toISOString() }, { all_day: true },
      { paciente_id: null, pacientes: null }]) {
      h.fila = cita(extra)
      const res = await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))
      expect(res.status).toBe(409)
    }
  })

  it('sin teléfono → 422 sin_telefono; con teléfono raro → 422 telefono_invalido', async () => {
    h.fila = cita({ pacientes: { telefono: null } })
    expect(await (await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).json()).toEqual({ error: 'sin_telefono' })
    h.fila = cita({ pacientes: { telefono: '123' } })
    expect(await (await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).json()).toEqual({ error: 'telefono_invalido' })
  })
})

describe('POST /api/agenda/whatsapp — preparar y abierto', () => {
  it('preparar emite el enlace con la clínica y el perfil de la SESIÓN y no escribe appointments', async () => {
    const res = await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))
    const { url } = await res.json()
    expect(url.startsWith('https://wa.me/5215512345678?text=')).toBe(true)
    const texto = decodeURIComponent(new URL(url).searchParams.get('text') ?? '')
    expect(texto).toContain('/confirmar/')
    expect(texto).not.toContain('Juana')
    expect(h.emisiones).toEqual([['clinica-1', CITA, 'perfil-1']])
    expect(updates()).toEqual([])
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('preparar sin enlace (sin secreto, apagado en la base) → 503', async () => {
    h.enlace = null
    expect((await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).status).toBe(503)
  })

  it('la cita por ligar usa el teléfono de la reserva', async () => {
    h.fila = cita({ paciente_id: null, pacientes: null, reserva_canal: 'fijo', reserva_telefono: '5598765432' })
    const { url } = await (await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).json()
    expect(url.startsWith('https://wa.me/5215598765432?text=')).toBe(true)
  })

  it.each([['enlace', 'whatsapp_sent_at'], ['recordatorio', 'whatsapp_reminder_sent_at']])(
    'abierto (%s) escribe SÓLO %s, sin updated_at, con id y clinica_id', async (tipo, columna) => {
      const res = await POST(post({ cita_id: CITA, paso: 'abierto', tipo }))
      expect(res.status).toBe(200)
      const [u] = updates()
      expect(Object.keys(u.args[0] as object)).toEqual([columna])
      const eqs = h.llamadas.slice(h.llamadas.indexOf(u)).filter((l) => l.op === 'eq').map((l) => l.args)
      expect(eqs).toEqual([['id', CITA], ['clinica_id', 'clinica-1']])
      expect(h.emisiones).toEqual([])
    })
})

describe('GET /api/agenda/por-confirmar', () => {
  it('sólo agendadas de mañana en la zona del consultorio, sin teléfono en la respuesta', async () => {
    const manana = cita()
    const pasado = cita({ id: 'x2', start_time: new Date(Date.now() + 49 * 3_600_000).toISOString() })
    h.filas = [manana, pasado, cita({ id: 'x3', paciente_id: null, pacientes: null })]
    const res = await GET()
    const { citas } = await res.json()
    // `manana` es de mañana salvo justo alrededor de medianoche: se comprueba la forma, no el conteo exacto.
    for (const c of citas) {
      expect(Object.keys(c).sort()).toEqual(['id', 'inicio', 'tiene_telefono', 'titulo', 'whatsapp_reminder_sent_at', 'zona'])
      expect(JSON.stringify(c)).not.toContain('5512345678')
    }
    expect(citas.find((c: { id: string }) => c.id === 'x3')).toBeUndefined()
    const eqs = h.llamadas.filter((l) => l.op === 'eq').map((l) => l.args)
    expect(eqs.slice(0, 3)).toEqual([['clinica_id', 'clinica-1'], ['status', 'scheduled'], ['all_day', false]])
  })

  it('con la entrada cerrada responde lo de la entrada', async () => {
    h.entrada = 404
    expect((await GET()).status).toBe(404)
  })
})

describe('GET /api/agenda/por-confirmar — canceladas por el paciente (E8)', () => {
  it('sólo las que siguen canceladas, con clinica_id en las dos lecturas', async () => {
    h.respuestas = [
      { appointment_id: 'c1', respondido_en: '2026-11-12T10:00:00+00:00' },
      { appointment_id: 'c2', respondido_en: '2026-11-12T09:00:00+00:00' },
    ]
    // Las dos lecturas de `appointments` del doble devuelven lo mismo: filas completas.
    h.filas = [
      cita({ id: 'c1', title: 'Cita uno', consultorio_timezone: null, status: 'cancelled' }),
      cita({ id: 'c2', title: 'Reactivada', consultorio_timezone: 'America/Cancun', status: 'scheduled' }),
    ]
    const { canceladas } = await (await GET()).json()
    expect(canceladas).toEqual([{ id: 'c1', inicio: FUTURO, zona: 'America/Mexico_City', titulo: 'Cita uno', respondido_en: '2026-11-12T10:00:00+00:00' }])
    const deClinica = h.llamadas.filter((l) => l.op === 'eq' && l.args[0] === 'clinica_id')
    // Lista de mañana, respuestas, sus citas y (D11) los empalmes, vacíos aquí.
    expect(deClinica).toHaveLength(4)
    expect(h.llamadas.some((l) => l.op === 'eq' && l.args[0] === 'respuesta' && l.args[1] === 'cancelo')).toBe(true)
  })

  it('sin la tabla de E1 (42P01): la sección sale vacía y la lista sigue', async () => {
    h.errorRespuestas = { code: '42P01' }
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).canceladas).toEqual([])
  })

  it('otro error al leer las respuestas → 500', async () => {
    h.errorRespuestas = { code: '57014' }
    expect((await GET()).status).toBe(500)
  })
})

describe('GET /api/agenda/por-confirmar — reservas empalmadas con Google (D11)', () => {
  const FIN = new Date(Date.parse(FUTURO) + 30 * 60_000).toISOString()
  it('sólo los pares en pie, con clinica_id en las dos lecturas y sin datos de contacto', async () => {
    h.empalmes = [{ cita_reserva_id: 'r1', cita_otra_id: 'g1', detectado_en: '2026-11-12T10:00:00+00:00' }]
    h.filas = [
      cita({ id: 'r1', title: 'Persona Reserva', end_time: FIN, medico_id: 'm1', reserva_canal: 'fijo', reserva_telefono: '5512345678' }),
      cita({ id: 'g1', title: 'Junta', end_time: FIN, medico_id: 'm1' }),
    ]
    const { empalmes } = await (await GET()).json()
    expect(empalmes).toEqual([{ id: 'r1', inicio: FUTURO, zona: 'America/Mexico_City', titulo: 'Persona Reserva', detectado_en: '2026-11-12T10:00:00+00:00' }])
    expect(JSON.stringify(empalmes)).not.toContain('5512345678')
    expect(h.llamadas.some((l) => l.op === 'from' && l.args[0] === 'reserva_empalmes_google')).toBe(true)
    // Lista de mañana, respuestas (vacías), los pares y sus citas.
    const deClinica = h.llamadas.filter((l) => l.op === 'eq' && l.args[0] === 'clinica_id')
    expect(deClinica).toHaveLength(4)
  })

  it('sin la tabla de D11 (42P01): la sección sale vacía y la lista sigue', async () => {
    h.errorEmpalmes = { code: '42P01' }
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).empalmes).toEqual([])
  })
})
