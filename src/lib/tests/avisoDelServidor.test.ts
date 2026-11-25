/**
 * Avisos globales, paso 5 · el aviso que deja el servidor (`registrarAvisoDelServidor`) y sus dos
 * sitios de llamada. MUTACIONES (comprobadas en rojo): pasar el nombre en `personal_movio`; relanzar
 * el error de la RPC; avisar de la reserva frenada antes de responder (sin `after`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({ llamadas: [] as { fn: string; args: Record<string, unknown> }[], error: null as { code: string } | null, lanza: false }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (h.lanza) throw new Error('sin red')
      h.llamadas.push({ fn, args })
      return { data: true, error: h.error }
    },
  }),
}))
const { registrarAvisoDelServidor } = await import('@/lib/avisos/avisoDelServidor')
const { logger } = await import('@/lib/logger')
const leer = (ruta: string): string => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8')

beforeEach(() => { h.llamadas.length = 0; h.error = null; h.lanza = false })

describe('registrarAvisoDelServidor', () => {
  it('reserva frenada: clínica, médico y el nombre tecleado; ni cita ni actor', async () => {
    await registrarAvisoDelServidor({ tipo: 'reserva_frenada', clinicaId: 'c1', medicoId: 'm1', nombre: 'Fulano de Tal' })
    expect(h.llamadas).toEqual([{ fn: 'aviso_clinica_registrar', args: {
      p_clinica_id: 'c1', p_tipo: 'reserva_frenada', p_cita_id: null, p_medico_id: 'm1', p_actor_id: null, p_nombre: 'Fulano de Tal' } }])
  })
  it('«Reagendar» del personal: clínica, cita y actor; sin nombre de nadie', async () => {
    await registrarAvisoDelServidor({ tipo: 'personal_movio', clinicaId: 'c1', citaId: 'a1', actorId: 'u1' })
    expect(h.llamadas[0].args).toEqual({ p_clinica_id: 'c1', p_tipo: 'personal_movio', p_cita_id: 'a1', p_medico_id: null, p_actor_id: 'u1', p_nombre: null })
  })
  it('nunca lanza; sin M1 (PGRST202) calla; otro error deja un aviso en el log sin datos de nadie', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    h.error = { code: 'PGRST202' }
    await registrarAvisoDelServidor({ tipo: 'reserva_frenada', clinicaId: 'c1', medicoId: 'm1', nombre: 'Fulano' })
    expect(warn).not.toHaveBeenCalled()
    h.error = { code: '42501' }
    await registrarAvisoDelServidor({ tipo: 'reserva_frenada', clinicaId: 'c1', medicoId: 'm1', nombre: 'Fulano' })
    h.lanza = true
    await expect(registrarAvisoDelServidor({ tipo: 'personal_movio', clinicaId: 'c1', citaId: 'a1', actorId: 'u1' })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Fulano')
    warn.mockRestore()
  })
})

describe('sitios de llamada', () => {
  it('la reserva frenada avisa DESPUÉS de responder y sólo con bloqueado o ya_tiene_cita, con la clínica del enlace', () => {
    const ruta = leer('app/api/reservar/[codigo]/route.ts')
    expect(ruta).toContain("if (r.data.r_resultado === 'bloqueado' || r.data.r_resultado === 'ya_tiene_cita') {")
    expect(ruta).toContain("after(() => registrarAvisoDelServidor({ tipo: 'reserva_frenada', clinicaId: ctx.clinica_id, medicoId: ctx.medico_id, nombre: b.nombre }))")
  })
  it('«Reagendar» avisa sólo si quien mueve NO es el médico de la cita, con la clínica de la sesión', () => {
    const ruta = leer('app/api/appointments/[id]/reagendar/route.ts')
    expect(ruta).toContain('if (cita.medico_id && cita.medico_id !== e.perfil.id) {')
    expect(ruta).toContain("after(() => registrarAvisoDelServidor({ tipo: 'personal_movio', clinicaId: e.clinicaId, citaId: id, actorId: e.perfil.id }))")
  })
})
