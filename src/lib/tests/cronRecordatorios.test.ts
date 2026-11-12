/**
 * cronRecordatorios.test.ts — agenda E4: `GET /api/cron/recordatorios` y
 * `recordatorios.ts`.
 *
 * Todo simulado: el cliente de servicio (sólo `.rpc()`), el enlace de
 * confirmación y el transporte de correo son dobles. Se prueba la puerta (S2,
 * la misma `autorizada()` que C7), que la respuesta no lleve datos, que con el
 * transporte apagado o sin secreto no se toque la base, la tolerancia a las RPC
 * ausentes, el presupuesto, y cómo se cierra cada envío.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import type { Correo, ResultadoEnvio } from '@/lib/correo/transporte'

type Respuesta = { data: unknown; error: { code?: string; message: string } | null }

const h = vi.hoisted(() => ({
  llamadas: [] as Array<{ rpc: string; args: Record<string, unknown> }>,
  responder: (() => ({ data: null, error: null })) as (rpc: string, args: Record<string, unknown>) => Respuesta,
  correos: [] as Correo[],
  envio: { ok: true, modo: 'captura' } as ResultadoEnvio,
  enlace: { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' } as { id: string; codigo: string; url: string } | null,
  emisiones: [] as Array<[string, string, string | null]>,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => { throw new Error('E4 no debe usar .from() con el cliente de servicio') },
    rpc: async (rpc: string, args: Record<string, unknown>) => { h.llamadas.push({ rpc, args }); return h.responder(rpc, args) },
  }),
}))
vi.mock('@/lib/confirmacion/enlaceConfirmacion', () => ({
  emitirEnlaceConfirmacion: vi.fn(async (clinica: string, cita: string, autor: string | null) => {
    h.emisiones.push([clinica, cita, autor])
    return h.enlace
  }),
}))
vi.mock('@/lib/correo/transporte', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/correo/transporte')>()
  return { ...real, enviarCorreo: vi.fn(async (c: Correo) => { h.correos.push(c); return h.envio }) }
})

const { GET, dynamic, maxDuration } = await import('@/app/api/cron/recordatorios/route')
const { recorrerRecordatorios, procesarRecordatorio } = await import('@/lib/confirmacion/recordatorios')

const SECRETO_CRON = 'secretoDePrueba1234567890'
const C1 = '00000000-0000-4000-8000-00000000e4c1'
const C2 = '00000000-0000-4000-8000-00000000e4c2'
const A1 = '00000000-0000-4000-8000-00000000e4a1'
const A2 = '00000000-0000-4000-8000-00000000e4a2'
const ENVIO = '00000000-0000-4000-8000-00000000e4e1'
const PARA = 'paciente.secreto@ejemplo.mx'

const TOMA = {
  r_envio_id: ENVIO, r_para: PARA, r_inicio: '2026-11-17T16:00:00+00:00', r_fin: '2026-11-17T16:30:00+00:00',
  r_zona: 'America/Mexico_City', r_estado: 'scheduled',
  r_medico: { titulo: 'Dra.', nombres: 'Ana', apellido_paterno: 'Pérez', apellido_materno: null },
  r_consultorio: { nombre: 'Consultorio Uno', direccion: 'Calle 1', telefono: '5555555555' },
}

/** Respuestas por omisión: dos pendientes, la toma prende y marcar devuelve true. */
function responderNormal(rpc: string): Respuesta {
  if (rpc === 'cita_correos_pendientes') return { data: [{ r_clinica_id: C1, r_cita_id: A1 }, { r_clinica_id: C2, r_cita_id: A2 }], error: null }
  if (rpc === 'cita_correo_tomar') return { data: [TOMA], error: null }
  if (rpc === 'cita_correo_marcar') return { data: true, error: null }
  return { data: null, error: { code: 'XX', message: 'inesperada' } }
}

function peticion(authorization?: string): NextRequest {
  const headers = new Headers()
  if (authorization !== undefined) headers.set('authorization', authorization)
  return new NextRequest('http://localhost/api/cron/recordatorios', { headers })
}
const BUENA = `Bearer ${SECRETO_CRON}`
const rpcs = (): string[] => h.llamadas.map((l) => l.rpc)
const marcas = (): Array<Record<string, unknown>> => h.llamadas.filter((l) => l.rpc === 'cita_correo_marcar').map((l) => l.args)

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRETO_CRON)
  vi.stubEnv('EMAIL_TRANSPORT', 'captura')
  vi.stubEnv('RESERVA_SECRETO', 'c4'.repeat(32))
  h.llamadas = []
  h.correos = []
  h.emisiones = []
  h.envio = { ok: true, modo: 'captura' }
  h.enlace = { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' }
  h.responder = responderNormal
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 }) as unknown as typeof setTimeout)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/cron/recordatorios — la puerta (S2)', () => {
  it('declara force-dynamic y maxDuration 60', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(maxDuration).toBe(60)
  })

  it('401 sin cuerpo: sin cabecera, con otro secreto, sin CRON_SECRET o vacío; y no toca la base', async () => {
    for (const mala of [undefined, `Bearer ${SECRETO_CRON}x`, SECRETO_CRON, 'Bearer ']) {
      const res = await GET(peticion(mala))
      expect(res.status, String(mala)).toBe(401)
      expect(await res.text()).toBe('')
    }
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(peticion('Bearer '))).status).toBe(401)
    vi.stubEnv('CRON_SECRET', undefined)
    expect((await GET(peticion('Bearer undefined'))).status).toBe(401)
    expect(h.llamadas).toEqual([])
  })

  it('la ruta usa la autorizada() compartida y no consulta la base por sí misma', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/app/api/cron/recordatorios/route.ts'), 'utf8')
    expect(fuente).toContain("from '@/lib/cronAutorizacion'")
    expect(fuente).not.toMatch(/\.\s*from\s*\(|\.\s*rpc\s*\(|createAdminClient|createClient/)
    const c7 = readFileSync(join(process.cwd(), 'src/app/api/cron/google-sync/route.ts'), 'utf8')
    expect(c7).toContain("from '@/lib/cronAutorizacion'")
    expect(c7).not.toContain('timingSafeEqual(')
  })
})

describe('GET /api/cron/recordatorios — cuándo no hace nada', () => {
  it.each([[undefined], [''], ['resend'], ['smtp']])('transporte apagado (EMAIL_TRANSPORT=%s en local): {ok:true} sin ninguna RPC', async (valor) => {
    vi.stubEnv('EMAIL_TRANSPORT', valor)
    const res = await GET(peticion(BUENA))
    expect(await res.json()).toEqual({ ok: true })
    expect(h.llamadas).toEqual([])
  })

  it('sin RESERVA_SECRETO: {ok:true} sin ninguna RPC (no se gastan intentos)', async () => {
    vi.stubEnv('RESERVA_SECRETO', '')
    expect(await (await GET(peticion(BUENA))).json()).toEqual({ ok: true })
    expect(h.llamadas).toEqual([])
  })

  it.each(['PGRST202', '42883', '42P01', 'PGRST205'])('sin las RPC de E4 (%s): {ok:true}', async (code) => {
    h.responder = () => ({ data: null, error: { code, message: 'no existe' } })
    const res = await GET(peticion(BUENA))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(rpcs()).toEqual(['cita_correos_pendientes'])
  })

  it('si el listado falla por otra causa: 500 sin cuerpo y sin el mensaje de Postgres', async () => {
    h.responder = () => ({ data: null, error: { code: '57014', message: 'cita de paciente.secreto@ejemplo.mx' } })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(peticion(BUENA))
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('')
    expect(JSON.stringify(error.mock.calls)).not.toContain('paciente.secreto')
  })
})

describe('GET /api/cron/recordatorios — el recorrido', () => {
  it('lista 200, toma cada cita con su clínica y el MISMO testigo, manda y marca enviado', async () => {
    const res = await GET(peticion(BUENA))
    const texto = await res.text()
    expect(JSON.parse(texto)).toEqual({ ok: true })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(h.llamadas[0]).toEqual({ rpc: 'cita_correos_pendientes', args: { p_limite: 200 } })
    const tomas = h.llamadas.filter((l) => l.rpc === 'cita_correo_tomar').map((l) => l.args)
    expect(tomas.map((t) => [t.p_clinica_id, t.p_cita_id, t.p_tipo])).toEqual([[C1, A1, 'recordatorio'], [C2, A2, 'recordatorio']])
    expect(new Set(tomas.map((t) => t.p_testigo)).size).toBe(1)
    expect(h.emisiones).toEqual([[C1, A1, null], [C2, A2, null]])
    expect(h.correos).toHaveLength(2)
    expect(h.correos[0]).toMatchObject({ para: PARA, etiqueta: 'recordatorio', idempotencia: `recordatorio/${ENVIO}` })
    expect(marcas()[0]).toEqual({ p_clinica_id: C1, p_envio_id: ENVIO, p_testigo: tomas[0].p_testigo, p_estado: 'enviado', p_motivo: null })
    // La respuesta no lleva nada de esto.
    for (const dato of [C1, A1, ENVIO, PARA, 'confirmar']) expect(texto).not.toContain(dato)
  })

  it('la toma que no prende (otra ejecución, fuera de ventana…) no emite ni manda ni marca', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: [], error: null } : responderNormal(rpc))
    await GET(peticion(BUENA))
    expect(h.emisiones).toEqual([])
    expect(h.correos).toEqual([])
    expect(marcas()).toEqual([])
  })

  it('sin enlace: omitido/sin_enlace, sin mandar', async () => {
    h.enlace = null
    await GET(peticion(BUENA))
    expect(h.correos).toEqual([])
    expect(marcas().map((m) => [m.p_estado, m.p_motivo])).toEqual([['omitido', 'sin_enlace'], ['omitido', 'sin_enlace']])
  })

  it('transporte falla: fallido/transporte; 409 de idempotencia: fallido/duplicado', async () => {
    h.envio = { ok: false, modo: 'captura', motivo: 'fallo' }
    await GET(peticion(BUENA))
    expect(marcas()[0]).toMatchObject({ p_estado: 'fallido', p_motivo: 'transporte' })
    h.llamadas = []
    h.envio = { ok: false, modo: 'resend', motivo: 'duplicado' }
    await GET(peticion(BUENA))
    expect(marcas()[0]).toMatchObject({ p_estado: 'fallido', p_motivo: 'duplicado' })
  })

  it('una plantilla imposible (inicio que no es fecha): omitido/plantilla', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: [{ ...TOMA, r_inicio: 'nunca' }], error: null } : responderNormal(rpc))
    await GET(peticion(BUENA))
    expect(marcas()[0]).toMatchObject({ p_estado: 'omitido', p_motivo: 'plantilla' })
  })

  it('la versión confirmada no ofrece «Confirmar»', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: [{ ...TOMA, r_estado: 'confirmed' }], error: null } : responderNormal(rpc))
    await GET(peticion(BUENA))
    expect(h.correos[0].texto).not.toContain('Confirmar')
  })

  it('un fallo de la base en una cita no tumba la ejecución: la siguiente sigue', async () => {
    let primera = true
    h.responder = (rpc) => {
      if (rpc === 'cita_correo_tomar' && primera) { primera = false; return { data: null, error: { code: '40001', message: 'x' } } }
      return responderNormal(rpc)
    }
    const res = await GET(peticion(BUENA))
    expect(res.status).toBe(200)
    expect(h.correos).toHaveLength(1)
  })

  it('una forma inesperada de la toma no manda nada', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: [{ ...TOMA, r_estado: 'cancelled' }], error: null } : responderNormal(rpc))
    await GET(peticion(BUENA))
    expect(h.correos).toEqual([])
  })
})

describe('recorrerRecordatorios — presupuesto y pausa', () => {
  it('deja de empezar citas al agotar el presupuesto y duerme sólo tras un envío', async () => {
    h.responder = (rpc) => (rpc === 'cita_correos_pendientes'
      ? { data: Array.from({ length: 10 }, (_, i) => ({ r_clinica_id: C1, r_cita_id: `00000000-0000-4000-8000-0000000e4a${String(i).padStart(2, '0')}` })), error: null }
      : responderNormal(rpc))
    let t = 0
    const dormidas: number[] = []
    const c = await recorrerRecordatorios({
      testigo: ENVIO, limite: 10, presupuestoMs: 3_000, pausaMs: 600,
      ahora: () => t, dormir: async (ms) => { dormidas.push(ms); t += 1_000 },
    })
    expect(c.enviado).toBe(3)
    expect(dormidas).toEqual([600, 600, 600])
  })

  it('procesarRecordatorio nunca lanza', async () => {
    h.responder = () => { throw new Error('red caída') }
    await expect(procesarRecordatorio(C1, A1, ENVIO)).resolves.toBe('error')
  })
})
