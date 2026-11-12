import { describe, expect, it, vi } from 'vitest'

/* El cliente de Supabase no se toca en estas pruebas: sólo lo puro. */
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))

import { juntarCitas, limpiarTextoBusqueda, MAX_CITAS, rangoBusqueda, type CitaEncontrada } from '@/lib/agenda/buscarCitasPaciente'

describe('limpiarTextoBusqueda', () => {
  it('quita lo que rompería el filtro .or() de PostgREST y compacta espacios', () => {
    expect(limpiarTextoBusqueda('  Pech,  Ana ')).toBe('Pech Ana')
    expect(limpiarTextoBusqueda('a)(b%c*d\\e"f')).toBe('a b c d e f')
  })
  it('menos de 2 caracteres útiles no busca', () => {
    expect(limpiarTextoBusqueda('a')).toBeNull()
    expect(limpiarTextoBusqueda(' , ')).toBeNull()
  })
  it('conserva acentos y eñes', () => {
    expect(limpiarTextoBusqueda('Núñez')).toBe('Núñez')
  })
})

describe('rangoBusqueda', () => {
  it('desde hace 30 días hasta dentro de un año', () => {
    const r = rangoBusqueda(new Date('2026-11-12T12:00:00Z'))
    expect(r.desde).toBe('2026-10-13T12:00:00.000Z')
    expect(r.hasta).toBe('2027-11-12T12:00:00.000Z')
  })
})

const cita = (id: string, start_time: string): CitaEncontrada => ({
  id, title: id, start_time, end_time: start_time, status: 'scheduled', medico_id: 'm', paciente_id: null,
})

describe('juntarCitas', () => {
  it('sin repetidas, por fecha', () => {
    const r = juntarCitas([cita('b', '2026-11-13'), cita('a', '2026-11-12')], [cita('a', '2026-11-12'), cita('c', '2026-11-11')])
    expect(r.map(c => c.id)).toEqual(['c', 'a', 'b'])
  })
  it('recorta a 20', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => cita(`x${i}`, `2026-11-${String(10 + (i % 18)).padStart(2, '0')}`))
    expect(juntarCitas(muchas, [])).toHaveLength(MAX_CITAS)
  })
})
