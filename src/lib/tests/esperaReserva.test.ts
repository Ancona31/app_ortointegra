/**
 * K2 (punto 10 de Angel): cuánto falta para volver a pedir el código. La
 * espera la calcula la base (`rate_limit_espera`) con la MISMA llave, límite y
 * ventana que cuenta `rate_limit_intento`; los 30 s entre códigos al mismo
 * correo, con la llave del límite por correo y `REENVIO_CODIGO_S`.
 * MUTACIONES (comprobadas en rojo): la ventana en minutos en vez de segundos
 * (`regla[1]` sin `* 60`); `esperaReenvio` con la llave de la IP; `Math.min`
 * en vez de `Math.max`; aceptar una espera negativa de la RPC.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  llamadas: [] as { p_ruta: string; p_limite: number; p_ventana_seg: number }[],
  respuesta: (_ruta: string): { data: unknown; error: { code: string } | null } => ({ data: 0, error: null }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (nombre: string, args: { p_ruta: string; p_limite: number; p_ventana_seg: number }) => {
      if (nombre !== 'rate_limit_espera') throw new Error(`RPC inesperada: ${nombre}`)
      h.llamadas.push(args)
      return h.respuesta(args.p_ruta)
    },
  }),
}))

beforeAll(() => { process.env.RESERVA_SECRETO = 'ab'.repeat(32) })
beforeEach(() => { h.llamadas = []; h.respuesta = () => ({ data: 0, error: null }) })

const { REENVIO_CODIGO_S, esperaDeLimites, esperaReenvio } = await import('@/lib/reserva/limitesReserva')
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

describe('esperaReenvio (30 s entre códigos al mismo correo)', () => {
  it('mira la llave del límite por correo, con límite 1 en REENVIO_CODIGO_S segundos', async () => {
    h.respuesta = () => ({ data: 22, error: null })
    expect(REENVIO_CODIGO_S).toBe(30)
    expect(await esperaReenvio(CORREO)).toBe(22)
    expect(h.llamadas).toEqual([{ p_ruta: `reserva:codigo:correo:${CORREO}`, p_limite: 1, p_ventana_seg: 30 }])
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
