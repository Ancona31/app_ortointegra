import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearGuardadoCitas } from '@/app/(app)/agenda/guardadoCitas'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import type { Status } from '@/lib/agenda/tiposAgenda'

/**
 * `cambiarEstadoCita` (F3, para la tarjeta de lectura) y `handleCancelar`, que
 * pasa por ella. Sin calendario montado (`calendarRef.current = null`): lo
 * optimista no tiene dónde pintarse y lo que se mira es la PETICIÓN —verbo,
 * ruta, cuerpo con firma— y lo que se dice al usuario.
 */

interface Llamada { url: string; init: RequestInit | undefined }

function montar(respuesta: { ok: boolean; cuerpo: unknown }) {
  const llamadas: Llamada[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init })
    return { ok: respuesta.ok, json: async () => respuesta.cuerpo }
  })
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
  const refetch = vi.fn()
  const closeModal = vi.fn()
  const aplicarAppointmentAlEvento = vi.fn()
  const g = crearGuardadoCitas({
    calendarRef: { current: null },
    horario: HORARIO_DEFAULT,
    profile: null,
    toast,
    setConfirm: vi.fn(),
    setCitaCreada: vi.fn(),
    setInvitacion: vi.fn(),
    closeModal,
    refetch,
    firmarEscritura: () => 'firma-1',
    aplicarAppointmentAlEvento,
    agendaV2: true,
  })
  return { g, llamadas, toast, refetch, closeModal, aplicarAppointmentAlEvento }
}

const cuerpoDe = (l: Llamada): unknown => JSON.parse(String(l.init?.body))

afterEach(() => { vi.unstubAllGlobals() })

describe('cambiarEstadoCita', () => {
  it('confirma con un PUT parcial firmado y rehidrata con la fila del servidor', async () => {
    const m = montar({ ok: true, cuerpo: { appointment: { id: 'c1', status: 'confirmed' } } })
    await m.g.cambiarEstadoCita('c1', 'confirmed')
    expect(m.llamadas).toHaveLength(1)
    expect(m.llamadas[0].url).toBe('/api/appointments/c1')
    expect(m.llamadas[0].init?.method).toBe('PUT')
    expect(cuerpoDe(m.llamadas[0])).toEqual({ status: 'confirmed', client_id: 'firma-1' })
    expect(m.closeModal).toHaveBeenCalledTimes(1)
    expect(m.toast.success).toHaveBeenCalledWith('Estado cambiado a «Confirmada»')
    expect(m.aplicarAppointmentAlEvento).toHaveBeenCalledWith({ id: 'c1', status: 'confirmed' })
  })

  it('B3: cancelar una cita es un PUT a cancelled, nunca un DELETE', async () => {
    const m = montar({ ok: true, cuerpo: { appointment: { id: 'c1', status: 'cancelled' } } })
    await m.g.cambiarEstadoCita('c1', 'cancelled')
    expect(m.llamadas.map(l => l.init?.method)).toEqual(['PUT'])
    expect(cuerpoDe(m.llamadas[0])).toEqual({ status: 'cancelled', client_id: 'firma-1' })
    expect(m.toast.success).toHaveBeenCalledWith('Se canceló la cita')
  })

  it('handleCancelar pasa por ella: el mismo PUT y el mismo acuse que antes', async () => {
    const m = montar({ ok: true, cuerpo: null })
    await m.g.handleCancelar('c2')
    expect(m.llamadas.map(l => [l.url, l.init?.method])).toEqual([['/api/appointments/c2', 'PUT']])
    expect(cuerpoDe(m.llamadas[0])).toEqual({ status: 'cancelled', client_id: 'firma-1' })
    expect(m.toast.success).toHaveBeenCalledWith('Se canceló la cita')
    expect(m.aplicarAppointmentAlEvento).not.toHaveBeenCalled()
  })

  it('MUTACIÓN: un estado fuera de los cinco no sale a la red ni cierra nada', async () => {
    const m = montar({ ok: true, cuerpo: null })
    /* Lo que llegaría de un llamador sin tipos (datos de fuera): la guarda de
       tiempo de ejecución existe justo para eso. */
    const estado: Status = JSON.parse('"borrada"')
    await m.g.cambiarEstadoCita('c1', estado)
    expect(m.llamadas).toHaveLength(0)
    expect(m.closeModal).not.toHaveBeenCalled()
    expect(m.toast.error).toHaveBeenCalledWith('Estado de cita no válido')
  })

  it('si el servidor falla, vuelve a traer y dice por qué', async () => {
    const m = montar({ ok: false, cuerpo: { message: 'Sin permiso' } })
    await m.g.cambiarEstadoCita('c1', 'attended')
    expect(m.refetch).toHaveBeenCalledTimes(1)
    expect(m.toast.error).toHaveBeenCalledWith('Sin permiso')
    expect(m.aplicarAppointmentAlEvento).not.toHaveBeenCalled()
  })

  it('el fallo sin cuerpo usa el texto del caso', async () => {
    const m = montar({ ok: false, cuerpo: null })
    await m.g.handleCancelar('c1')
    expect(m.toast.error).toHaveBeenCalledWith('No se pudo cancelar')
  })
})
