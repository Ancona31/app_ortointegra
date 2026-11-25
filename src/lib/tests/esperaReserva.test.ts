/**
 * K2 (punto 10 de Angel): cuánto falta para volver a pedir el código. La
 * espera la calcula la base (`rate_limit_espera`) con la MISMA llave, límite y
 * ventana que cuenta `rate_limit_intento`; los 30 s entre códigos al mismo
 * correo, con la llave del límite por correo y `REENVIO_CODIGO_S`.
 * MUTACIONES (comprobadas en rojo): la ventana en minutos en vez de segundos
 * (`regla[1]` sin `* 60`); `esperaReenvio` sin el enlace o por la llave global del correo; `Math.min`
 * en vez de `Math.max`; aceptar una espera negativa de la RPC.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  llamadas: [] as { p_ruta: string; p_limite: number; p_ventana_seg: number }[],
  reenvios: [] as Record<string, unknown>[],
  respuesta: (_ruta: string): { data: unknown; error: { code: string } | null } => ({ data: 0, error: null }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (nombre: string, args: { p_ruta: string; p_limite: number; p_ventana_seg: number }) => {
      if (nombre === 'reserva_espera_reenvio') { h.reenvios.push(args); return h.respuesta('') }
      if (nombre !== 'rate_limit_espera') throw new Error(`RPC inesperada: ${nombre}`)
      h.llamadas.push(args)
      return h.respuesta(args.p_ruta)
    },
  }),
}))

beforeAll(() => { process.env.RESERVA_SECRETO = 'ab'.repeat(32) })
beforeEach(() => { h.llamadas = []; h.reenvios = []; h.respuesta = () => ({ data: 0, error: null }) })

const { REENVIO_CODIGO_S, esperaDeLimites, esperaReenvio, esperaSinContar } = await import('@/lib/reserva/limitesReserva')
const { demasiadosIntentos } = await import('@/lib/reserva/puertaReserva')

const IP = 'a'.repeat(64)
const DISP = 'b'.repeat(64)
const CORREO = 'c'.repeat(64)

describe('esperaDeLimites', () => {
  it('pregunta por cada sujeto con su llave, su límite y la ventana EN SEGUNDOS; da la mayor', async () => {
    h.respuesta = ruta => ({ data: ruta.includes(':disp:') ? 1500 : 40, error: null })
    expect(await esperaDeLimites('codigo', { ip: IP, disp: DISP })).toBe(1500)
    expect(h.llamadas).toEqual([
      { p_ruta: `reserva:codigo:ip:${IP}`, p_limite: 10, p_ventana_seg: 3600 },
      { p_ruta: `reserva:codigo:disp:${DISP}`, p_limite: 5, p_ventana_seg: 3600 },
    ])
  })
  it('el tope por correo: 3 en una hora', async () => {
    await esperaDeLimites('codigo', { correo: CORREO })
    expect(h.llamadas).toEqual([{ p_ruta: `reserva:codigo:correo:${CORREO}`, p_limite: 3, p_ventana_seg: 3600 }])
  })
  it('si la RPC falla o contesta algo raro: no se sabe (null), nunca un número inventado', async () => {
    h.respuesta = () => ({ data: null, error: { code: 'PGRST202' } })
    expect(await esperaDeLimites('reservar', { ip: IP })).toBeNull()
    h.respuesta = () => ({ data: -5, error: null })
    expect(await esperaDeLimites('reservar', { ip: IP })).toBeNull()
  })
})

describe('esperaSinContar (agente S: el freno de sondeo, leído sin contar)', () => {
  it('pregunta por cada sujeto con el límite del sondeo y la ventana en segundos; 0 si todos tienen sitio', async () => {
    expect(await esperaSinContar('sondeo', { ip: IP, disp: DISP })).toBe(0)
    expect(h.llamadas).toEqual([
      { p_ruta: `reserva:sondeo:ip:${IP}`, p_limite: 30, p_ventana_seg: 3600 },
      { p_ruta: `reserva:sondeo:disp:${DISP}`, p_limite: 8, p_ventana_seg: 3600 },
    ])
  })
  it('da la mayor espera de los que topan', async () => {
    h.respuesta = ruta => ({ data: ruta.includes(':disp:') ? 700 : 0, error: null })
    expect(await esperaSinContar('sondeo', { ip: IP, disp: DISP })).toBe(700)
  })
  it('falla cerrado: un sujeto que no se sabe, o sin seudónimo, da null aunque el otro tenga sitio', async () => {
    h.respuesta = ruta => (ruta.includes(':disp:') ? { data: null, error: { code: 'PGRST202' } } : { data: 0, error: null })
    expect(await esperaSinContar('sondeo', { ip: IP, disp: DISP })).toBeNull()
    h.respuesta = () => ({ data: 0, error: null })
    expect(await esperaSinContar('sondeo', { ip: null, disp: DISP })).toBeNull()
  })
})

describe('esperaReenvio (30 s entre códigos al mismo correo EN ESE ENLACE)', () => {
  const ctx = { clinica_id: '00000000-0000-4000-8000-00000000c001', enlace_id: '00000000-0000-4000-8000-00000000e001' }
  it('pregunta por clínica, enlace y correo, con REENVIO_CODIGO_S segundos; nunca por la llave global del correo', async () => {
    h.respuesta = () => ({ data: 22, error: null })
    expect(REENVIO_CODIGO_S).toBe(30)
    expect(await esperaReenvio(ctx, CORREO)).toBe(22)
    expect(h.reenvios).toEqual([{ p_clinica_id: ctx.clinica_id, p_enlace_id: ctx.enlace_id, p_correo_hmac: CORREO, p_segundos: 30 }])
    expect(h.llamadas).toEqual([])
  })
  it('si la RPC falla: null (no se sabe)', async () => {
    h.respuesta = () => ({ data: null, error: { code: 'PGRST202' } })
    expect(await esperaReenvio(ctx, CORREO)).toBeNull()
  })
})

describe('demasiadosIntentos', () => {
  it('con espera: 429, espera_s y Retry-After en segundos', async () => {
    const r = demasiadosIntentos(754)
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('754')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.json()).toEqual({ error: 'demasiados_intentos', espera_s: 754 })
  })
  it('sin espera conocida: el 429 de siempre, sin Retry-After', async () => {
    const r = demasiadosIntentos(null)
    expect(r.headers.get('retry-after')).toBeNull()
    expect(await r.json()).toEqual({ error: 'demasiados_intentos' })
  })
})

describe('los mensajes de la página dicen cuánto falta, con lo que dijo el servidor', async () => {
  const { cuantoFalta, mensajeDeError } = await import('@/app/reservar/[codigo]/clienteReserva')
  it('espera_reenvio y demasiados_intentos con espera_s', () => {
    expect(mensajeDeError({ status: 429, cuerpo: { error: 'espera_reenvio', espera_s: 18 } })).toBe('Espera 18 s para pedir otro código.')
    expect(mensajeDeError({ status: 429, cuerpo: { error: 'demasiados_intentos', espera_s: 2401 } }))
      .toBe('Demasiados intentos. Podrás volver a probar en 41 min.')
  })
  it('sin espera_s, el texto de siempre (no se inventa un plazo)', () => {
    expect(mensajeDeError({ status: 429, cuerpo: { error: 'demasiados_intentos' } })).toBe('Demasiados intentos. Espera un rato y vuelve a probar.')
  })
  it('el código de un correo anterior', () => {
    expect(mensajeDeError({ status: 400, cuerpo: { error: 'codigo_reemplazado' } })).toBe('Ese código es de un correo anterior. Escribe el del correo más reciente.')
  })
  it('cuantoFalta redondea hacia arriba', () => {
    expect([cuantoFalta(0.2), cuantoFalta(59), cuantoFalta(59.5), cuantoFalta(61), cuantoFalta(3600)]).toEqual(['1 s', '59 s', '1 min', '2 min', '60 min'])
  })
})
