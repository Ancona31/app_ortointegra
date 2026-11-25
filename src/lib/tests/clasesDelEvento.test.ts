import { beforeEach, describe, expect, it } from 'vitest'
import type { EventContentArg } from '@fullcalendar/core'
import { clasesDelEvento } from '@/lib/agenda/tarjetasAgenda'
import { podarMarcas, registrarNuevo, vaciarMarcas } from '@/lib/agenda/marcasMovimiento'

/* Comprobación de tipos, sin ejecutarse: lo que FullCalendar pasa a
   `eventClassNames` cumple el parámetro estrechado de `clasesDelEvento`. */
export const _elArgCumple: (a: EventContentArg) => string[] = a => clasesDelEvento(a)

const evento = (id: string, extendedProps: Record<string, unknown> = {}, allDay = false) =>
  ({ event: { id, allDay, extendedProps } })

beforeEach(() => { vaciarMarcas() })

describe('clasesDelEvento · movimiento (F2.4/F2.5)', () => {
  it('sin registro no hay clase de movimiento: abrir y navegar no animan nada', () => {
    expect(clasesDelEvento(evento('a', { status: 'scheduled', paciente_id: 'p' })))
      .toEqual(['ag-ev-status--scheduled'])
  })

  it('la cita registrada como nueva entra con ag-ev-nuevo, además de sus marcadores', () => {
    registrarNuevo('a')
    expect(clasesDelEvento(evento('a', { status: 'scheduled', paciente_id: 'p' })))
      .toEqual(['ag-ev-nuevo', 'ag-ev-status--scheduled'])
  })

  it('la que llega por tiempo real lleva también ag-ev-remoto', () => {
    registrarNuevo('r', { remoto: true })
    expect(clasesDelEvento(evento('r', { paciente_id: 'p' }))).toEqual(['ag-ev-nuevo', 'ag-ev-remoto'])
  })

  it('la baja lleva ag-ev-saliendo mientras se desvanece', () => {
    expect(clasesDelEvento(evento('x', { saliendo: true, paciente_id: 'p' }))).toEqual(['ag-ev-saliendo'])
  })

  it('un evento de Google puede salir, y no recibe los marcadores de estado', () => {
    expect(clasesDelEvento(evento('g', { isGcalBlock: true, saliendo: true }, true)))
      .toEqual(['ag-ev-saliendo', 'ag-ev-allday', 'ag-ev-gcal'])
  })

  it('MUTACIÓN: si la marca apunta a un id que ya estaba pintado, el candado la quita', () => {
    registrarNuevo('a')
    podarMarcas(new Set(['a']), new Set(['a']))
    expect(clasesDelEvento(evento('a', { paciente_id: 'p' }))).toEqual([])
  })
})
