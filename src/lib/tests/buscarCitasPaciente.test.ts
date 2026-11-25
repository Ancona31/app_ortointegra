import { describe, expect, it, vi } from 'vitest'

/* Sin red: el cliente de Supabase es un constructor falso que apunta cada
   llamada (T1: así se ve cuántos `.or()` salen y con qué). */
const h = vi.hoisted(() => ({ llamadas: [] as [string, unknown[]][] }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'neq', 'or', 'order']) b[m] = (...a: unknown[]) => { h.llamadas.push([m, a]); return b }
    b.limit = (...a: unknown[]) => { h.llamadas.push(['limit', a]); return Promise.resolve({ data: [], error: null }) }
    return b
  },
}))

import {
  buscarPacientes, juntarCitas, limpiarTextoBusqueda, MAX_CITAS, palabrasDeBusqueda, patronSinAcentos, rangoBusqueda,
  type CitaEncontrada,
} from '@/lib/agenda/buscarCitasPaciente'

/** Lo que haría `~*` de Postgres con el patrón (sin mirar mayúsculas), para probarlo sin base. */
const casa = (patron: string, valor: string): boolean => new RegExp(patron, 'i').test(valor)

describe('T1 · búsqueda de pacientes palabra a palabra, sin acentos ni mayúsculas', () => {
  it('parte en palabras sin acentos y en minúsculas; lo que no es letra ni dígito separa', () => {
    expect(palabrasDeBusqueda('  Hugo   Interián ')).toEqual(['hugo', 'interian'])
    expect(palabrasDeBusqueda('NÚÑEZ-Pech o\'Brien')).toEqual(['nunez', 'pech', 'o', 'brien'])
    expect(palabrasDeBusqueda('uno dos tres cuatro cinco seis')).toHaveLength(5)
  })
  it('el patrón casa con y sin acento, en cualquier caja, y sólo lleva letras, dígitos y corchetes', () => {
    const p = patronSinAcentos('interian')
    expect(p).toMatch(/^[\p{L}0-9[\]]+$/u)
    for (const v of ['Interián Canché', 'INTERIAN', 'interian', 'InterIÁn']) expect(casa(p, v)).toBe(true)
    expect(casa(patronSinAcentos('nunez'), 'Núñez')).toBe(true)
    expect(casa(patronSinAcentos('hugo'), 'Interián Canché')).toBe(false)
  })
  it('un .or() por palabra (PostgREST los junta con AND), cada uno con nombre O apellidos', async () => {
    h.llamadas = []
    await buscarPacientes('Hugo Interián')
    const ors = h.llamadas.filter(([m]) => m === 'or').map(([, a]) => a[0])
    expect(ors).toEqual([
      `nombre.imatch."${patronSinAcentos('hugo')}",apellidos.imatch."${patronSinAcentos('hugo')}"`,
      `nombre.imatch."${patronSinAcentos('interian')}",apellidos.imatch."${patronSinAcentos('interian')}"`,
    ])
    expect(h.llamadas.find(([m]) => m === 'neq')?.[1]).toEqual(['activo', false])
  })
  it('texto corto: no consulta', async () => {
    h.llamadas = []
    expect(await buscarPacientes('a')).toEqual([])
    expect(h.llamadas).toEqual([])
  })
})

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
