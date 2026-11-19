/**
 * arrastreBloqueoTotal.test.ts — Tanda L (L1, punto 6) · Arrastrar o estirar
 * una cita o un evento (de horas o de todo el día) a un bloqueo pintado de su
 * médico: vuelve a su sitio con el mensaje literal y NO sale ningún PUT. Sin
 * la pregunta «¿Agendar de todos modos?» de K1. Con la v2 apagada, nada cambia.
 * La e2e (`agenda-k1-bloqueos.e2e.ts`) lo cubre en la rejilla de horas; esto,
 * además, la banda de todo el día, que la e2e no arrastra.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { crearGuardadoCitas } from '@/app/(app)/agenda/guardadoCitas'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { crearAvisosHorario } from '@/lib/agenda/horarioRejilla'
import { TEXTO_HORARIO_BLOQUEADO } from '@/lib/agenda/bloqueosAgenda'

/**
 * Tanda M (punto 16): las horas, a la hora de PARED del jueves 10-dic-2026 en la zona del proceso. Con
 * la v2 apagada (o sin consultorios) el aviso de fuera de horario lee la hora del dispositivo contra el
 * horario de la clínica (09:00–19:00), así que con instantes UTC fijos el caso del PUT sólo pasaba al
 * oeste de UTC: en UTC las 21:30 Z caen fuera de horario y en Tokio las 17:00 Z son las 02:00.
 * `DIA` y el caso de todo el día siguen en instantes: van por fechas (`startStr`), no por el aviso de horario.
 */
const pared = (hh: number, mm = 0): string => new Date(2026, 11, 10, hh, mm).toISOString()
const BLOQUEO = { id: 'b1', medico_id: 'm1', inicio: pared(15), fin: pared(17), todo_el_dia: false, zona: null, motivo: null }
const DIA = { ...BLOQUEO, id: 'b2', inicio: '2026-12-11T06:00:00.000Z', fin: '2026-12-12T06:00:00.000Z', todo_el_dia: true }

interface Evento { id: string; start: Date | null; end: Date | null; allDay: boolean; startStr: string; endStr: string; extendedProps: Record<string, unknown>; setDates: ReturnType<typeof vi.fn> }

function evento(inicio: string, fin: string, allDay = false, startStr = '', endStr = ''): Evento {
  return { id: 'c1', start: new Date(inicio), end: new Date(fin), allDay, startStr, endStr, extendedProps: { medico_id: 'm1', all_day: allDay }, setDates: vi.fn() }
}

function montar(agendaV2 = true) {
  const puts: string[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { puts.push(`${init?.method} ${url}`); return { ok: true, json: async () => ({}) } })
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
  const vivo = evento(pared(13), pared(14))
  const pintados = [BLOQUEO, DIA].map(b => ({ display: 'background', extendedProps: { bloqueo: b } }))
  const api = { getEvents: () => pintados, getEventById: () => vivo }
  const g = crearGuardadoCitas({
    // El calendario real tiene cientos de miembros; el veto sólo lee estos dos.
    calendarRef: { current: { getApi: () => api } } as unknown as Parameters<typeof crearGuardadoCitas>[0]['calendarRef'],
    avisosHorario: crearAvisosHorario({ agendaV2, horarioClinica: HORARIO_DEFAULT, consultorios: [], seleccion: [] }),
    profile: null, toast, setConfirm: vi.fn(), setCitaCreada: vi.fn(), setInvitacion: vi.fn(), closeModal: vi.fn(),
    refetch: vi.fn(), firmarEscritura: () => 'f', aplicarAppointmentAlEvento: vi.fn(), agendaV2,
  })
  return { g, puts, toast, vivo }
}

function arg(nuevo: Evento, viejo: Evento): EventDropArg & EventResizeDoneArg {
  const delta = { years: 0, months: 0, days: 0, milliseconds: 1 }
  // Un argumento de FullCalendar recortado a lo que leen los manejadores.
  return { event: nuevo, oldEvent: viejo, revert: vi.fn(), delta, startDelta: delta, endDelta: delta } as unknown as EventDropArg & EventResizeDoneArg
}

afterEach(() => { vi.unstubAllGlobals() })

describe('el bloqueo es total también al arrastrar', () => {
  it('una cita de horas dentro: vuelve, mensaje literal, sin PUT (MUTACIÓN: `vetadoPorBloqueo` → false)', async () => {
    const m = montar()
    const viejo = evento(pared(13), pared(14))
    await m.g.handleEventDrop(arg(evento(pared(15, 30), pared(16, 30)), viejo))
    expect(m.toast.error).toHaveBeenCalledWith(TEXTO_HORARIO_BLOQUEADO)
    expect(m.vivo.setDates).toHaveBeenCalledWith(viejo.start, viejo.end, { allDay: false })
    expect(m.puts).toEqual([])
  })
  it('estirar el fin hacia dentro, igual', async () => {
    const m = montar()
    await m.g.handleEventResize(arg(evento(pared(13), pared(15, 30)), evento(pared(13), pared(14))))
    expect(m.toast.error).toHaveBeenCalledWith(TEXTO_HORARIO_BLOQUEADO)
    expect(m.puts).toEqual([])
  })
  it('un evento de todo el día a un día bloqueado: vuelve sin PUT (MUTACIÓN: sin `vetadoTodoElDia`)', async () => {
    const m = montar()
    const viejo = evento('2026-12-09T06:00:00.000Z', '2026-12-10T06:00:00.000Z', true, '2026-12-09', '2026-12-10')
    await m.g.handleEventDrop(arg(evento('2026-12-11T06:00:00.000Z', '2026-12-12T06:00:00.000Z', true, '2026-12-11', '2026-12-12'), viejo))
    expect(m.toast.error).toHaveBeenCalledWith(TEXTO_HORARIO_BLOQUEADO)
    expect(m.puts).toEqual([])
    m.toast.error.mockClear()
    await m.g.handleEventResize(arg(evento('2026-12-09T06:00:00.000Z', '2026-12-12T06:00:00.000Z', true, '2026-12-09', '2026-12-12'), viejo))
    expect(m.toast.error).toHaveBeenCalledWith(TEXTO_HORARIO_BLOQUEADO)
    expect(m.puts).toEqual([])
  })
  it('fuera del bloqueo, o con la v2 apagada, sale el PUT (MUTACIÓN: vetar siempre)', async () => {
    const m = montar()
    await m.g.handleEventDrop(arg(evento(pared(11), pared(12)), evento(pared(13), pared(14))))
    expect(m.toast.error).not.toHaveBeenCalled()
    expect(m.puts).toEqual(['PUT /api/appointments/c1'])
    const a = montar(false)
    await a.g.handleEventDrop(arg(evento(pared(15, 30), pared(16, 30)), evento(pared(13), pared(14))))
    expect(a.toast.error).not.toHaveBeenCalledWith(TEXTO_HORARIO_BLOQUEADO)
    expect(a.puts).toEqual(['PUT /api/appointments/c1'])
  })
})
