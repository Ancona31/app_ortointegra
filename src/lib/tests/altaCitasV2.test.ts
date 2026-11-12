/**
 * El ENRUTADO de las interacciones v2 (bloque F, F3) en `altaCitas.ts`: qué
 * abre cada gesto con el interruptor apagado (lo de hoy: el modal) y encendido
 * (la burbuja o la tarjeta), y que lo de antes —bloqueo de suscripción, aviso
 * de fuera de horario, banda de todo el día— siga en su sitio.
 *
 * Sin DOM (Vitest corre en `node`): `Element` y `document` se simulan con lo
 * mínimo que lee `altaCitas` (`closest`, `getBoundingClientRect`,
 * `activeElement`, `querySelector`). Los argumentos de FullCalendar son
 * objetos parciales con `as unknown as`, como en `agendaMovida.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { DateSelectArg, EventApi, EventClickArg } from '@fullcalendar/core'
import { crearAltaCitas } from '@/app/(app)/agenda/altaCitas'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import type { ApiInteraccionesV2, SeleccionDesdeHueco } from '@/lib/agenda/contratosV2'
import type { SubscriptionState } from '@/lib/subscription'
import type { ResumenDia } from '@/lib/agenda/huecosAgenda'

/** Un elemento de mentira: dentro de qué clases está y qué caja mide. */
class ElementoFalso {
  constructor(private clases: string[], private caja = { left: 100, top: 200, width: 120, height: 80 }) {}
  closest(sel: string): ElementoFalso | null {
    return sel.split(',').map(x => x.trim().slice(1)).some(c => this.clases.includes(c)) ? this : null
  }
  getBoundingClientRect() { return this.caja }
  /** Cuántas veces se enfocó (la tarjeta de lectura enfoca la cita antes de abrirse). */
  enfocada = 0
  focus(): void { this.enfocada += 1 }
}

/* Miércoles 11 de noviembre de 2026, hora local del navegador. */
const D = (h: number, m = 0, dia = 11) => new Date(2026, 10, dia, h, m)

interface Montaje {
  setModal: ReturnType<typeof vi.fn>
  setConfirm: ReturnType<typeof vi.fn>
  openBloqueoModal: ReturnType<typeof vi.fn>
  api: { abrirBurbuja: ReturnType<typeof vi.fn>; abrirTarjeta: ReturnType<typeof vi.fn> }
  alta: ReturnType<typeof crearAltaCitas>
  seleccion: SeleccionDesdeHueco
  select: ReturnType<typeof vi.fn>
}

function montar(o: { agendaV2: boolean; conChunk?: boolean; bloqueada?: boolean }): Montaje {
  const setModal = vi.fn()
  const setConfirm = vi.fn()
  const openBloqueoModal = vi.fn()
  const api = { abrirBurbuja: vi.fn(), abrirTarjeta: vi.fn(), irACita: vi.fn(), abrirAyuda: vi.fn() }
  const seleccion: SeleccionDesdeHueco = { current: null }
  /* `api.select()` dispara `select` en el acto, como el real. */
  const select = vi.fn((inicio: Date, fin: Date) => alta.handleSelect(argSelect(inicio, fin, null)))
  const calendarRef = { current: { getApi: () => ({ select }) } }
  const alta = crearAltaCitas({
    calendarRef: calendarRef as unknown as Parameters<typeof crearAltaCitas>[0]['calendarRef'],
    isMobile: false, setDiaSel: vi.fn(),
    subState: { isBlocked: o.bloqueada === true } as unknown as SubscriptionState,
    openBloqueoModal, horario: HORARIO_DEFAULT, setModal, setConfirm,
    resumenDia: { dia: D(0) } as unknown as ResumenDia, citasIncompletas: false,
    agendaV2: o.agendaV2,
    interacciones: { current: o.conChunk === false ? null : (api satisfies ApiInteraccionesV2) },
    seleccionDesdeHueco: seleccion,
  })
  return { setModal, setConfirm, openBloqueoModal, api, alta, seleccion, select }
}

const raton = (x: number, y: number, target: unknown = null) => ({ clientX: x, clientY: y, target })

function argClic(fecha: Date, allDay: boolean, dayEl: ElementoFalso, tipoVista = 'timeGridWeek'): DateClickArg {
  return { date: fecha, allDay, dayEl, jsEvent: raton(300, 400), view: { type: tipoVista } } as unknown as DateClickArg
}

function argSelect(inicio: Date, fin: Date, jsEvent: unknown, allDay = false, startStr = '', endStr = ''): DateSelectArg {
  return { start: inicio, end: fin, allDay, startStr, endStr, jsEvent } as unknown as DateSelectArg
}

const COLUMNA = new ElementoFalso(['fc-timegrid-col', 'fc-timegrid'])
const BANDA = new ElementoFalso(['fc-daygrid-day', 'fc-timegrid'])
const CELDA_MES = new ElementoFalso(['fc-daygrid-day'], { left: 10, top: 20, width: 140, height: 110 })

beforeEach(() => {
  vi.stubGlobal('Element', ElementoFalso)
  vi.stubGlobal('document', { querySelector: () => null, activeElement: new ElementoFalso(['ag-hueco', 'ag-dia-aside'], { left: 900, top: 300, width: 200, height: 40 }) })
})
afterEach(() => vi.unstubAllGlobals())

describe('interruptor APAGADO: cada gesto hace lo de hoy', () => {
  it('MUTACIÓN `agendaV2 &&`: un clic en la rejilla abre el modal «Nueva cita» y nunca la burbuja', () => {
    const m = montar({ agendaV2: false })
    m.alta.handleDateClick(argClic(D(10), false, COLUMNA))
    expect(m.api.abrirBurbuja).not.toHaveBeenCalled()
    expect(m.setModal).toHaveBeenCalledWith({ mode: 'create', fecha: '2026-11-11', hora: '10:00', tipo: 'cita', todoElDia: 'no' })
  })
  it('un clic en una cita abre la edición', () => {
    const m = montar({ agendaV2: false })
    const evento = { extendedProps: { id: 'c1', status: 'scheduled' } } as unknown as EventApi
    m.alta.handleEventClick({ event: evento, el: COLUMNA, jsEvent: raton(1, 2) } as unknown as EventClickArg)
    expect(m.api.abrirTarjeta).not.toHaveBeenCalled()
    expect(m.setModal).toHaveBeenCalledWith({ mode: 'edit', appointment: evento.extendedProps })
  })
})

describe('interruptor ENCENDIDO: la burbuja', () => {
  it('sin el chunk todavía, el modal de siempre', () => {
    const m = montar({ agendaV2: true, conChunk: false })
    m.alta.handleDateClick(argClic(D(10), false, COLUMNA))
    expect(m.setModal).toHaveBeenCalledTimes(1)
  })
  it('un clic en la rejilla abre la burbuja junto al punto, sin fin (duración por omisión)', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleDateClick(argClic(D(10), false, COLUMNA))
    expect(m.setModal).not.toHaveBeenCalled()
    expect(m.api.abrirBurbuja).toHaveBeenCalledWith(expect.objectContaining({
      fecha: '2026-11-11', hora: '10:00', fin: null, desdeHueco: false,
      ancla: { left: 300, top: 400, width: 1, height: 1 }, punto: { x: 300, y: 400 },
    }))
  })
  it('una celda del Mes abre la burbuja sin hora, anclada a la celda', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleDateClick(argClic(D(0), true, CELDA_MES, 'dayGridMonth'))
    expect(m.api.abrirBurbuja).toHaveBeenCalledWith(expect.objectContaining({ hora: null, ancla: CELDA_MES.getBoundingClientRect() }))
  })
  it('la banda de todo el día sigue yendo al modal de evento', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleDateClick(argClic(D(0), true, BANDA))
    expect(m.api.abrirBurbuja).not.toHaveBeenCalled()
    expect(m.setModal).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'evento', todoElDia: 'fijo' }))
  })
  it('MUTACIÓN más de una franja: el arrastre 10:00–11:30 lleva su fin a la burbuja', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleSelect(argSelect(D(10), D(11, 30), raton(5, 6, COLUMNA)))
    expect(m.api.abrirBurbuja).toHaveBeenCalledWith(expect.objectContaining({ hora: '10:00', fin: D(11, 30), desdeHueco: false }))
  })
  it('arrastrar por varios días del Mes sigue abriendo el modal', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleSelect(argSelect(D(0), D(0, 0, 14), raton(5, 6, CELDA_MES), true, '2026-11-11', '2026-11-14'))
    expect(m.api.abrirBurbuja).not.toHaveBeenCalled()
    expect(m.setModal).toHaveBeenCalledTimes(1)
  })
  it('MUTACIÓN `seleccionDesdeHueco`: un hueco del panel marca `desdeHueco`, se ancla al botón y la marca se vacía', () => {
    const m = montar({ agendaV2: true })
    m.alta.abrirHueco({ desde: 600, hasta: 780 })
    expect(m.select).toHaveBeenCalledTimes(1)
    expect(m.api.abrirBurbuja).toHaveBeenCalledWith(expect.objectContaining({
      hora: '10:00', desdeHueco: true, ancla: { left: 900, top: 300, width: 200, height: 40 },
    }))
    expect(m.seleccion.current).toBeNull()
  })
  it('el bloqueo de suscripción va antes que nada', () => {
    const m = montar({ agendaV2: true, bloqueada: true })
    m.alta.handleDateClick(argClic(D(10), false, COLUMNA))
    m.alta.handleSelect(argSelect(D(10), D(11), null))
    expect(m.openBloqueoModal).toHaveBeenCalledTimes(2)
    expect(m.api.abrirBurbuja).not.toHaveBeenCalled()
    expect(m.setModal).not.toHaveBeenCalled()
  })
  it('fuera de horario: primero el aviso; aceptarlo abre la burbuja, no el modal', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleDateClick(argClic(D(20), false, COLUMNA))
    expect(m.api.abrirBurbuja).not.toHaveBeenCalled()
    const { message, onConfirm } = m.setConfirm.mock.calls[0][0] as { message: string; onConfirm: () => void }
    expect(message).toMatch(/20:00/)
    onConfirm()
    expect(m.api.abrirBurbuja).toHaveBeenCalledTimes(1)
    expect(m.setModal).not.toHaveBeenCalled()
  })
})

describe('interruptor ENCENDIDO: la tarjeta de lectura', () => {
  const evento = { extendedProps: { id: 'c1', status: 'scheduled' } } as unknown as EventApi
  it('MUTACIÓN `agendaV2 ?`: un clic en una cita abre la tarjeta junto a la cita, no el modal', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleEventClick({ event: evento, el: COLUMNA, jsEvent: raton(1, 2) } as unknown as EventClickArg)
    expect(m.setModal).not.toHaveBeenCalled()
    expect(m.api.abrirTarjeta).toHaveBeenCalledWith(evento.extendedProps, COLUMNA.getBoundingClientRect(), { x: 1, y: 2 })
  })
  it('la cita pulsada se enfoca antes de abrir la tarjeta (el foco vuelve a ella al cerrar); apagado, no', () => {
    const el = new ElementoFalso(['fc-event'])
    montar({ agendaV2: true }).alta.handleEventClick({ event: evento, el, jsEvent: raton(1, 2) } as unknown as EventClickArg)
    expect(el.enfocada).toBe(1)
    const apagado = new ElementoFalso(['fc-event'])
    montar({ agendaV2: false }).alta.handleEventClick({ event: evento, el: apagado, jsEvent: raton(1, 2) } as unknown as EventClickArg)
    expect(apagado.enfocada).toBe(0)
  })
  it('con teclado (Enter, sin punto) la tarjeta se abre igual, sin punto', () => {
    const m = montar({ agendaV2: true })
    m.alta.handleEventClick({ event: evento, el: COLUMNA, jsEvent: { key: 'Enter' } } as unknown as EventClickArg)
    expect(m.api.abrirTarjeta).toHaveBeenCalledWith(evento.extendedProps, COLUMNA.getBoundingClientRect(), undefined)
  })
  it('la otra puerta (panel del Mes del teléfono) abre la tarjeta sin ancla', () => {
    const m = montar({ agendaV2: true })
    m.alta.abrirCita(evento)
    expect(m.api.abrirTarjeta).toHaveBeenCalledWith(evento.extendedProps, null, undefined)
  })
  it('un bloque de Google sigue sin abrir nada', () => {
    const m = montar({ agendaV2: true })
    m.alta.abrirCita({ extendedProps: { isGcalBlock: true } } as unknown as EventApi)
    expect(m.api.abrirTarjeta).not.toHaveBeenCalled()
    expect(m.setModal).not.toHaveBeenCalled()
  })
})
