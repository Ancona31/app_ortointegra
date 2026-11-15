/**
 * consultoriosAgendaServidor.test.ts — los consultorios con los que se dibuja
 * la agenda v2 se leen con el cliente de servicio, así que el filtro lo pone
 * el código: SIEMPRE la clínica de la sesión, y el alcance de
 * `appointments_select` (administrador y secretaria: todos los de la clínica;
 * médico invitado: sólo los suyos). Sólo horario, zona y dueño. Un error
 * (p. ej. la columna `horario_propio` ausente, producción sin B5) da `null`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  llamadas: [] as string[],
  resultado: { data: [] as unknown[] | null, error: null as { code: string } | null },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const q = {
      from: (t: string) => { h.llamadas.push(`from:${t}`); return q },
      select: (c: string) => { h.llamadas.push(`select:${c}`); return q },
      eq: (c: string, v: unknown) => { h.llamadas.push(`eq:${c}=${String(v)}`); return q },
      then: (ok: (r: typeof h.resultado) => unknown) => Promise.resolve(h.resultado).then(ok),
    }
    return q
  },
}))

import { leerConsultoriosAgenda } from '@/lib/agenda/consultoriosAgendaServidor'

const BASE = { id: 'u1', clinica_id: 'c1', es_admin_de_clinica: false }

describe('leerConsultoriosAgenda', () => {
  beforeEach(() => { h.llamadas = []; h.resultado = { data: [{ id: 'k1' }], error: null } })

  it('el administrador: todos los de SU clínica, sólo horario, zona y dueño', async () => {
    expect(await leerConsultoriosAgenda({ ...BASE, role: 'medico', es_admin_de_clinica: true })).toEqual([{ id: 'k1' }])
    expect(h.llamadas).toEqual(['from:consultorios', 'select:id, medico_id, timezone, horario, horario_propio, activo', 'eq:clinica_id=c1'])
  })

  it('la secretaria: todos los de su clínica', async () => {
    await leerConsultoriosAgenda({ ...BASE, role: 'secretaria' })
    expect(h.llamadas).toContain('eq:clinica_id=c1')
    expect(h.llamadas.some(l => l.startsWith('eq:medico_id'))).toBe(false)
  })

  it('el médico invitado: sólo los suyos, y de su clínica', async () => {
    await leerConsultoriosAgenda({ ...BASE, role: 'medico' })
    expect(h.llamadas).toEqual(expect.arrayContaining(['eq:clinica_id=c1', 'eq:medico_id=u1']))
  })

  it('otro rol (super_admin): ni consulta', async () => {
    expect(await leerConsultoriosAgenda({ ...BASE, role: 'super_admin' })).toBeNull()
    expect(h.llamadas).toEqual([])
  })

  it('un error (columna ausente: producción sin B5) da null y la agenda sigue como antes', async () => {
    h.resultado = { data: null, error: { code: '42703' } }
    expect(await leerConsultoriosAgenda({ ...BASE, role: 'medico', es_admin_de_clinica: true })).toBeNull()
  })
})
