/**
 * reservarDespuesSeparado.test.ts — oleada 3, arreglo 1 (orden de Angel):
 * «separa el comprobante al paciente y el correo a la clínica del evento de
 * Google. Que el comprobante no dependa de que Google responda, y que vaya
 * primero.»
 *
 * `after` se simula capturando los callbacks y arrancándolos todos a la vez,
 * como hace Next 16.2.1 (`server/after/after-context.js`: una `p-queue` sin
 * límite de concurrencia, cada callback con su propio `try`). Sin tiempos
 * reales: Google «tarda» con una promesa que no se resuelve nunca.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const ID = '00000000-0000-4000-8000-000000000001'

const h = vi.hoisted(() => ({
  orden: [] as string[],
  callbacks: [] as Array<() => Promise<unknown>>,
  google: 'cuelga' as 'cuelga' | 'lanza',
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }))
vi.mock('next/server', async (original) => {
  const real = await original<typeof import('next/server')>()
  return { ...real, after: (f: () => Promise<unknown>) => { h.callbacks.push(f) } }
})
vi.mock('@/lib/reserva/puertaReserva', async (original) => {
  const real = await original<typeof import('@/lib/reserva/puertaReserva')>()
  return {
    ...real,
    codigoAbrible: () => true,
    abrirEnlace: async () => ({
      codigoHash: 'e'.repeat(64),
      ctx: {
        clinica_id: ID, enlace_id: ID, medico_id: ID, clase: 'fijo', estado: 'vigente',
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
  return { ...real, dentroDeLimites: async () => true, esperaSinContar: async () => 0 }
})
vi.mock('@/lib/reserva/servidorReserva', () => ({
  reservar: async () => ({ ok: true, data: { r_resultado: 'ok', r_cita_id: ID, r_inicio: '2031-05-06T16:00:00Z', r_fin: '2031-05-06T16:30:00Z', r_historial: 0 } }),
  reagendar: async () => ({ ok: false, ausente: true, codigo: null }),
}))
vi.mock('@/lib/reserva/sincronizarReserva', () => ({ sincronizarAntesDeReservar: async () => 'seguir' }))
vi.mock('@/lib/reserva/googleReserva', () => ({
  crearEventoReserva: () => {
    h.orden.push('google')
    return h.google === 'cuelga' ? new Promise<void>(() => undefined) : Promise.reject(new Error('Google caído'))
  },
}))
vi.mock('@/lib/reserva/comprobanteReserva', () => ({ enviarComprobante: async () => { h.orden.push('comprobante') } }))
vi.mock('@/lib/reserva/correoClinicaReserva', () => ({ avisarReservaAClinica: async () => { h.orden.push('clinica') } }))

process.env.RESERVA_SECRETO = 'ab'.repeat(32)
const reservarRuta = await import('@/app/api/reservar/[codigo]/route')

const params = { params: Promise.resolve({ codigo: COD }) }
const RESERVA = {
  consultorio_id: ID, tipo_cita_id: ID, inicio: '2031-05-06T16:00:00.000Z', nombre: 'Ana', telefono: '5512345678',
  correo: 'ana@x.mx', acepta_aviso: true, client_id: ID,
}
const req = (): NextRequest => new NextRequest(`http://localhost:3001/api/reservar/${COD}`, {
  method: 'POST', body: JSON.stringify(RESERVA), headers: { 'content-type': 'application/json' },
})

/** Como `AfterContext.runCallbacks`: todos a la vez, cada uno con su catch. */
async function correrComoNext(): Promise<void> {
  const tareas = h.callbacks.map(f => f().catch(() => undefined))
  // Sólo vaciamos microtareas: una tarea que dependa de Google no termina nunca.
  await Promise.race([Promise.all(tareas), new Promise(r => setImmediate(r))])
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r))
}

beforeEach(() => { h.orden = []; h.callbacks = []; h.google = 'cuelga' })

describe('after() de la reserva: comprobante y correo a la clínica sin depender de Google', () => {
  it('el comprobante es la PRIMERA tarea programada', async () => {
    await reservarRuta.POST(req(), params)
    expect(h.callbacks.length).toBeGreaterThan(0)
    void h.callbacks[0]().catch(() => undefined)
    await new Promise(r => setImmediate(r))
    expect(h.orden[0]).toBe('comprobante')
  })

  it('si Google no responde nunca, salen el comprobante y el correo a la clínica', async () => {
    const r = await reservarRuta.POST(req(), params)
    expect(r.status).toBe(201)
    await correrComoNext()
    expect(h.orden).toContain('comprobante')
    expect(h.orden).toContain('clinica')
    expect(h.orden).toContain('google')
  })

  it('si Google lanza, los otros dos salen igual', async () => {
    h.google = 'lanza'
    await reservarRuta.POST(req(), params)
    await correrComoNext()
    expect(h.orden).toEqual(expect.arrayContaining(['comprobante', 'clinica', 'google']))
  })
})
