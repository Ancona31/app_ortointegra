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
  /** El enlace fijo del médico: su id en la base, y cómo abre (`null` = no abre). */
  enlaceId: null as string | null, consultaEnlace: [] as unknown[][],
  abre: null as null | { clinica_id: string; estado: string; consultorios: unknown[]; tipos: unknown[] },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (tabla: string) => {
    const c: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'is', 'order']) c[op] = (...args: unknown[]) => { h.consultaEnlace.push([tabla, op, ...args]); return c }
    c.limit = async () => ({ data: h.enlaceId ? [{ id: h.enlaceId }] : [], error: null })
    return c
  } }),
}))
vi.mock('@/lib/reserva/secretos', () => ({ codigoDeEnlace: (id: string) => `CODIGO${id}`.padEnd(22, 'x').slice(0, 22), esCodigoDeEnlace: (c: string) => /^[A-Za-z0-9_-]{22}$/.test(c) }))
vi.mock('@/lib/reserva/puertaReserva', () => ({ abrirEnlace: async () => (h.abre ? { ctx: h.abre } : null) }))
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
  r_medico_id: '00000000-0000-4000-8000-0000000000d1',
}

beforeEach(() => {
  h.devuelve = null; h.lanza = false; h.llamadas.length = 0; h.correos.length = 0; h.reflejos.length = 0
  h.enlaceId = null; h.abre = null; h.consultaEnlace.length = 0
})

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
  const d = { inicio: '2031-06-02T16:00:00Z', zona: 'America/Merida', medico: 'Dr. Admin Uno', urlReserva: null,
    consultorio: { nombre: 'Centro', direccion: 'Calle 1', telefono: '9991234567' } }
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

/* Decisión de Angel (2026-11-25): el correo lleva el enlace de reserva del médico para volver a agendar,
   sólo si abre. MUTACIONES (comprobadas en rojo): poner el enlace sin comprobar que abre; buscarlo sin
   filtrar por clínica o por médico; aceptar un enlace que abre en otra clínica. */
describe('el enlace de reserva en el correo de cancelación', () => {
  const tarea = [{ evento: evento([['paciente@prueba.local', 'declined']]), fila: fila() }]
  const abierto = { clinica_id: 'clinica-1', estado: 'vigente', consultorios: [{}], tipos: [{}] }
  it('con un enlace fijo del médico que abre: botón «Agendar de nuevo» a /reservar/<código>', async () => {
    h.devuelve = cancelada; h.enlaceId = 'E1'; h.abre = abierto
    await rechazarPorRsvps('clinica-1', 'cal', tarea)
    expect(String(h.correos[0].html)).toContain('Agendar de nuevo')
    expect(String(h.correos[0].html)).toMatch(/href="https?:\/\/[^"]+\/reservar\/CODIGOE1x+"/)
    expect(String(h.correos[0].texto)).toMatch(/Agenda de nuevo: https?:\/\/[^\s]+\/reservar\/CODIGOE1x+/)
    // Se buscó el fijo vigente y sin pausar, de ESA clínica y de ESE médico.
    const filtros = h.consultaEnlace.filter(c => c[1] === 'eq' || c[1] === 'is').map(c => `${String(c[2])}=${String(c[3])}`)
    expect(filtros).toEqual(['clinica_id=clinica-1', 'medico_id=00000000-0000-4000-8000-0000000000d1', 'clase=fijo', 'revocado_en=null', 'pausado_en=null'])
  })
  it('sin enlace, o si no abre, o si abre en otra clínica, o sin nada que ofrecer: el correo sale igual, con el teléfono', async () => {
    const casos: Array<[string | null, typeof h.abre]> = [
      [null, abierto], ['E1', null], ['E1', { ...abierto, clinica_id: 'otra' }], ['E1', { ...abierto, estado: 'revocado' }], ['E1', { ...abierto, tipos: [] }],
    ]
    for (const [id, abre] of casos) {
      h.devuelve = cancelada; h.enlaceId = id; h.abre = abre; h.correos.length = 0
      await rechazarPorRsvps('clinica-1', 'cal', tarea)
      expect(h.correos).toHaveLength(1)
      expect(String(h.correos[0].texto)).not.toContain('/reservar/')
      expect(String(h.correos[0].texto)).toMatch(/999[\s-]?123[\s-]?4567/)
    }
  })
  it('la plantilla: con enlace, botón; sin enlace, recuadro', () => {
    const base = { inicio: '2031-06-02T16:00:00Z', zona: 'America/Merida', medico: 'Dr. Admin Uno', consultorio: { nombre: 'Centro', direccion: null, telefono: '9991234567' } }
    const con = correoCancelacionPorRsvp({ ...base, urlReserva: 'https://spinus.prueba/reservar/AbCdEfGhIjKlMnOpQrStUv' })
    expect(con.html).toContain('href="https://spinus.prueba/reservar/AbCdEfGhIjKlMnOpQrStUv"')
    expect(con.html).toContain('Agendar de nuevo')
    expect(correoCancelacionPorRsvp({ ...base, urlReserva: null }).html).not.toContain('/reservar/')
  })
})
