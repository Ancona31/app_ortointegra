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
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }))
vi.mock('@/lib/reserva/puertaReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/puertaReserva')>()
  return {
    ...real,
    codigoAbrible: () => h.abrible,
    abrirEnlace: async () => {
      h.orden.push('contexto')
      return {
        codigoHash: 'e'.repeat(64),
        ctx: {
          clinica_id: ID, enlace_id: ID, medico_id: ID, clase: h.clase, estado: 'vigente',
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
  }
})
vi.mock('@/lib/reserva/servidorReserva', () => ({
  ocupacionDeEnlace: async () => { h.orden.push('ocupacion'); return [] },
  reservar: async () => { h.orden.push('rpc'); return { ok: false, ausente: true, codigo: null } },
  reagendar: async () => { h.orden.push('rpc'); return { ok: false, ausente: true, codigo: null } },
  emitirCodigo: async () => { h.orden.push('emitir'); return 'ok' },
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

beforeEach(() => { h.orden = []; h.abrible = true; h.bloquea = new Set(); h.clase = 'fijo' })

describe('rutas públicas de la reserva: límite antes de la base (seg1, punto 8)', () => {
  it('código sin forma (o sin secreto, o aviso sin publicar): 404 sin límites ni base, en las cuatro', async () => {
    h.abrible = false
    expect((await turnos.GET(req('/turnos'), params)).status).toBe(404)
    expect((await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)).status).toBe(404)
    expect((await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)).status).toBe(404)
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(404)
    expect(h.orden).toEqual([])
  })

  it('límite de red pasado: 429 sin abrir el enlace, en las cuatro', async () => {
    h.bloquea = new Set(['ip'])
    expect((await turnos.GET(req('/turnos'), params)).status).toBe(429)
    expect((await codigoRuta.POST(req('/codigo', { correo: 'ana@x.mx' }), params)).status).toBe(429)
    expect((await verificar.POST(req('/verificar', { correo: 'ana@x.mx', codigo: '123456' }), params)).status).toBe(429)
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(429)
    expect(h.orden).toEqual(['limites:turnos:ip', 'limites:codigo:ip,disp', 'limites:verificar:ip', 'limites:reservar:ip,disp'])
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
    expect(h.orden).toEqual(['limites:codigo:ip,disp', 'contexto', 'limites:codigo:correo'])
  })

  it('reservar con el fijo: red antes de la base; el tope del enlace, después (429 sin RPC)', async () => {
    h.bloquea = new Set(['enlace'])
    expect((await reservarRuta.POST(req('', RESERVA), params)).status).toBe(429)
    expect(h.orden).toEqual(['limites:reservar:ip,disp', 'contexto', 'limites:reservar:enlace'])
  })

  it('reservar con el único: sin tope por enlace', async () => {
    h.clase = 'unico'
    await reservarRuta.POST(req('', RESERVA), params)
    expect(h.orden.filter(o => o.startsWith('limites:'))).toEqual(['limites:reservar:ip,disp'])
  })
})
