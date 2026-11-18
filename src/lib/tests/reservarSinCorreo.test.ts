/**
 * reservarSinCorreo.test.ts — tanda I, punto 2 de Angel: en el enlace de UN
 * SOLO USO el correo es opcional (basta el teléfono) y sin él no hay
 * comprobante; el FIJO sigue exigiéndolo con el mismo 400 de antes, en el
 * mismo punto (antes del tope por enlace y sin RPC). Todo en dobles: ni base,
 * ni correo, ni Google.
 * Tanda J, punto 3: en el único el correo tecleado se IGNORA (no viaja a la
 * base ni sirve de respaldo del comprobante); el comprobante se intenta
 * siempre y su destinatario lo da sólo la base (el correo del enlace).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const ID = '00000000-0000-4000-8000-000000000001'

const h = vi.hoisted(() => ({
  orden: [] as string[],
  clase: 'unico' as 'fijo' | 'unico',
  args: [] as Array<{ correo: string | null; correoHmac: string | null; telHmac: string | null }>,
  despues: [] as Array<Promise<unknown>>,
  escrito: [] as Array<string | null>,
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }))
vi.mock('next/server', async (original) => {
  const real = await original<typeof import('next/server')>()
  return { ...real, after: (f: () => Promise<unknown>) => { h.despues.push(f()) } }
})
vi.mock('@/lib/reserva/puertaReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/puertaReserva')>()
  return {
    ...real,
    codigoAbrible: () => true,
    abrirEnlace: async () => ({
      codigoHash: 'e'.repeat(64),
      ctx: {
        clinica_id: ID, enlace_id: ID, medico_id: ID, clase: h.clase, estado: 'vigente',
        medico: { titulo: null, nombres: 'Uno', apellido_paterno: null, apellido_materno: null, especialidad: null, telefono: null },
        clinica: null,
        consultorios: [{ id: ID, nombre: 'Centro', direccion: 'Calle 1', telefono: null, timezone: 'America/Mexico_City' }],
        tipos: [{ id: ID, nombre: 'Primera vez', duracion_min: 30, consultorio_ids: null }],
        ajustes: { anticipacion_min_horas: 2, horizonte_dias: 60 },
      },
    }),
  }
})
vi.mock('@/lib/agenda/tiposPorConsultorio', () => ({ tiposDelConsultorio: (t: unknown[]) => t }))
vi.mock('@/lib/reserva/turnosReserva', () => ({ reglasDe: () => ({}), turnoValido: (_r: unknown, inicio: string) => ({ inicio }) }))
vi.mock('@/lib/reserva/limitesReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/limitesReserva')>()
  return {
    ...real,
    dentroDeLimites: async (accion: string, s: object) => { h.orden.push(`limites:${accion}:${Object.keys(s).join(',')}`); return true },
  }
})
vi.mock('@/lib/reserva/servidorReserva', () => ({
  reservar: async (_ctx: unknown, a: { correo: string | null; correoHmac: string | null; telHmac: string | null }) => {
    h.orden.push('rpc'); h.args.push(a)
    return { ok: true, data: { r_resultado: 'ok', r_cita_id: ID, r_inicio: '2031-05-06T16:00:00Z', r_fin: '2031-05-06T16:30:00Z', r_historial: 0 } }
  },
  reagendar: async () => ({ ok: false, ausente: true, codigo: null }),
}))
vi.mock('@/lib/reserva/sincronizarReserva', () => ({ sincronizarAntesDeReservar: async () => 'seguir' }))
vi.mock('@/lib/reserva/googleReserva', () => ({ crearEventoReserva: async () => { h.orden.push('google') } }))
vi.mock('@/lib/reserva/comprobanteReserva', () => ({
  enviarComprobante: async (c: { correoEscrito: string | null }) => { h.orden.push('comprobante'); h.escrito.push(c.correoEscrito) },
}))

process.env.RESERVA_SECRETO = 'ab'.repeat(32)
const reservarRuta = await import('@/app/api/reservar/[codigo]/route')

const params = { params: Promise.resolve({ codigo: COD }) }
const req = (cuerpo: unknown): NextRequest => new NextRequest(`http://localhost:3001/api/reservar/${COD}`, {
  method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
})
const RESERVA = {
  consultorio_id: ID, tipo_cita_id: ID, inicio: '2031-05-06T16:00:00.000Z', nombre: 'Ana', telefono: '5512345678',
  correo: 'ana@x.mx', acepta_aviso: true, client_id: ID,
}
const { correo: _quitado, ...SIN_CORREO } = RESERVA

beforeEach(() => { h.orden = []; h.args = []; h.despues = []; h.escrito = []; h.clase = 'unico' })

describe('reservar sin correo (I, punto 2)', () => {
  it('único sin correo: reserva con correo y hmac en null (decide el teléfono); el comprobante, sólo si la base tiene a quién', async () => {
    expect(_quitado).toBe('ana@x.mx')
    const r = await reservarRuta.POST(req(SIN_CORREO), params)
    await Promise.all(h.despues)
    expect(r.status).toBe(201)
    expect(h.args).toHaveLength(1)
    expect(h.args[0].correo).toBeNull()
    expect(h.args[0].correoHmac).toBeNull()
    expect(h.args[0].telHmac).toMatch(/^[0-9a-f]{64}$/)
    expect(h.orden).toEqual(['limites:reservar:ip,disp', 'rpc', 'google', 'comprobante'])
    expect(h.escrito).toEqual([null])
  })

  it('único con correo TECLEADO (J, punto 3): se ignora; ni a la base ni de respaldo del comprobante', async () => {
    const r = await reservarRuta.POST(req(RESERVA), params)
    await Promise.all(h.despues)
    expect(r.status).toBe(201)
    expect(h.args[0].correo).toBeNull()
    expect(h.args[0].correoHmac).toBeNull()
    expect(h.orden).toEqual(['limites:reservar:ip,disp', 'rpc', 'google', 'comprobante'])
    expect(h.escrito).toEqual([null])
  })

  it('único con un correo tecleado sin forma: no es 400 (ni se mira)', async () => {
    const r = await reservarRuta.POST(req({ ...RESERVA, correo: 'no-es-correo' }), params)
    expect(r.status).toBe(201)
  })

  it('fijo sin correo: el 400 de siempre, antes del tope por enlace y sin RPC', async () => {
    h.clase = 'fijo'
    const r = await reservarRuta.POST(req(SIN_CORREO), params)
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: 'solicitud_invalida' })
    expect(h.orden).toEqual(['limites:reservar:ip,disp'])
  })

  it('fijo con correo: sigue llegando con su hmac (la base exige la ficha)', async () => {
    h.clase = 'fijo'
    await reservarRuta.POST(req(RESERVA), params)
    expect(h.orden.slice(0, 3)).toEqual(['limites:reservar:ip,disp', 'limites:reservar:enlace', 'rpc'])
    expect(h.args[0].correoHmac).toMatch(/^[0-9a-f]{64}$/)
    await Promise.all(h.despues)
    expect(h.escrito).toEqual(['ana@x.mx'])
  })
})
