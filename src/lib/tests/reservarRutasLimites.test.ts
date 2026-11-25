/**
 * seg1 (punto 8 de Angel): en las rutas públicas de la reserva por enlace el
 * límite de peticiones va ANTES de la primera consulta a la base
 * (`reserva_contexto`, dentro de `abrirEnlace`). Un código sin forma sigue
 * siendo 404 sin tocar nada; un límite de red pasado es 429 sin abrir el
 * enlace; los límites que necesitan el enlace (el tope del fijo) o el correo
 * van después. Todo en dobles: ni base, ni correo, ni Google.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const ID = '00000000-0000-4000-8000-000000000001'

const h = vi.hoisted(() => ({
  orden: [] as string[],
  abrible: true,
  /** Por sujeto: false = ese límite bloquea. */
  bloquea: new Set<string>(),
  clase: 'fijo' as 'fijo' | 'unico',
  estado: 'vigente' as 'vigente' | 'usado' | 'caducado' | 'agotado',
  /** Agente S: el enlace no abre (404). */
  noAbre: false,
  /** Agente S: lo que contesta `esperaSinContar` (0 = hay sitio). */
  sondeo: 0 as number | null,
  /** K2: lo que contestan `esperaDeLimites` y `esperaReenvio`. */
  espera: null as number | null,
  /** M4: lo que contesta `emitirCodigo` ('ok', o 'limite' si topa el tope de la base). */
  emitido: 'ok' as string,
  reenvio: 0 as number | null,
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }))
vi.mock('@/lib/reserva/puertaReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/puertaReserva')>()
  return {
    ...real,
    codigoAbrible: () => h.abrible,
    abrirEnlace: async () => {
      h.orden.push('contexto')
      if (h.noAbre) return null
      return {
        codigoHash: 'e'.repeat(64),
        ctx: {
          clinica_id: ID, enlace_id: ID, medico_id: ID, clase: h.clase, estado: h.estado,
          medico: { titulo: null, nombres: 'Uno', apellido_paterno: null, apellido_materno: null, especialidad: null, telefono: null },
          clinica: null, consultorios: [], tipos: [], ajustes: { anticipacion_min_horas: 2, horizonte_dias: 60 },
        },
      }
    },
  }
})
vi.mock('@/lib/reserva/limitesReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/limitesReserva')>()
  return {
    ...real,
    seudonimoRed: (s: string) => (s === 'ip' ? 'a' : 'b').repeat(64),
    dentroDeLimites: async (accion: string, s: object) => {
      const sujetos = Object.keys(s).join(',')
      h.orden.push(`limites:${accion}:${sujetos}`)
      return !Object.keys(s).some(k => h.bloquea.has(k))
    },
    esperaDeLimites: async (accion: string, s: object) => { h.orden.push(`espera:${accion}:${Object.keys(s).join(',')}`); return h.espera },
    esperaSinContar: async (accion: string, s: object) => { h.orden.push(`leer:${accion}:${Object.keys(s).join(',')}`); return h.sondeo },
    esperaReenvio: async (ctx: { clinica_id: string; enlace_id: string }) => { h.orden.push(`reenvio:${ctx.enlace_id === ID}`); return h.reenvio },
  }
})
vi.mock('@/lib/reserva/servidorReserva', () => ({
  ocupacionDeEnlace: async () => { h.orden.push('ocupacion'); return [] },
  reservar: async () => { h.orden.push('rpc'); return { ok: false, ausente: true, codigo: null } },
  reagendar: async () => { h.orden.push('rpc'); return { ok: false, ausente: true, codigo: null } },
  emitirCodigo: async () => { h.orden.push('emitir'); return h.emitido },
  verificarCodigo: async () => { h.orden.push('verificar'); return 'incorrecto' },
}))
vi.mock('@/lib/reserva/sincronizarReserva', () => ({ sincronizarAntesDeReservar: async () => 'seguir' }))
vi.mock('@/lib/reserva/googleReserva', () => ({ crearEventoReserva: async () => undefined }))
vi.mock('@/lib/reserva/comprobanteReserva', () => ({ enviarComprobante: async () => undefined }))
vi.mock('@/lib/correo/transporte', () => ({ enviarCorreo: async () => ({ ok: true, modo: 'captura' }) }))

process.env.RESERVA_SECRETO = 'ab'.repeat(32)

const turnos = await import('@/app/api/reservar/[codigo]/turnos/route')
const codigoRuta = await import('@/app/api/reservar/[codigo]/codigo/route')
const verificar = await import('@/app/api/reservar/[codigo]/verificar/route')
const reservarRuta = await import('@/app/api/reservar/[codigo]/route')

const params = { params: Promise.resolve({ codigo: COD }) }
function req(ruta: string, cuerpo?: unknown): NextRequest {
  const url = `http://localhost:3001/api/reservar/${COD}${ruta}`
  return cuerpo === undefined
    ? new NextRequest(`${url}?consultorio=${ID}&tipo=${ID}&desde=2031-05-06`)
    : new NextRequest(url, { method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' } })
}
const RESERVA = {
  consultorio_id: ID, tipo_cita_id: ID, inicio: '2031-05-06T16:00:00.000Z', nombre: 'Ana', telefono: '5512345678',
  correo: 'ana@x.mx', acepta_aviso: true, client_id: ID,
}

beforeEach(() => {
  h.orden = []; h.abrible = true; h.bloquea = new Set(); h.clase = 'fijo'; h.espera = null; h.reenvio = 0
  h.estado = 'vigente'; h.noAbre = false; h.sondeo = 0; h.emitido = 'ok'
})

describe('rutas públicas de la reserva: límite antes de la base (seg1, punto 8)', () => {
  it('código sin forma (o sin secreto, o aviso sin publicar): 404 sin límites ni base, en las cuatro', async () => {
    h.abrible = false
    expect((await turnos.GET(req('/turnos'), params)).status).toBe(404)
    expect((await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)).status).toBe(404)
    expect((await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)).status).toBe(404)
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(404)
    expect(h.orden).toEqual([])
  })

  it('límite de red pasado: 429 sin abrir el enlace, en las cuatro (en reservar, el freno de sondeo leído sin contar)', async () => {
    h.bloquea = new Set(['ip'])
    h.sondeo = 900
    expect((await turnos.GET(req('/turnos'), params)).status).toBe(429)
    expect((await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)).status).toBe(429)
    expect((await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)).status).toBe(429)
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(429)
    expect(h.orden).toEqual(['limites:turnos:ip', 'limites:codigo:ip,disp', 'espera:codigo:ip,disp', 'limites:verificar:ip',
      'espera:verificar:ip', 'leer:sondeo:ip,disp'])
  })

  it('turnos y verificar: IP primero, luego el enlace', async () => {
    await turnos.GET(req('/turnos'), params)
    expect(h.orden.slice(0, 2)).toEqual(['limites:turnos:ip', 'contexto'])
    h.orden = []
    await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)
    expect(h.orden).toEqual(['limites:verificar:ip', 'contexto', 'verificar'])
  })

  it('código: red antes de la base; el del correo, después de abrir el enlace (429 sin emitir)', async () => {
    h.bloquea = new Set(['correo'])
    expect((await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)).status).toBe(429)
    expect(h.orden).toEqual(['limites:codigo:ip,disp', 'contexto', 'reenvio:true', 'limites:codigo:correo'])
  })

  it('reservar con el fijo: sondeo leído antes de la base; IP y dispositivo, y luego el tope del enlace (429 sin RPC)', async () => {
    h.bloquea = new Set(['enlace'])
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(429)
    expect(h.orden).toEqual(['leer:sondeo:ip,disp', 'contexto', 'limites:reservar:ip,disp', 'limites:reservar:enlace', 'espera:reservar:enlace'])
  })

  it('reservar con el fijo: el tope por IP o dispositivo da 429 con su espera, sin RPC', async () => {
    h.bloquea = new Set(['disp'])
    h.espera = 3000
    const r = await reservarRuta.POST(req('', RESERVA), params)
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ error: 'demasiados_intentos', espera_s: 3000 })
    expect(h.orden).toEqual(['leer:sondeo:ip,disp', 'contexto', 'limites:reservar:ip,disp', 'espera:reservar:ip,disp'])
  })

  /* Agente S (orden de Angel, 2026-11-23). MUTACIONES (comprobadas en rojo): contar ip/disp también con el único;
     contar antes de abrir el enlace; no sumar al sondeo lo que no abre; abrir el enlace con el sondeo lleno. */
  it('reservar con el único vigente: ni IP, ni dispositivo, ni tope por enlace; llega a la RPC', async () => {
    h.clase = 'unico'
    h.bloquea = new Set(['ip', 'disp'])
    await reservarRuta.POST(req('', RESERVA), params)
    expect(h.orden.filter(o => o.startsWith('limites:'))).toEqual([])
    expect(h.orden[0]).toBe('leer:sondeo:ip,disp')
  })

  it('un código que no abre: 404 y suma al sondeo (también cuando ese intento lo llena)', async () => {
    h.noAbre = true
    h.bloquea = new Set(['ip'])
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(404)
    expect(h.orden).toEqual(['leer:sondeo:ip,disp', 'contexto', 'limites:sondeo:ip,disp'])
  })

  it('un único usado, caducado o agotado suma al sondeo y sigue a la RPC (410 o repetida, como antes)', async () => {
    h.clase = 'unico'
    for (const estado of ['usado', 'caducado', 'agotado'] as const) {
      h.orden = []
      h.estado = estado
      await reservarRuta.POST(req('', RESERVA), params)
      expect(h.orden.filter(o => o.startsWith('limites:'))).toEqual(['limites:sondeo:ip,disp'])
    }
  })

  it('sondeo lleno o desconocido: 429 a CUALQUIER código sin abrirlo (fijo, único o inexistente, igual)', async () => {
    for (const caso of [{ clase: 'fijo', noAbre: false }, { clase: 'unico', noAbre: false }, { clase: 'unico', noAbre: true }] as const) {
      for (const sondeo of [1200, null]) {
        h.orden = []; h.clase = caso.clase; h.noAbre = caso.noAbre; h.sondeo = sondeo
        const r = await reservarRuta.POST(req('', RESERVA), params)
        expect(r.status).toBe(429)
        expect(await r.json()).toEqual(sondeo ? { error: 'demasiados_intentos', espera_s: 1200 } : { error: 'demasiados_intentos' })
        expect(h.orden).toEqual(['leer:sondeo:ip,disp'])
      }
    }
  })
})

/**
 * K2 (punto 10 de Angel). MUTACIONES (comprobadas en rojo): sin la comprobación
 * de `esperaReenvio` (el segundo código dentro de los 30 s sale y gasta el
 * límite por correo); `reenviar_en` fijo en otra cifra; el 429 sin `espera_s`;
 * el 429 del tope por correo con `esperaDeLimites` (fuga entre enlaces).
 */
describe('rutas públicas de la reserva: cuánto falta (K2, punto 10)', () => {
  it('código enviado: 200 con reenviar_en = los 30 s que impone el servidor', async () => {
    const r = await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ estado: 'enviado', reenviar_en: 30 })
  })
  it('otro código al mismo correo antes de 30 s: 429 espera_reenvio con lo que falta, SIN contar el límite por correo ni emitir', async () => {
    h.reenvio = 18
    const r = await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('18')
    expect(await r.json()).toEqual({ error: 'espera_reenvio', espera_s: 18 })
    // La espera de reenvío se pide con el enlace abierto (por enlace, no por correo global).
    expect(h.orden).toEqual(['limites:codigo:ip,disp', 'contexto', 'reenvio:true'])
  })
  it('un límite de red que topa: 429 con espera_s y Retry-After de la base', async () => {
    h.bloquea = new Set(['disp'])
    h.espera = 2400
    const r = await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)
    expect(r.headers.get('retry-after')).toBe('2400')
    expect(await r.json()).toEqual({ error: 'demasiados_intentos', espera_s: 2400 })
  })
  it('el tope GLOBAL por correo: 429 SIN cuánto falta (el plazo saldría de lo pedido en otros enlaces y clínicas)', async () => {
    h.bloquea = new Set(['correo'])
    h.espera = 2400
    const r = await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBeNull()
    expect(await r.json()).toEqual({ error: 'demasiados_intentos' })
    expect(h.orden).not.toContain('espera:codigo:correo')
  })
  it('el tope de la BASE (M4, AG-DT-274): si la función contesta «limite», 429 SIN cuánto falta y sin mandar correo', async () => {
    h.emitido = 'limite'
    const r = await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBeNull()
    expect(await r.json()).toEqual({ error: 'demasiados_intentos' })
    expect(h.orden).toContain('emitir')
  })
  it('verificar y reservar también: el 429 lleva espera_s y Retry-After', async () => {
    h.bloquea = new Set(['ip'])
    h.espera = 61
    h.sondeo = 61
    const v = await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)
    const r = await reservarRuta.POST(req('', RESERVA), params)
    for (const x of [v, r]) {
      expect(x.headers.get('retry-after')).toBe('61')
      expect(await x.json()).toEqual({ error: 'demasiados_intentos', espera_s: 61 })
    }
  })
})
