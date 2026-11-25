/**
 * Avisos globales, paso 6 · el «No» del paciente a la invitación de Google.
 * MUTACIONES (comprobadas en rojo): escribirle al paciente en `no_asistira` (última hora); mandar el
 * correo sin llave de idempotencia; aplicar el «No» a una cita atendida; `rechazaronDe` contando al
 * organizador.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventoGoogle, FilaEspejo } from '@/lib/gcalSincronizacionDecidir'
import type { RechazoRsvp } from '@/lib/gcalSincronizacionBase'

const h = vi.hoisted(() => ({
  devuelve: null as unknown, lanza: false,
  llamadas: [] as unknown[][], correos: [] as Record<string, unknown>[], reflejos: [] as unknown[][],
}))
vi.mock('@/lib/gcalSincronizacionBase', () => ({
  rechazarPorRsvp: async (...args: unknown[]) => {
    h.llamadas.push(args)
    if (h.lanza) throw new Error('la base falló')
    return h.devuelve
  },
}))
vi.mock('@/lib/correo/transporte', () => ({
  enviarCorreo: async (c: Record<string, unknown>) => { h.correos.push(c); return { ok: true, modo: 'captura' } },
}))
vi.mock('@/lib/confirmacion/googleConfirmacion', () => ({
  reflejarEnGoogle: async (...args: unknown[]) => { h.reflejos.push(args) },
}))

const { rechazarPorRsvps } = await import('@/lib/gcalRsvpRechazo')
const { aceptaronDe, rechazaronDe } = await import('@/lib/gcalRsvp')
const { correoCancelacionPorRsvp } = await import('@/lib/confirmacion/correosCita')

const fila = (extra: Partial<FilaEspejo> = {}): FilaEspejo => ({
  id: 'cita-1', googleEventId: 'ev-1', gcalCalendarId: 'cal', gcalEtag: '"e0"', gcalSyncStatus: 'synced', origen: 'spinus',
  status: 'scheduled', inicio: '2031-06-02T16:00:00Z', fin: '2031-06-02T16:30:00Z', todoElDia: false, zona: 'America/Merida',
  updatedAt: null, conPaciente: true, ...extra,
} as FilaEspejo)
const evento = (respuestas: Array<[string, string, Record<string, boolean>?]>, extra: Partial<EventoGoogle> = {}): EventoGoogle => ({
  id: 'ev-1', status: 'confirmed', etag: '"e1"',
  attendees: respuestas.map(([email, responseStatus, mas]) => ({ email, responseStatus, ...mas })), ...extra,
})
const cancelada: RechazoRsvp = {
  r_resultado: 'cancelada', r_para: 'paciente@prueba.local', r_nombre: 'Hugo', r_inicio: '2031-06-02T16:00:00Z', r_zona: 'America/Merida',
  r_medico: { titulo: 'Dr.', nombres: 'Admin', apellido_paterno: 'Uno', apellido_materno: null },
  r_consultorio: { nombre: 'Centro', direccion: 'Calle 1', telefono: '9991234567' }, r_gcal_etag: '"e0"',
}

beforeEach(() => { h.devuelve = null; h.lanza = false; h.llamadas.length = 0; h.correos.length = 0; h.reflejos.length = 0 })

describe('rechazaronDe', () => {
  it('sólo quien dijo «No», sin organizador, propia cuenta ni salas; en minúsculas y sin repetir', () => {
    const e = evento([['Paciente@Prueba.Local ', 'declined'], ['paciente@prueba.local', 'declined'], ['dueno@prueba.local', 'declined', { organizer: true }],
      ['yo@prueba.local', 'declined', { self: true }], ['sala@prueba.local', 'declined', { resource: true }], ['otro@prueba.local', 'accepted']])
    expect(rechazaronDe(e)).toEqual(['paciente@prueba.local'])
    expect(aceptaronDe(e)).toEqual(['otro@prueba.local'])
  })
})

describe('rechazarPorRsvps', () => {
  it('con más de una hora: cuenta el cambio, le escribe UNA vez al que rechazó (con llave por cita) y lo refleja en Google', async () => {
    h.devuelve = cancelada
    const r = await rechazarPorRsvps('clinica-1', 'cal', [{ evento: evento([['paciente@prueba.local', 'declined']]), fila: fila() }])
    expect(r).toEqual({ cambios: 1, errores: 0 })
    expect(h.llamadas).toEqual([['clinica-1', 'cal', 'cita-1', 'ev-1', ['paciente@prueba.local']]])
    expect(h.correos).toHaveLength(1)
    expect(h.correos[0]).toMatchObject({ para: 'paciente@prueba.local', etiqueta: 'cancelacion-rsvp', idempotencia: 'cancelacion-rsvp/cita-1', remitente: 'Dr. Admin Uno' })
    expect(h.reflejos).toEqual([[{ clinicaId: 'clinica-1', citaId: 'cita-1', eventId: 'ev-1', etag: '"e1"' }, 'google_rsvp']])
  })
  it('en la última hora (no_asistira): ni cambio, ni correo, ni Google; decide el personal', async () => {
    h.devuelve = { ...cancelada, r_resultado: 'no_asistira', r_para: null }
    const r = await rechazarPorRsvps('clinica-1', 'cal', [{ evento: evento([['paciente@prueba.local', 'declined']]), fila: fila({ status: 'confirmed' }) }])
    expect(r).toEqual({ cambios: 0, errores: 0 })
    expect(h.llamadas).toHaveLength(1)
    expect(h.correos).toHaveLength(0)
    expect(h.reflejos).toHaveLength(0)
  })
  it('sin_cambio, o la base sin M2 (null): nada', async () => {
    for (const d of [{ ...cancelada, r_resultado: 'sin_cambio' }, null]) {
      h.devuelve = d
      expect(await rechazarPorRsvps('c', 'cal', [{ evento: evento([['p@prueba.local', 'declined']]), fila: fila() }])).toEqual({ cambios: 0, errores: 0 })
    }
    expect(h.correos).toHaveLength(0)
  })
  it('no llama a la base si nadie rechazó, si la cita no está viva, si no tiene paciente o si el evento está cancelado', async () => {
    h.devuelve = cancelada
    await rechazarPorRsvps('c', 'cal', [
      { evento: evento([['p@prueba.local', 'accepted']]), fila: fila() },
      { evento: evento([['p@prueba.local', 'declined']]), fila: fila({ status: 'attended' }) },
      { evento: evento([['p@prueba.local', 'declined']]), fila: fila({ status: 'cancelled' }) },
      { evento: evento([['p@prueba.local', 'declined']]), fila: fila({ conPaciente: false }) },
      { evento: evento([['p@prueba.local', 'declined']], { status: 'cancelled' }), fila: fila() },
      { evento: evento([['p@prueba.local', 'declined']]), fila: null },
    ])
    expect(h.llamadas).toHaveLength(0)
  })
  it('un fallo de la base cuenta como error y no tumba la página; cancelada sin destinatario no escribe', async () => {
    h.lanza = true
    expect(await rechazarPorRsvps('c', 'cal', [{ evento: evento([['p@prueba.local', 'declined']]), fila: fila() }])).toEqual({ cambios: 0, errores: 1 })
    h.lanza = false
    h.devuelve = { ...cancelada, r_para: null }
    expect(await rechazarPorRsvps('c', 'cal', [{ evento: evento([['p@prueba.local', 'declined']]), fila: fila() }])).toEqual({ cambios: 1, errores: 0 })
    expect(h.correos).toHaveLength(0)
  })
})

describe('correoCancelacionPorRsvp', () => {
  const d = { inicio: '2031-06-02T16:00:00Z', zona: 'America/Merida', medico: 'Dr. Admin Uno', consultorio: { nombre: 'Centro', direccion: 'Calle 1', telefono: '9991234567' } }
  it('dice por qué se canceló y qué hacer si fue un error; saluda por el nombre; sin botones ni nada clínico', () => {
    const c = correoCancelacionPorRsvp(d, 'Hugo <b>')
    expect(c.asunto).toBe('Tu cita del lunes, 2 de junio fue cancelada')
    expect(c.remitente).toBe('Dr. Admin Uno')
    expect(c.texto).toContain('Hola, Hugo <b>:')
    expect(c.texto).toContain('Tu cita fue cancelada porque indicaste que no asistirás.')
    expect(c.texto).toContain('Agenda de nuevo')
    expect(c.html).toContain('Hugo &lt;b&gt;')
    expect(c.html).not.toContain('/confirmar/')
    expect(`${c.texto}${c.html}`).not.toMatch(/motivo|diagn|tipo de cita/i)
  })
  it('sin nombre, «Hola:»; con una fecha inválida, lanza', () => {
    expect(correoCancelacionPorRsvp(d).texto).toContain('Hola:')
    expect(() => correoCancelacionPorRsvp({ ...d, inicio: 'no es fecha' })).toThrow()
  })
})
