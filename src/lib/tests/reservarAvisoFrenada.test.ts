/**
 * reservarAvisoFrenada.test.ts — avisos globales, hallazgo 3 de la auditoría (el nombre tecleado en
 * `reserva_frenada`): DEMUESTRA, con la ruta real, que el aviso a la clínica con el nombre sólo se
 * registra cuando la persona ENVIÓ el formulario con la casilla del aviso de privacidad marcada
 * (`acepta_aviso: true`), y la reserva salió frenada (`bloqueado` o `ya_tiene_cita`).
 *
 * Todo en dobles: ni base, ni correo, ni Google. `after` captura sus tareas y se corren a mano, como
 * hace Next. `registrarAvisoDelServidor` es el doble que apunta lo que se registró.
 *
 * MUTACIONES (comprobadas en rojo): quitar `acepta_aviso: z.literal(true)` del esquema (sale el aviso
 * sin la casilla); mover la llamada antes del `safeParse` del cuerpo; registrar con `r_resultado: 'ok'`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const ID = '00000000-0000-4000-8000-000000000001'

const h = vi.hoisted(() => ({
  callbacks: [] as Array<() => Promise<unknown>>,
  resultado: 'bloqueado' as string,
  reservas: 0,
  avisos: [] as Array<Record<string, unknown>>,
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
        clinica_id: ID, enlace_id: ID, medico_id: ID, clase: 'unico', estado: 'vigente',
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
  reservar: async () => {
    h.reservas++
    return { ok: true, data: { r_resultado: h.resultado, r_cita_id: h.resultado === 'ok' ? ID : null, r_inicio: null, r_fin: null, r_historial: 0 } }
  },
  reagendar: async () => ({ ok: false, ausente: true, codigo: null }),
}))
vi.mock('@/lib/reserva/sincronizarReserva', () => ({ sincronizarAntesDeReservar: async () => 'seguir' }))
vi.mock('@/lib/reserva/googleReserva', () => ({ crearEventoReserva: async () => undefined }))
vi.mock('@/lib/reserva/comprobanteReserva', () => ({ enviarComprobante: async () => undefined }))
vi.mock('@/lib/reserva/correoClinicaReserva', () => ({ avisarReservaAClinica: async () => undefined }))
vi.mock('@/lib/avisos/avisoDelServidor', () => ({
  registrarAvisoDelServidor: async (a: Record<string, unknown>) => { h.avisos.push(a) },
}))

process.env.RESERVA_SECRETO = 'ab'.repeat(32)
const reservarRuta = await import('@/app/api/reservar/[codigo]/route')

const params = { params: Promise.resolve({ codigo: COD }) }
const BASE = {
  consultorio_id: ID, tipo_cita_id: ID, inicio: '2031-05-06T16:00:00.000Z', nombre: 'Fulano de Tal', telefono: '5512345678',
  correo: 'fulano@x.mx', client_id: ID,
}
function pedir(cuerpo: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3001/api/reservar/${COD}`, {
    method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
  })
}
/** Como `AfterContext.runCallbacks`: todas las tareas, cada una con su catch. */
async function correrDespues(): Promise<void> {
  await Promise.all(h.callbacks.map(f => f().catch(() => undefined)))
}

beforeEach(() => { h.callbacks = []; h.avisos = []; h.reservas = 0; h.resultado = 'bloqueado' })

describe('reserva_frenada: el nombre sólo viaja con la casilla del aviso marcada', () => {
  it('con acepta_aviso: true y la reserva frenada, se registra UNA vez, con el nombre tecleado', async () => {
    await reservarRuta.POST(pedir({ ...BASE, acepta_aviso: true }), params)
    await correrDespues()
    expect(h.reservas).toBe(1)
    expect(h.avisos).toEqual([{ tipo: 'reserva_frenada', clinicaId: ID, medicoId: ID, nombre: 'Fulano de Tal' }])
  })

  it('también cuando la frenó «ya tiene cita»', async () => {
    h.resultado = 'ya_tiene_cita'
    await reservarRuta.POST(pedir({ ...BASE, acepta_aviso: true }), params)
    await correrDespues()
    expect(h.avisos.map(a => a.tipo)).toEqual(['reserva_frenada'])
  })

  it.each([
    ['sin la casilla', {}],
    ['con la casilla en false', { acepta_aviso: false }],
    ['con la casilla como texto', { acepta_aviso: 'true' }],
  ])('%s: 400, ni se intenta la reserva ni se registra nada', async (_caso, extra) => {
    const r = await reservarRuta.POST(pedir({ ...BASE, ...extra }), params)
    await correrDespues()
    expect(r.status).toBe(400)
    expect(h.reservas).toBe(0)
    expect(h.avisos).toEqual([])
  })

  it('una reserva que SALE no deja reserva_frenada', async () => {
    h.resultado = 'ok'
    await reservarRuta.POST(pedir({ ...BASE, acepta_aviso: true }), params)
    await correrDespues()
    expect(h.avisos).toEqual([])
  })
})
