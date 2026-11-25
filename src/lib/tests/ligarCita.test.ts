/**
 * ligarCita.test.ts — D7: ligar una cita por ligar a un paciente antes de
 * iniciar la consulta. El cuerpo que sale hacia `PUT /api/appointments/[id]`
 * (sin tocar los datos de contacto de la reserva), el motivo legible cuando
 * falla, y con qué se compone el evento de Google antes y después de ligar
 * (S1 sobre lo que ya hay de C5: ligada, título del paciente y descripción
 * fija, nunca las notas).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const vaciar = vi.hoisted(() => vi.fn())
vi.mock('@/lib/agenda/cacheRangosCitas', () => ({ vaciarCacheCitas: vaciar }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

const { ligarCitaAPaciente } = await import('@/lib/agenda/ligarCita')
const { pacienteParaGoogle } = await import('@/lib/agenda/porLigarServidor')
const { eventoParaGoogle } = await import('@/lib/appointments')
const { descripcionV2 } = await import('@/lib/gcalEscritura')

const CITA = '11111111-1111-4111-8111-111111111111'
const PAC = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Ana', apellidos: 'López Ruiz' }

let llamadas: { url: string; init: RequestInit }[] = []
function responder(status: number, cuerpo: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    llamadas.push({ url, init })
    return new Response(JSON.stringify(cuerpo), { status })
  }))
}
beforeEach(() => { llamadas = []; vaciar.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('ligarCitaAPaciente', () => {
  it('manda sólo paciente, título y updated_at, y vacía la caché', async () => {
    responder(200, { appointment: { id: CITA } })
    expect(await ligarCitaAPaciente({ citaId: CITA, updatedAt: '2026-11-12T10:00:00Z', paciente: PAC })).toEqual({ ok: true })
    expect(llamadas[0].url).toBe(`/api/appointments/${CITA}`)
    expect(llamadas[0].init.method).toBe('PUT')
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({
      paciente_id: PAC.id, title: 'Ana López Ruiz', updated_at: '2026-11-12T10:00:00Z',
    })
    expect(vaciar).toHaveBeenCalledTimes(1)
  })
  it('un fallo devuelve el motivo del servidor; un 500 o una red caída, el genérico', async () => {
    responder(409, { error: 'Esta cita fue modificada por otro usuario recientemente. Recarga para ver los cambios.' })
    expect(await ligarCitaAPaciente({ citaId: CITA, updatedAt: undefined, paciente: PAC }))
      .toEqual({ ok: false, motivo: 'Esta cita fue modificada por otro usuario recientemente. Recarga para ver los cambios.' })
    expect(JSON.parse(String(llamadas[0].init.body))).not.toHaveProperty('updated_at')
    responder(400, { error: 'paciente_invalido', message: 'Ese paciente no es de esta clínica.' })
    expect(await ligarCitaAPaciente({ citaId: CITA, updatedAt: undefined, paciente: PAC }))
      .toEqual({ ok: false, motivo: 'Ese paciente no es de esta clínica.' })
    responder(500, { error: 'detalle interno' })
    const r = await ligarCitaAPaciente({ citaId: CITA, updatedAt: undefined, paciente: PAC })
    expect(r.ok === false && r.motivo).not.toContain('detalle interno')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red') }))
    expect((await ligarCitaAPaciente({ citaId: CITA, updatedAt: undefined, paciente: PAC })).ok).toBe(false)
  })
})

describe('pacienteParaGoogle y la composición del evento (S1 con C5)', () => {
  it('por ligar con v2: el nombre de quien reservó, como el espejo de D4; sin v2 o sin reserva, null', () => {
    const porLigar = { pacientes: null, paciente_id: null, reserva_canal: 'fijo', reserva_nombre: 'Ana Reserva' }
    expect(pacienteParaGoogle(porLigar, true)).toEqual({ nombre: 'Ana Reserva', apellidos: '' })
    expect(pacienteParaGoogle(porLigar, false)).toBeNull()
    expect(pacienteParaGoogle({ pacientes: null, paciente_id: null, reserva_canal: null }, true)).toBeNull()
    expect(pacienteParaGoogle({ ...porLigar, reserva_nombre: '  ' }, true)).toBeNull()
  })
  it('ligada: manda el paciente; la descripción es la fija y nunca las notas, aunque naciera en Google', () => {
    const ligada = { pacientes: { nombre: 'Ana', apellidos: 'López' }, paciente_id: PAC.id, reserva_canal: 'unico', reserva_nombre: 'Ana Reserva' }
    const paciente = pacienteParaGoogle(ligada, true)
    expect(paciente).toEqual({ nombre: 'Ana', apellidos: 'López' })
    const { summary, description } = eventoParaGoogle(paciente, { nombre: 'Clínica', nombre_display: null }, 'Ana Reserva', null, 'America/Merida', 'scheduled')
    expect(summary).toBe('Cita médica: Ana López')
    expect(description).toBe('Clínica\nConsulta:\nAna López')
    expect(descripcionV2({ origen: 'google', paciente_id: PAC.id, notes: 'notas de Google' }, description, true)).toBe(description)
    expect(descripcionV2({ origen: 'spinus', paciente_id: PAC.id, notes: 'observaciones' }, description, true)).toBe(description)
  })
})
