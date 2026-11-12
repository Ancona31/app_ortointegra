/**
 * E3 · la respuesta del paciente por el enlace se refleja en Google con el
 * restablecimiento de C5: `patch` con `If-Match` = el etag guardado,
 * `sendUpdates:'none'`, «CANCELADA — …» al cancelar, color del estado y sin
 * descripción. Un 412 o un fallo no lanzan. Sin conexión, no se hace nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FilaEspejo } from '@/lib/gcalSincronizacionDecidir'

const h = vi.hoisted(() => ({
  conexion: { id: 'cx1' } as unknown,
  patches: [] as { params: Record<string, unknown>; opciones: unknown }[],
  fallo: null as unknown,
  fila: null as unknown,
  aplicadas: 0,
  opciones: [] as unknown[],
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/gcalConexion', () => ({ resolverConexionClinica: async (_a: unknown, clinica: string) => (clinica === 'clinica-1' ? h.conexion : null) }))
vi.mock('@/lib/gcalSincronizacionBase', () => ({
  citasDeEventos: async () => [h.fila],
  aplicarEvento: async () => { h.aplicadas += 1; return 1 },
}))
vi.mock('@/lib/gcal', () => ({
  conCalendarioSpinus: async (_c: unknown, _a: unknown, op: (cal: unknown, id: string) => Promise<unknown>, opciones: unknown) => {
    h.opciones.push(opciones)
    const calendar = {
      events: {
        patch: async (params: Record<string, unknown>, opciones: unknown) => {
          h.patches.push({ params, opciones })
          if (h.fallo) throw h.fallo
          return { data: { etag: '"nuevo"' } }
        },
      },
    }
    return op(calendar, 'cal-spinus')
  },
}))

const { reflejarEnGoogle } = await import('@/lib/confirmacion/googleConfirmacion')

function fila(status: FilaEspejo['status']): FilaEspejo {
  return {
    id: 'cita-1', googleEventId: 'ev1', gcalCalendarId: 'cal-spinus', gcalEtag: '"viejo"', gcalSyncStatus: 'synced',
    origen: 'spinus', status, inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T16:30:00.000Z', todoElDia: false,
    zona: 'America/Merida', updatedAt: '2031-05-01T00:00:00.000Z', conPaciente: true, tituloSinPaciente: null,
    notasDeGoogle: null, paciente: { nombre: 'Ana', apellidos: 'López' },
  }
}

const CITA = { clinicaId: 'clinica-1', citaId: 'cita-1', eventId: 'ev1', etag: '"viejo"' }

beforeEach(() => {
  h.conexion = { id: 'cx1' }; h.patches = []; h.fallo = null; h.fila = fila('cancelled'); h.aplicadas = 0; h.opciones = []
})

describe('reflejarEnGoogle', () => {
  it('cancelada: patch con If-Match del etag guardado, sendUpdates none, «CANCELADA — …», sin descripción', async () => {
    await reflejarEnGoogle(CITA)
    expect(h.patches).toHaveLength(1)
    const p = h.patches[0]
    expect(p?.params.calendarId).toBe('cal-spinus')
    expect(p?.params.eventId).toBe('ev1')
    expect(p?.params.sendUpdates).toBe('none')
    expect(p?.opciones).toEqual({ headers: { 'If-Match': '"viejo"' } })
    const cuerpo = p?.params.requestBody as Record<string, unknown>
    expect(cuerpo.summary).toBe('CANCELADA — Cita médica: Ana López')
    expect(cuerpo.colorId).toBe('11')
    expect(cuerpo).not.toHaveProperty('description')
    expect(h.aplicadas).toBe(1) // guarda el etag nuevo
    expect(h.opciones).toEqual([{ puedeReparar: false, actorId: 'enlace_paciente' }])
  })

  it('confirmada: el color de confirmada y el título sin prefijo', async () => {
    h.fila = fila('confirmed')
    await reflejarEnGoogle(CITA)
    const cuerpo = h.patches[0]?.params.requestBody as Record<string, unknown>
    expect(cuerpo.summary).toBe('Cita médica: Ana López')
    expect(cuerpo.colorId).toBe('2')
  })

  it('un 412 o cualquier fallo de Google no lanzan', async () => {
    h.fallo = { code: 412 }
    await expect(reflejarEnGoogle(CITA)).resolves.toBeUndefined()
    expect(h.aplicadas).toBe(0)
    h.fallo = new Error('500')
    await expect(reflejarEnGoogle(CITA)).resolves.toBeUndefined()
  })

  it('sin conexión de Google de esa clínica, no se llama a Google', async () => {
    await reflejarEnGoogle({ ...CITA, clinicaId: 'otra' })
    expect(h.patches).toHaveLength(0)
  })
})
