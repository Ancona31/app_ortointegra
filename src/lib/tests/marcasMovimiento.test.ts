import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Calendar } from '@fullcalendar/core'
import {
  clasesDeMovimiento, podarMarcas, registrarNuevo, salirConAnimacion, vaciarMarcas, VIDA_MARCA_MS,
  type ApiSalida, type EventoSalida,
} from '@/lib/agenda/marcasMovimiento'

/* Comprobación de tipos, sin ejecutarse: el `Calendar` real de FullCalendar cumple el contrato. */
export const _laApiCumple: (api: Calendar) => ApiSalida = api => api

const T0 = 1_000_000

beforeEach(() => { vaciarMarcas() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('registrar y caducar', () => {
  it('sin registro, ninguna clase: la primera carga y la navegación no animan nada', () => {
    expect(clasesDeMovimiento('a', {}, T0)).toEqual([])
  })
  it('lo registrado entra con ag-ev-nuevo hasta que caduca', () => {
    registrarNuevo('a', { ahora: T0 })
    expect(clasesDeMovimiento('a', {}, T0 + 10)).toEqual(['ag-ev-nuevo'])
    expect(clasesDeMovimiento('a', {}, T0 + VIDA_MARCA_MS)).toEqual([])
  })
  it('lo remoto lleva además ag-ev-remoto (el anillo)', () => {
    registrarNuevo('r', { remoto: true, ahora: T0 })
    expect(clasesDeMovimiento('r', {}, T0 + 1)).toEqual(['ag-ev-nuevo', 'ag-ev-remoto'])
  })
  it('la cita real que sustituye a la optimista NO hereda la marca', () => {
    registrarNuevo('tmp-1', { ahora: T0 })
    expect(clasesDeMovimiento('uuid-real', {}, T0 + 50)).toEqual([])
  })
})

describe('podarMarcas', () => {
  it('quita las marcas de ids que ya no están', () => {
    registrarNuevo('a', { ahora: T0 })
    podarMarcas(new Set(['b']), new Set(), T0 + 1)
    expect(clasesDeMovimiento('a', {}, T0 + 2)).toEqual([])
  })
  it('conserva la marca de un id que acaba de llegar', () => {
    registrarNuevo('a', { ahora: T0 })
    podarMarcas(new Set(['a', 'b']), new Set(['b']), T0 + 1)
    expect(clasesDeMovimiento('a', {}, T0 + 2)).toEqual(['ag-ev-nuevo'])
  })
  it('CANDADO: una marca sobre un id que ya estaba antes se descarta', () => {
    registrarNuevo('a', { ahora: T0 })
    podarMarcas(new Set(['a']), new Set(['a']), T0 + 1)
    expect(clasesDeMovimiento('a', {}, T0 + 2)).toEqual([])
  })
  it('quita las caducadas', () => {
    registrarNuevo('a', { ahora: T0 })
    podarMarcas(new Set(['a']), new Set(), T0 + VIDA_MARCA_MS + 1)
    registrarNuevo('b', { ahora: T0 + VIDA_MARCA_MS + 1 })
    expect(clasesDeMovimiento('a', {}, T0)).toEqual([])
  })
})

/** Un almacén de eventos de juguete con la forma de CalendarApi. */
function almacen(ids: string[]): { api: ApiSalida; eventos: Map<string, EventoSalida>; contador: { batches: number } } {
  const eventos = new Map<string, EventoSalida>()
  const contador = { batches: 0 }
  const crear = (id: string): EventoSalida => {
    const ev: EventoSalida = {
      extendedProps: {},
      setExtendedProp: (k, v) => { ev.extendedProps[k] = v },
      setProp: () => undefined,
      remove: () => { eventos.delete(id) },
    }
    return ev
  }
  for (const id of ids) eventos.set(id, crear(id))
  const api: ApiSalida = { batchRendering: fn => { contador.batches++; fn() }, getEventById: id => eventos.get(id) ?? null }
  return { api, eventos, contador }
}

describe('salirConAnimacion', () => {
  it('marca, espera --ag-dur-micro y quita', () => {
    vi.useFakeTimers()
    const a = almacen(['x'])
    expect(salirConAnimacion(a.api, 'x')).toBe(120)
    expect(a.contador.batches).toBe(1)
    expect(clasesDeMovimiento('x', a.eventos.get('x')?.extendedProps ?? {})).toContain('ag-ev-saliendo')
    vi.advanceTimersByTime(119)
    expect(a.eventos.has('x')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(a.eventos.has('x')).toBe(false)
  })
  it('si una traída lo sustituyó entretanto, no toca el nuevo', () => {
    vi.useFakeTimers()
    const a = almacen(['x'])
    salirConAnimacion(a.api, 'x')
    const nuevo = almacen(['x']).eventos.get('x')
    if (nuevo) a.eventos.set('x', nuevo)
    vi.advanceTimersByTime(200)
    expect(a.eventos.has('x')).toBe(true)
  })
  it('MUTACIÓN: con movimiento reducido quita al instante', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const a = almacen(['x'])
    expect(salirConAnimacion(a.api, 'x')).toBe(0)
    expect(a.eventos.has('x')).toBe(false)
  })
  it('sin evento no hace nada', () => {
    const a = almacen([])
    expect(salirConAnimacion(a.api, 'x')).toBe(0)
    expect(a.contador.batches).toBe(0)
  })
})
