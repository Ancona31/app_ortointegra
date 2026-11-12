/**
 * tipoCitaServidor.test.ts — B6c: el tipo de cita en POST y PUT de
 * `/api/appointments` (con el interruptor encendido; apagado, las rutas no
 * llaman a nada de esto). Qué se consulta, qué columnas salen y qué 400 se
 * devuelve. La regla en sí (`validarTipoParaCita`) ya la cubre
 * `tiposCita.test.ts`; aquí se prueba el pegamento con la base.
 *
 * El doble del cliente sale de `vi.mock('@/lib/supabase/server')`, como en
 * `consultaCitas.test.ts`: así `createClient()` conserva su tipo real y no
 * hace falta ningún `as`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Respuesta { data: Record<string, unknown> | null; error: { message: string; code?: string } | null }

const h = vi.hoisted(() => {
  const estado: { llamadas: unknown[][]; respuestas: Record<string, Respuesta> } = { llamadas: [], respuestas: {} }
  return estado
})

class ConsultaFalsa {
  constructor(private tabla: string) { h.llamadas.push(['from', tabla]) }
  select(...args: unknown[]): this { h.llamadas.push(['select', ...args]); return this }
  eq(...args: unknown[]): this { h.llamadas.push(['eq', ...args]); return this }
  maybeSingle(): Promise<Respuesta> { return Promise.resolve(h.respuestas[this.tabla] ?? { data: null, error: null }) }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (tabla: string) => new ConsultaFalsa(tabla) }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))

const { createClient } = await import('@/lib/supabase/server')
const { leerTipoCitaId, comprobarTipoDeCita, comprobarTipoDelPut } = await import('@/lib/agenda/tipoCitaServidor')

const TIPO = '11111111-1111-4111-8111-111111111111'
const OTRO = '22222222-2222-4222-8222-222222222222'
const MED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MED2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function tipoEnBase(fila: Partial<{ id: string; medico_id: string | null; nombre: string; activo: boolean }> = {}): void {
  h.respuestas.tipos_cita = { data: { id: TIPO, medico_id: null, nombre: 'Primera vez', activo: true, ...fila }, error: null }
}

beforeEach(() => {
  h.llamadas = []
  h.respuestas = {}
})

describe('leerTipoCitaId', () => {
  it('ausente, nulo, vacío, uuid y basura', () => {
    expect(leerTipoCitaId(undefined)).toBeUndefined()
    expect(leerTipoCitaId(null)).toBeNull()
    expect(leerTipoCitaId('')).toBeNull()
    expect(leerTipoCitaId(TIPO)).toBe(TIPO)
    expect(leerTipoCitaId('no-es-uuid')).toBe(false)
    expect(leerTipoCitaId(42)).toBe(false)
    expect(leerTipoCitaId(`${TIPO}) or (1=1`)).toBe(false)
  })
})

describe('comprobarTipoDeCita (alta)', () => {
  it('lee el tipo con el cliente de sesión, filtrado por clínica, y devuelve tipo + instantánea', async () => {
    tipoEnBase()
    const r = await comprobarTipoDeCita(await createClient(), {
      clinicaId: 'c1', tipoCitaId: TIPO, tipoAnterior: null, medicoId: MED, conPaciente: true,
    })
    expect(h.llamadas).toEqual([
      ['from', 'tipos_cita'], ['select', 'id, medico_id, nombre, activo'], ['eq', 'id', TIPO], ['eq', 'clinica_id', 'c1'],
    ])
    expect(r).toEqual({ ok: true, columnas: { tipo_cita_id: TIPO, tipo_cita_nombre: 'Primera vez' } })
  })

  it('400 con mensaje: de otro médico, archivado, invisible y sin paciente', async () => {
    const s = await createClient()
    const base = { clinicaId: 'c1', tipoCitaId: TIPO, tipoAnterior: null, medicoId: MED, conPaciente: true }
    tipoEnBase({ medico_id: MED2 })
    expect(await comprobarTipoDeCita(s, base)).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_incompatible', message: 'Ese tipo de cita es de otro médico' } })
    tipoEnBase({ activo: false })
    expect(await comprobarTipoDeCita(s, base)).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_archivado' } })
    h.respuestas.tipos_cita = { data: null, error: null }
    expect(await comprobarTipoDeCita(s, base)).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_no_encontrado' } })
    tipoEnBase()
    expect(await comprobarTipoDeCita(s, { ...base, conPaciente: false })).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_sin_paciente' } })
  })

  it('falla CERRADO: si no se puede leer el tipo, 500 y no se escribe', async () => {
    h.respuestas.tipos_cita = { data: null, error: { message: 'caída', code: '08006' } }
    expect(await comprobarTipoDeCita(await createClient(), {
      clinicaId: 'c1', tipoCitaId: TIPO, tipoAnterior: null, medicoId: MED, conPaciente: true,
    })).toMatchObject({ ok: false, status: 500 })
  })
})

describe('comprobarTipoDelPut', () => {
  const antes = { medico_id: MED, paciente_id: PAC }

  it('sin tipo en el cuerpo y sin cambiar médico ni paciente: NO consulta nada', async () => {
    const r = await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: undefined, antes, medicoEfectivo: MED, pacienteEfectivo: PAC,
    })
    expect(r).toEqual({ ok: true, columnas: null })
    expect(h.llamadas).toEqual([])
  })

  it('cambiar de médico valida el tipo que YA tenía: incompatible → 400 aunque el cuerpo no lo nombre', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: TIPO }, error: null }
    tipoEnBase({ medico_id: MED })
    const r = await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: undefined, antes, medicoEfectivo: MED2, pacienteEfectivo: PAC,
    })
    expect(r).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_incompatible' } })
    expect(h.llamadas.slice(0, 4)).toEqual([
      ['from', 'appointments'], ['select', 'tipo_cita_id'], ['eq', 'id', 'x'], ['eq', 'clinica_id', 'c1'],
    ])
  })

  it('cambiar de médico con un tipo de clínica: pasa y no reescribe la instantánea; archivado después, también', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: TIPO }, error: null }
    tipoEnBase({ activo: false, nombre: 'Renombrado' })
    expect(await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: undefined, antes, medicoEfectivo: MED2, pacienteEfectivo: PAC,
    })).toEqual({ ok: true, columnas: null })
  })

  it('el mismo tipo reenviado no es «recién asignado»; uno distinto sí, y lleva instantánea', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: TIPO }, error: null }
    tipoEnBase()
    const s = await createClient()
    expect(await comprobarTipoDelPut(s, {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: TIPO, antes, medicoEfectivo: MED, pacienteEfectivo: PAC,
    })).toEqual({ ok: true, columnas: null })
    h.respuestas.tipos_cita = { data: { id: OTRO, medico_id: MED, nombre: 'Control', activo: true }, error: null }
    expect(await comprobarTipoDelPut(s, {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: OTRO, antes, medicoEfectivo: MED, pacienteEfectivo: PAC,
    })).toEqual({ ok: true, columnas: { tipo_cita_id: OTRO, tipo_cita_nombre: 'Control' } })
  })

  it('quitar el tipo (null) limpia las dos columnas sin leer tipos_cita', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: TIPO }, error: null }
    expect(await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: null, antes, medicoEfectivo: MED, pacienteEfectivo: PAC,
    })).toEqual({ ok: true, columnas: { tipo_cita_id: null, tipo_cita_nombre: null } })
    expect(h.llamadas.some(l => l[1] === 'tipos_cita')).toBe(false)
  })

  it('un evento sin paciente que recibe un tipo: tipo_sin_paciente', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: null }, error: null }
    tipoEnBase()
    expect(await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: TIPO, antes: { medico_id: MED, paciente_id: null },
      medicoEfectivo: MED, pacienteEfectivo: null,
    })).toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_sin_paciente' } })
  })

  it('D6: una cita POR LIGAR (sin paciente) sí puede llevar tipo; un evento sigue sin poder', async () => {
    h.respuestas.appointments = { data: { tipo_cita_id: null }, error: null }
    tipoEnBase()
    const args = {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: TIPO, antes: { medico_id: MED, paciente_id: null },
      medicoEfectivo: MED, pacienteEfectivo: null,
    }
    expect(await comprobarTipoDelPut(await createClient(), { ...args, porLigar: true }))
      .toEqual({ ok: true, columnas: { tipo_cita_id: TIPO, tipo_cita_nombre: 'Primera vez' } })
    expect(await comprobarTipoDelPut(await createClient(), { ...args, porLigar: false }))
      .toMatchObject({ ok: false, status: 400, cuerpo: { error: 'tipo_sin_paciente' } })
  })

  it('sin poder leer la fila: 500', async () => {
    h.respuestas.appointments = { data: null, error: { message: 'caída' } }
    expect(await comprobarTipoDelPut(await createClient(), {
      clinicaId: 'c1', citaId: 'x', tipoDelCuerpo: TIPO, antes, medicoEfectivo: MED, pacienteEfectivo: PAC,
    })).toMatchObject({ ok: false, status: 500 })
  })
})

/* Sólo la mitad estática: que el select común no nombre las columnas. Que POST
   y PUT las ignoren con el interruptor apagado lo prueba la e2e
   `agenda-tipos-cita.e2e.ts` («API apagado»). */
describe('el select común no nombra tipo_cita_*', () => {
  it('APPOINTMENT_SELECT (GET, semilla, respuesta de POST/PUT) sigue siendo `*`, sin nombrar las columnas', async () => {
    const { APPOINTMENT_SELECT } = await import('@/lib/appointments')
    expect(APPOINTMENT_SELECT.startsWith('*,')).toBe(true)
    expect(APPOINTMENT_SELECT).not.toMatch(/tipo_cita/)
  })
})
