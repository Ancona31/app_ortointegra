/**
 * transporteCorreo.test.ts — agenda D0: el transporte de correo lo elige
 * EMAIL_TRANSPORT; sin ella (o con un valor desconocido) no sale nada; con la
 * base local Resend no se usa aunque la variable lo pida; Mailpit sólo en
 * loopback; y el logger nunca ve el destinatario.
 *
 * `resend` y `fetch` son dobles: ninguna prueba manda un correo real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface RespuestaResend { data: { id: string } | null; error: { name: string; message: string } | null }
interface Dobles { construidas: string[]; envios: unknown[]; respuesta: RespuestaResend; avisos: string[] }

const h = vi.hoisted((): Dobles => ({ construidas: [], envios: [], respuesta: { data: null, error: null }, avisos: [] }))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async (p: unknown) => { h.envios.push(p); return h.respuesta } }
    constructor(llave: string) { h.construidas.push(llave) }
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: (t: string, m: string) => { h.avisos.push(`${t} ${m}`) },
    error: (t: string, m: string) => { h.avisos.push(`${t} ${m}`) },
    info: () => {},
  },
}))

const { decidirTransporte, modoTransporte, supabaseEsRemota, urlEnvioMailpit, enviarCorreo, REMITENTE } =
  await import('@/lib/correo/transporte')

const PROD = 'https://abcdefghijklmnopqrst.supabase.co'
const LOCAL = 'http://127.0.0.1:54321'
const PARA = 'persona.prueba@ejemplo.mx'
const CORREO = { para: PARA, asunto: 'Asunto de prueba', texto: 'Hola', html: '<p>Hola</p>', etiqueta: 'reserva_codigo' }

type Fetch = (url: URL, init: RequestInit) => Promise<Response>
let fetchFalso: ReturnType<typeof vi.fn<Fetch>>

beforeEach(() => {
  h.construidas = []
  h.envios = []
  h.avisos = []
  h.respuesta = { data: { id: 'x' }, error: null }
  fetchFalso = vi.fn<Fetch>(async () => new Response('{"ID":"abc"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchFalso)
})

describe('decidirTransporte: matriz de entornos', () => {
  it.each([
    [{}, 'apagado'],
    [{ EMAIL_TRANSPORT: '' }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'RESEND' }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'smtp' }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'mailpit' }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'captura' }, 'captura'],
    [{ EMAIL_TRANSPORT: 'captura', NEXT_PUBLIC_SUPABASE_URL: PROD }, 'captura'],
    [{ EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD, RESEND_API_KEY: 're_x' }, 'resend'],
    [{ EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_x' }, 'apagado'],
    [{ EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: LOCAL, RESEND_API_KEY: 're_x' }, 'apagado'],
  ] as const)('%j → %s', (env, esperado) => {
    expect(modoTransporte(env)).toBe(esperado)
  })

  it('dice el motivo del apagado', () => {
    expect(decidirTransporte({})).toEqual({ modo: 'apagado', motivo: 'sin_variable' })
    expect(decidirTransporte({ EMAIL_TRANSPORT: 'x' })).toEqual({ modo: 'apagado', motivo: 'valor_desconocido' })
    expect(decidirTransporte({ EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: LOCAL, RESEND_API_KEY: 'r' }))
      .toEqual({ modo: 'apagado', motivo: 'supabase_local' })
    expect(decidirTransporte({ EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD }))
      .toEqual({ modo: 'apagado', motivo: 'sin_llave' })
  })
})

describe('supabaseEsRemota: todo lo que no sea https + DNS público cuenta como local', () => {
  it.each([
    [PROD, true],
    ['https://api.spinus.com.mx', true],
    [LOCAL, false],
    ['http://localhost:54321', false],
    ['https://localhost:54321', false],
    ['https://127.0.0.1', false],
    ['https://[::1]:54321', false],
    ['https://10.0.0.5', false],
    ['https://192.168.1.10', false],
    ['https://kong:8000', false],
    ['https://supabase.localhost', false],
    ['https://equipo.local', false],
    ['https://host.docker.internal:54321', false],
    ['http://abcdefghijklmnopqrst.supabase.co', false],
    ['no es url', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (url, esperado) => {
    expect(supabaseEsRemota(url)).toBe(esperado)
  })
})

describe('urlEnvioMailpit: sólo loopback', () => {
  it('por omisión, el puerto de la base local', () => {
    expect(urlEnvioMailpit({})?.href).toBe('http://127.0.0.1:54324/api/v1/send')
  })
  it.each(['http://localhost:8025', 'http://127.0.0.2:54324', 'http://[::1]:54324'])('acepta %s', (u) => {
    expect(urlEnvioMailpit({ MAILPIT_URL: u })?.pathname).toBe('/api/v1/send')
  })
  it.each(['http://mailpit.ejemplo.com', 'http://10.0.0.1:54324', 'http://0.0.0.0:54324', 'ftp://127.0.0.1', 'x'])(
    'rechaza %s', (u) => {
      expect(urlEnvioMailpit({ MAILPIT_URL: u })).toBeNull()
    })
})

describe('enviarCorreo', () => {
  it('captura: POST a Mailpit con la forma de su API y sin construir Resend', async () => {
    const r = await enviarCorreo(CORREO, { EMAIL_TRANSPORT: 'captura', RESEND_API_KEY: 're_real' })
    expect(r).toEqual({ ok: true, modo: 'captura' })
    expect(h.construidas).toEqual([])
    expect(fetchFalso).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFalso.mock.calls[0]
    expect(url.href).toBe('http://127.0.0.1:54324/api/v1/send')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(String(init.body))).toEqual({
      From: { Email: 'noreply@mail.spinus.com.mx', Name: 'Spinus' },
      To: [{ Email: PARA }],
      Subject: 'Asunto de prueba',
      Text: 'Hola',
      HTML: '<p>Hola</p>',
      Tags: ['reserva_codigo'],
    })
  })

  it('captura con MAILPIT_URL no loopback → fallo, sin llamar a fetch', async () => {
    const r = await enviarCorreo(CORREO, { EMAIL_TRANSPORT: 'captura', MAILPIT_URL: 'https://mailpit.ejemplo.com' })
    expect(r).toEqual({ ok: false, modo: 'captura', motivo: 'fallo' })
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('captura: Mailpit responde 500, redirige, o la red falla → fallo sin lanzar', async () => {
    fetchFalso.mockResolvedValueOnce(new Response('x', { status: 500 }))
    expect(await enviarCorreo(CORREO, { EMAIL_TRANSPORT: 'captura' })).toEqual({ ok: false, modo: 'captura', motivo: 'fallo' })
    fetchFalso.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://fuera.ejemplo.com' } }))
    expect(await enviarCorreo(CORREO, { EMAIL_TRANSPORT: 'captura' })).toEqual({ ok: false, modo: 'captura', motivo: 'fallo' })
    fetchFalso.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await enviarCorreo(CORREO, { EMAIL_TRANSPORT: 'captura' })).toEqual({ ok: false, modo: 'captura', motivo: 'fallo' })
  })

  it('DOBLE GUARDA: resend con la base local no construye Resend ni llama a la red', async () => {
    const r = await enviarCorreo(CORREO, {
      EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: LOCAL, RESEND_API_KEY: 're_real',
    })
    expect(r).toEqual({ ok: false, modo: 'apagado', motivo: 'apagado' })
    expect(h.construidas).toEqual([])
    expect(h.envios).toEqual([])
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it.each([{}, { EMAIL_TRANSPORT: 'desconocido' }, { EMAIL_TRANSPORT: 'resend' }])(
    'apagado (%j): nada sale, queda registrado', async (env) => {
      const r = await enviarCorreo(CORREO, { ...env, RESEND_API_KEY: 're_real' })
      expect(r).toEqual({ ok: false, modo: 'apagado', motivo: 'apagado' })
      expect(h.construidas).toEqual([])
      expect(fetchFalso).not.toHaveBeenCalled()
      expect(h.avisos).toHaveLength(1)
      expect(h.avisos[0]).toContain('reserva_codigo')
    })

  it('resend en producción: construye con la llave y manda remitente, destinatario y cuerpo', async () => {
    const r = await enviarCorreo(CORREO, {
      EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD, RESEND_API_KEY: 're_prod',
    })
    expect(r).toEqual({ ok: true, modo: 'resend' })
    expect(h.construidas).toEqual(['re_prod'])
    expect(h.envios).toEqual([{ from: REMITENTE, to: PARA, subject: 'Asunto de prueba', html: '<p>Hola</p>', text: 'Hola' }])
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('resend rechaza → fallo; el logger lleva el código, no el mensaje', async () => {
    h.respuesta = { data: null, error: { name: 'validation_error', message: `Invalid to: ${PARA}` } }
    const r = await enviarCorreo(CORREO, {
      EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD, RESEND_API_KEY: 're_prod',
    })
    expect(r).toEqual({ ok: false, modo: 'resend', motivo: 'fallo' })
    expect(h.avisos.join('\n')).toContain('validation_error')
  })

  it('el logger nunca recibe destinatario, asunto ni cuerpo; una etiqueta rara no pasa', async () => {
    h.respuesta = { data: null, error: { name: 'validation_error', message: PARA } }
    fetchFalso.mockResolvedValueOnce(new Response('x', { status: 400 }))
    const raro = { ...CORREO, etiqueta: PARA }
    await enviarCorreo(raro, {})
    await enviarCorreo(raro, { EMAIL_TRANSPORT: 'captura' })
    await enviarCorreo(raro, { EMAIL_TRANSPORT: 'resend', NEXT_PUBLIC_SUPABASE_URL: PROD, RESEND_API_KEY: 'k' })
    const todo = h.avisos.join('\n')
    expect(h.avisos.length).toBeGreaterThanOrEqual(3)
    expect(todo).not.toContain(PARA)
    expect(todo).not.toContain('ejemplo.mx')
    expect(todo).not.toContain('Asunto de prueba')
    expect(todo).not.toContain('Hola')
    expect(todo).toContain('sin_etiqueta')
  })
})
