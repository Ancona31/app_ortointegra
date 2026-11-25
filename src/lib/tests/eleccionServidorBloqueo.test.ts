/**
 * eleccionServidorBloqueo.test.ts — Tanda L (L1, punto 6) · `reagendarCita`
 * reconoce el 42501 del disparador del bloqueo (`cita_reagendar_clinica`
 * escribe con service_role y sin `via`, así que la base lo rechaza) y lo
 * devuelve como `bloqueado`, no como un error genérico (que la ruta daría 500).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ error: null as { code: string; hint?: string } | null }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: () => ({ single: async () => (h.error ? { data: null, error: h.error } : { data: { r_resultado: 'ok', r_updated_at: 'x' }, error: null }) }),
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: () => {}, warn: () => {}, info: () => {} } }))

const { reagendarCita } = await import('@/lib/agenda/eleccionServidor')
const R = { clinicaId: 'cl', actorId: 'a', citaId: 'c', consultorioId: 'co', inicio: 'i', fin: 'f', esperado: null }

beforeEach(() => { h.error = null })

describe('reagendarCita y el bloqueo', () => {
  it('el 42501 con el hint del disparador es `bloqueado` (MUTACIÓN: sin la rama)', async () => {
    h.error = { code: '42501', hint: 'agenda_horario_bloqueado' }
    expect(await reagendarCita(R)).toEqual({ tipo: 'bloqueado' })
  })
  it('otro 42501 sigue siendo `error`, y sin error, `hecho`', async () => {
    h.error = { code: '42501' }
    expect(await reagendarCita(R)).toEqual({ tipo: 'error' })
    h.error = null
    expect(await reagendarCita(R)).toEqual({ tipo: 'hecho', resultado: 'ok', updatedAt: 'x' })
  })
})
