/**
 * E6 · «Elegir otro horario» en la página de confirmación: sólo para una cita
 * cancelada por el paciente; el enlace fijo sólo si la base lo ofrece y ABRE
 * de verdad, de la misma clínica, vigente y con consultorios y tipos; si no,
 * «comunícate». RPC caída o ausente: «comunícate», sin lanzar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'

const ENLACE = '00000000-0000-4000-8000-0000000000e1'
const CLINICA = '00000000-0000-4000-8000-000000000001'
const h = vi.hoisted(() => ({
  rpc: { data: null as unknown, error: null as unknown },
  llamadas: [] as unknown[],
  abierto: null as unknown,
  lanza: false,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (nombre: string, args: unknown) => {
      h.llamadas.push([nombre, args])
      if (h.lanza) throw new Error('red')
      return { single: async () => h.rpc }
    },
  }),
}))
vi.mock('@/lib/reserva/puertaReserva', () => ({ abrirEnlace: async () => h.abierto }))

beforeEach(() => { process.env.RESERVA_SECRETO = 'ab'.repeat(32) })

const { ofertaReagendar } = await import('@/lib/confirmacion/reagendarConfirmacion')
const { codigoDeEnlace } = await import('@/lib/reserva/secretos')

const CTX: ContextoConfirmacion = {
  clinica_id: CLINICA, estado: 'cancelada', inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T16:30:00.000Z',
  zona: 'America/Merida', medico: null, consultorio: { nombre: 'C', direccion: null, telefono: null },
  puede_confirmar: false, puede_cancelar: false, corte_cancelar: '2031-05-06T15:00:00.000Z', respuesta: 'cancelo',
  codigo_hash: 'a'.repeat(64),
}
const COD = 'AbCdEfGhIjKlMnOpQrSt_-'
const abierto = (o: Record<string, unknown> = {}) => ({
  ctx: { clinica_id: CLINICA, estado: 'vigente', consultorios: [{ id: 'k' }], tipos: [{ id: 't' }], ...o }, codigoHash: 'x',
})

beforeEach(() => {
  h.rpc = { data: { r_enlace_id: ENLACE, r_motivo: 'ok' }, error: null }
  h.llamadas = []; h.abierto = abierto(); h.lanza = false
})

describe('ofertaReagendar', () => {
  it('no aplica si la cita no la canceló el paciente, sin llamar a la base', async () => {
    expect(await ofertaReagendar({ ...CTX, estado: 'agendada' }, COD)).toBeNull()
    expect(await ofertaReagendar({ ...CTX, respuesta: 'confirmo' }, COD)).toBeNull()
    expect(h.llamadas).toEqual([])
  })

  it('ok: el enlace fijo del médico con ?origen=<código de confirmación>, con la clínica del contexto', async () => {
    expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'enlace', href: `/reservar/${codigoDeEnlace(ENLACE)}?origen=${COD}` })
    expect(h.llamadas).toEqual([['cita_reagendar_oferta', { p_clinica_id: CLINICA, p_codigo_hash: CTX.codigo_hash }]])
  })

  it('ya reagendada se dice; tope, sin enlace, vencida o no_aplica: «comunícate»', async () => {
    h.rpc = { data: { r_enlace_id: null, r_motivo: 'ya_reagendada' }, error: null }
    expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'ya_reagendada' })
    for (const m of ['tope', 'sin_enlace', 'vencida', 'no_aplica']) {
      h.rpc = { data: { r_enlace_id: null, r_motivo: m }, error: null }
      expect(await ofertaReagendar(CTX, COD), m).toEqual({ tipo: 'comunicate' })
    }
  })

  it('el fijo que no abre, de otra clínica, no vigente o sin consultorios o tipos: «comunícate»', async () => {
    for (const a of [null, abierto({ clinica_id: 'otra' }), abierto({ estado: 'usado' }), abierto({ consultorios: [] }), abierto({ tipos: [] })]) {
      h.abierto = a
      expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'comunicate' })
    }
  })

  it('RPC ausente, con forma rara o que lanza: «comunícate», sin lanzar', async () => {
    h.rpc = { data: null, error: { code: 'PGRST202' } }
    expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'comunicate' })
    h.rpc = { data: { raro: 1 }, error: null }
    expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'comunicate' })
    h.lanza = true
    expect(await ofertaReagendar(CTX, COD)).toEqual({ tipo: 'comunicate' })
  })
})
