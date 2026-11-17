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
import { desplazarFecha, fechaHoraLocalAInstante, hoyEnTZ } from '@/lib/dates'

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
  /** I5: lo que devuelve `avisos_clinica` (o su error). */
  avisos: [] as Array<Record<string, unknown>>,
  errorAvisos: null as { code: string } | null,
  enlace: { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' } as { id: string; codigo: string; url: string } | null,
  emisiones: [] as unknown[][],
}))

function cadena(tabla: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const op of ['select', 'update', 'eq', 'gt', 'gte', 'lt', 'in', 'not', 'is', 'order', 'limit']) {
    c[op] = (...args: unknown[]) => { h.llamadas.push({ op, args }); return c }
  }
  c.maybeSingle = async () => ({ data: h.fila, error: null })
  const resultado = tabla === 'cita_confirmaciones' ? { data: h.respuestas, error: h.errorRespuestas }
    : tabla === 'reserva_empalmes_google' ? { data: h.empalmes, error: h.errorEmpalmes }
      : tabla === 'avisos_clinica' ? { data: h.avisos, error: h.errorAvisos }
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
  h.avisos = []
  h.errorAvisos = null
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

  it('T1: el 409 dice el MOTIVO (el botón lo enseña en llano) y no emite ningún enlace', async () => {
    for (const [extra, motivo] of [[{ start_time: new Date(Date.now() - 60_000).toISOString() }, 'pasada'],
      [{ status: 'attended' }, 'atendida'], [{ status: 'cancelled' }, 'cancelada'], [{ all_day: true }, 'todo_el_dia']] as const) {
      h.fila = cita(extra)
      expect(await (await POST(post({ cita_id: CITA, paso: 'preparar', tipo: 'enlace' }))).json()).toEqual({ error: 'no_aplica', motivo })
    }
    expect(h.emisiones).toEqual([])
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
      expect(Object.keys(c).sort()).toEqual(['con_correo', 'con_whatsapp', 'consultorio', 'id', 'inicio', 'titulo', 'whatsapp_reminder_sent_at', 'zona'])
      expect(JSON.stringify(c)).not.toContain('5512345678')
    }
    expect(citas.find((c: { id: string }) => c.id === 'x3')).toBeUndefined()
    const eqs = h.llamadas.filter((l) => l.op === 'eq').map((l) => l.args)
    expect(eqs.slice(0, 3)).toEqual([['clinica_id', 'clinica-1'], ['status', 'scheduled'], ['all_day', false]])
  })

  /* H4 (punto 17) · Los medios de cada fila son las reglas de los botones, en
     booleanos; ni el teléfono ni el correo viajan. MUTACIÓN: `con_correo`
     desde `motivoSinWhatsApp` (o `true` fijo) → la fila sin correo dice que sí. */
  it('H4: con_whatsapp / con_correo por las reglas de los botones, sin teléfono ni correo en la respuesta', async () => {
    const tz = 'America/Mexico_City'
    const manana = fechaHoraLocalAInstante(desplazarFecha(hoyEnTZ(tz), { dias: 1 }), '12:00', tz)
    const c = (id: string, tel: string | null, correo: string | null, reservaCorreo: string | null = null) => cita({
      id, start_time: manana, pacientes: { telefono: tel }, correo: { email: correo }, reserva_correo: reservaCorreo,
    })
    h.filas = [c('ambos', '5512345678', 'a@b.mx'), c('tel', '5512345678', null), c('correo', null, 'a@b.mx'),
      c('ninguno', null, null), c('invalido', '123', null), c('reserva', null, null, 'r@b.mx')]
    const { citas } = await (await GET()).json()
    const medios = Object.fromEntries(citas.map((f: { id: string; con_whatsapp: boolean; con_correo: boolean; consultorio: string }) =>
      [f.id, `${f.con_whatsapp}|${f.con_correo}|${f.consultorio}`]))
    expect(medios).toEqual({
      ambos: 'true|true|Consultorio Uno', tel: 'true|false|Consultorio Uno', correo: 'false|true|Consultorio Uno',
      ninguno: 'false|false|Consultorio Uno', invalido: 'false|false|Consultorio Uno', reserva: 'false|true|Consultorio Uno',
    })
    const texto = JSON.stringify(citas)
    for (const dato of ['5512345678', 'a@b.mx', 'r@b.mx']) expect(texto).not.toContain(dato)
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
    // Lista de mañana, respuestas, sus citas, (D11) los empalmes y (I5) los avisos, vacíos aquí.
    expect(deClinica).toHaveLength(5)
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
    // Lista de mañana, respuestas (vacías), los pares, sus citas y (I5) los avisos.
    const deClinica = h.llamadas.filter((l) => l.op === 'eq' && l.args[0] === 'clinica_id')
    expect(deClinica).toHaveLength(5)
  })

  it('sin la tabla de D11 (42P01): la sección sale vacía y la lista sigue', async () => {
    h.errorEmpalmes = { code: '42P01' }
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).empalmes).toEqual([])
  })
})

describe('GET /api/agenda/por-confirmar — avisos de la clínica (I5, punto 19)', () => {
  it('viajan en la MISMA respuesta (ninguna petición de más), sin revisar y con clinica_id', async () => {
    h.avisos = [{ id: 'av1', tipo: 'reserva_enlace', cita_id: 'r1', creado_en: '2026-11-12T10:00:00+00:00' }]
    h.filas = [cita({ id: 'r1', title: 'Persona Reserva', reserva_nombre: 'Persona Reserva', consultorio_timezone: 'America/Merida', end_time: FUTURO, medico_id: 'm1' })]
    const cuerpo = await (await GET()).json()
    expect(cuerpo.avisos_disponibles).toBe(true)
    expect(cuerpo.avisos).toHaveLength(1)
    expect(cuerpo.avisos[0]).toMatchObject({ id: 'av1', tipo: 'reserva_enlace', cita: { id: 'r1', zona: 'America/Merida' } })
    expect(h.llamadas.some((l) => l.op === 'is' && l.args[0] === 'revisado_en' && l.args[1] === null)).toBe(true)
  })

  it('sin la tabla (42P01, base sin la migración): avisos_disponibles=false y lo demás sigue', async () => {
    h.errorAvisos = { code: '42P01' }
    const res = await GET()
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    expect(cuerpo.avisos_disponibles).toBe(false)
    expect(cuerpo.avisos).toEqual([])
    expect(cuerpo.citas).toBeDefined()
  })
})
