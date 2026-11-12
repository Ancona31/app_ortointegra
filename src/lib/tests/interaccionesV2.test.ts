/**
 * Lo que `InteraccionesV2.tsx` decide sin pintar nada (bloque F, F3): esperar
 * a que la cita elegida en el buscador esté pintada antes de abrir su tarjeta.
 * Sin DOM: el calendario es un objeto con `on`/`off`/`getEventById` y el
 * temporizador, el falso de Vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventApi } from '@fullcalendar/core'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))

import { ejecutarAtajo, esperarEvento, type CalendarApiV2, type PropsInteraccionesV2 } from '@/components/agenda/InteraccionesV2'
import { ATAJOS } from '@/lib/agenda/atajosAgenda'

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

describe('ejecutarAtajo: cada tecla hace lo que su botón', () => {
  function montar(isMobile = false) {
    const api = { today: vi.fn(), next: vi.fn(), prev: vi.fn() }
    const p = {
      calendarRef: { current: { getApi: () => api } }, isMobile,
      onVista: vi.fn(), onAgendar: vi.fn(),
    } as unknown as PropsInteraccionesV2
    const lupa = { click: vi.fn() }
    vi.stubGlobal('document', { querySelector: (sel: string) => (sel === '[data-buscar-citas]' ? lupa : null) })
    return { api, p, lupa, abrirAyuda: vi.fn() }
  }
  it('navegación: hoy, siguiente y anterior', () => {
    const m = montar()
    ejecutarAtajo('hoy', m.p, m.abrirAyuda)
    ejecutarAtajo('siguiente', m.p, m.abrirAyuda)
    ejecutarAtajo('anterior', m.p, m.abrirAyuda)
    expect([m.api.today, m.api.next, m.api.prev].map(f => f.mock.calls.length)).toEqual([1, 1, 1])
  })
  it('las vistas pasan por `cambiarVista` con el formato del ancho', () => {
    const escritorio = montar(false)
    ejecutarAtajo('vista-dia', escritorio.p, escritorio.abrirAyuda)
    ejecutarAtajo('vista-semana', escritorio.p, escritorio.abrirAyuda)
    ejecutarAtajo('vista-mes', escritorio.p, escritorio.abrirAyuda)
    expect(vi.mocked(escritorio.p.onVista).mock.calls).toEqual([['timeGridDay'], ['timeGridWeek'], ['dayGridMonth']])
    const telefono = montar(true)
    ejecutarAtajo('vista-semana', telefono.p, telefono.abrirAyuda)
    expect(telefono.p.onVista).toHaveBeenCalledWith('listWeek')
  })
  it('agendar, buscar (pulsa la lupa) y ayuda', () => {
    const m = montar()
    ejecutarAtajo('agendar', m.p, m.abrirAyuda)
    ejecutarAtajo('buscar', m.p, m.abrirAyuda)
    ejecutarAtajo('ayuda', m.p, m.abrirAyuda)
    expect(m.p.onAgendar).toHaveBeenCalledTimes(1)
    expect(m.lupa.click).toHaveBeenCalledTimes(1)
    expect(m.abrirAyuda).toHaveBeenCalledTimes(1)
  })
  it('ninguna acción de la tabla se queda sin hacer nada', () => {
    for (const { accion } of ATAJOS) {
      const m = montar()
      ejecutarAtajo(accion, m.p, m.abrirAyuda)
      const llamadas = [m.api.today, m.api.next, m.api.prev, m.p.onVista, m.p.onAgendar, m.lupa.click, m.abrirAyuda]
        .reduce((n, f) => n + vi.mocked(f).mock.calls.length, 0)
      expect(llamadas, accion).toBe(1)
    }
  })
})
