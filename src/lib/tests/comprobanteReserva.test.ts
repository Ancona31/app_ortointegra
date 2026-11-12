/**
 * E5 + E4 (plan_E lista A 4) · el comprobante de la reserva por enlace queda
 * registrado en `cita_correos`: toma con `tipo: 'comprobante'`, se manda al
 * destinatario de la base con `comprobante/<envío>` como llave, y se cierra
 * con el mismo testigo. Sin las RPC de E4 o si la toma falla, sale como en
 * D8 (sin registro); si la base dice que no toca, no sale. Nunca lanza.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Correo, ResultadoEnvio } from '@/lib/correo/transporte'

type Respuesta = { data: unknown; error: { code: string; message: string } | null }
const h = vi.hoisted(() => ({
  llamadas: [] as Array<{ rpc: string; args: Record<string, unknown> }>,
  responder: (() => ({ data: null, error: null })) as (rpc: string) => Respuesta,
  correos: [] as Correo[],
  envio: { ok: true, modo: 'captura' } as ResultadoEnvio,
  enlace: { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' } as { id: string; codigo: string; url: string } | null,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => { throw new Error('no debe usar .from() con el cliente de servicio') },
    rpc: async (rpc: string, args: Record<string, unknown>) => { h.llamadas.push({ rpc, args }); return h.responder(rpc) },
  }),
}))
vi.mock('@/lib/confirmacion/enlaceConfirmacion', () => ({ emitirEnlaceConfirmacion: async () => h.enlace }))
vi.mock('@/lib/correo/transporte', async (original) => ({
  ...(await original<typeof import('@/lib/correo/transporte')>()),
  enviarCorreo: async (c: Correo) => { h.correos.push(c); return h.envio },
}))

const { enviarComprobante } = await import('@/lib/reserva/comprobanteReserva')

const CLINICA = '00000000-0000-4000-8000-00000000e5c1'
const CITA = '00000000-0000-4000-8000-00000000e5a1'
const ENVIO = '00000000-0000-4000-8000-00000000e5e1'
const TOMA = {
  r_envio_id: ENVIO, r_para: 'persona@base.mx', r_inicio: '2031-05-06T16:00:00+00:00', r_fin: '2031-05-06T16:30:00+00:00',
  r_zona: 'America/Merida', r_estado: 'scheduled', r_medico: null, r_consultorio: { nombre: 'C', direccion: null, telefono: null },
}
const ENTRADA = {
  clinicaId: CLINICA, citaId: CITA, correoEscrito: 'Persona@Escrita.mx',
  datos: { medico: 'Dr. X', consultorio: 'C', direccion: null, telefono: null, inicio: '2031-05-06T16:00:00.000Z', zona: 'America/Merida' },
}
const normal = (rpc: string): Respuesta =>
  rpc === 'cita_correo_tomar' ? { data: [TOMA], error: null } : { data: true, error: null }
const de = (rpc: string) => h.llamadas.filter(l => l.rpc === rpc).map(l => l.args)

beforeEach(() => {
  h.llamadas = []; h.correos = []; h.responder = normal; h.envio = { ok: true, modo: 'captura' }
  h.enlace = { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' }
})

describe('enviarComprobante', () => {
  it('toma el comprobante, lo manda al destinatario de la base con su llave y lo cierra enviado con el mismo testigo', async () => {
    await enviarComprobante(ENTRADA)
    const [toma] = de('cita_correo_tomar')
    expect(toma).toMatchObject({ p_clinica_id: CLINICA, p_cita_id: CITA, p_tipo: 'comprobante' })
    expect(h.correos).toHaveLength(1)
    expect(h.correos[0]).toMatchObject({ para: 'persona@base.mx', etiqueta: 'reserva_comprobante', idempotencia: `comprobante/${ENVIO}` })
    expect(h.correos[0]?.texto).toContain('/confirmar/AbCdEfGhIjKlMnOpQrStUv')
    expect(de('cita_correo_marcar')).toEqual([{
      p_clinica_id: CLINICA, p_envio_id: ENVIO, p_testigo: toma?.p_testigo, p_estado: 'enviado', p_motivo: null,
    }])
  })

  it('la base dice que no toca: no sale nada', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: [], error: null } : normal(rpc))
    await enviarComprobante(ENTRADA)
    expect(h.correos).toEqual([])
    expect(de('cita_correo_marcar')).toEqual([])
  })

  it('sin las RPC de E4 o si la toma falla: sale como en D8, al correo escrito, sin llave ni registro', async () => {
    for (const code of ['PGRST202', '40001']) {
      h.correos = []; h.llamadas = []
      h.responder = (rpc) => (rpc === 'cita_correo_tomar' ? { data: null, error: { code, message: 'x' } } : normal(rpc))
      await enviarComprobante(ENTRADA)
      expect(h.correos, code).toHaveLength(1)
      expect(h.correos[0]?.para).toBe('Persona@Escrita.mx')
      expect(h.correos[0]?.idempotencia).toBeUndefined()
      expect(de('cita_correo_marcar')).toEqual([])
    }
  })

  it('el transporte falla: fallido (transporte o duplicado), sin lanzar', async () => {
    h.envio = { ok: false, modo: 'captura', motivo: 'fallo' }
    await enviarComprobante(ENTRADA)
    expect(de('cita_correo_marcar')[0]).toMatchObject({ p_estado: 'fallido', p_motivo: 'transporte' })
    h.llamadas = []
    h.envio = { ok: false, modo: 'resend', motivo: 'duplicado' }
    await enviarComprobante(ENTRADA)
    expect(de('cita_correo_marcar')[0]).toMatchObject({ p_estado: 'fallido', p_motivo: 'duplicado' })
  })

  it('sin enlace de confirmación: el comprobante de D8, marcado enviado', async () => {
    h.enlace = null
    await enviarComprobante(ENTRADA)
    expect(h.correos[0]?.texto).toContain('Para cambiar o cancelar, comunícate con el consultorio')
    expect(de('cita_correo_marcar')[0]).toMatchObject({ p_estado: 'enviado' })
  })

  it('el mismo comprobante es el mismo cuerpo (la llave de idempotencia lo exige)', async () => {
    await enviarComprobante(ENTRADA)
    await enviarComprobante(ENTRADA)
    expect(h.correos[0]).toEqual(h.correos[1])
  })

  it('marcar que falla no lanza', async () => {
    h.responder = (rpc) => (rpc === 'cita_correo_marcar' ? { data: null, error: { code: '40001', message: 'x' } } : normal(rpc))
    await expect(enviarComprobante(ENTRADA)).resolves.toBeUndefined()
  })
})
