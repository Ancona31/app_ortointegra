/**
 * Lo que `InteraccionesV2.tsx` decide sin pintar nada (bloque F, F3): esperar
 * a que la cita elegida en el buscador esté pintada antes de abrir su tarjeta.
 * Sin DOM: el calendario es un objeto con `on`/`off`/`getEventById` y el
 * temporizador, el falso de Vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventApi } from '@fullcalendar/core'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))

import { esperarEvento, type CalendarApiV2 } from '@/components/agenda/InteraccionesV2'

function calendario(): { api: CalendarApiV2; pintar: (id: string) => void; oyentes: () => number } {
  const pintados = new Map<string, EventApi>()
  let oyentes: (() => void)[] = []
  const api = {
    getEventById: (id: string) => pintados.get(id) ?? null,
    on: (_: string, f: () => void) => { oyentes.push(f) },
    off: (_: string, f: () => void) => { oyentes = oyentes.filter(x => x !== f) },
  }
  return {
    api: api as unknown as CalendarApiV2,
    pintar: (id) => { pintados.set(id, { id } as unknown as EventApi); oyentes.forEach(f => f()) },
    oyentes: () => oyentes.length,
  }
}

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('esperarEvento', () => {
  it('si ya está pintada, la entrega al momento y no se queda escuchando', () => {
    const c = calendario()
    c.pintar('a')
    const alLlegar = vi.fn()
    esperarEvento(c.api, 'a', alLlegar)
    expect(alLlegar).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    expect(c.oyentes()).toBe(0)
  })
  it('si llega después (la traída de la semana nueva), la entrega entonces y suelta el oyente', () => {
    const c = calendario()
    const alLlegar = vi.fn()
    esperarEvento(c.api, 'b', alLlegar)
    c.pintar('otra')
    expect(alLlegar).not.toHaveBeenCalled()
    c.pintar('b')
    expect(alLlegar).toHaveBeenCalledTimes(1)
    expect(c.oyentes()).toBe(0)
  })
  it('si no llega (el filtro la esconde, se borró), avisa con null y no deja nada colgado', () => {
    const c = calendario()
    const alLlegar = vi.fn()
    esperarEvento(c.api, 'c', alLlegar)
    vi.advanceTimersByTime(6000)
    expect(alLlegar).toHaveBeenCalledWith(null)
    expect(c.oyentes()).toBe(0)
  })
  it('la limpieza (otra búsqueda, desmontaje) cancela la espera', () => {
    const c = calendario()
    const alLlegar = vi.fn()
    const limpiar = esperarEvento(c.api, 'd', alLlegar)
    limpiar()
    c.pintar('d')
    vi.advanceTimersByTime(6000)
    expect(alLlegar).not.toHaveBeenCalled()
  })
})
