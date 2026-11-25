/**
 * sustitucionAsistencia.test.ts — tanda I, puntos 11 y 12 de Angel: lo puro de
 * la pregunta de asistencia (a quién y desde cuándo) y de la sustitución de una
 * cancelada (qué alta la cierra y qué lleva).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('sin red en pruebas') } }))

import { alcanceDeAsistencia, corteDeAsistencia, inicioDeAsistencia, leerAsistenciaPendiente, DIAS_QUE_SE_PREGUNTAN, HORAS_SIN_PREGUNTAR } from '@/lib/agenda/asistenciaServidor'
import { comprobarSustituible, leerSustituyeA } from '@/lib/agenda/sustitucionServidor'
import { altaParaReagendar, burbujaParaReasignar } from '@/components/agenda/InteraccionesV2'
import type { Appointment } from '@/lib/agenda/tiposAgenda'

const PERFIL = { id: 'm1', clinica_id: 'c1', es_admin_de_clinica: false } as const

describe('punto 11 · a quién se pregunta y desde cuándo', () => {
  it('el médico, las suyas; el administrador y la secretaria, las de la clínica; nadie más', () => {
    expect(alcanceDeAsistencia({ ...PERFIL, role: 'medico' })).toBe('m1')
    expect(alcanceDeAsistencia({ ...PERFIL, role: 'medico', es_admin_de_clinica: true })).toBe('')
    expect(alcanceDeAsistencia({ ...PERFIL, role: 'secretaria' })).toBe('')
  })
  it('el corte es 48 horas antes de ahora', () => {
    const ahora = Date.parse('2026-11-17T12:00:00.000Z')
    expect(HORAS_SIN_PREGUNTAR).toBe(48)
    expect(corteDeAsistencia(ahora)).toBe('2026-11-15T12:00:00.000Z')
  })
  it('y hacia atrás, 30 días: la consulta lleva los dos cortes', async () => {
    const ahora = Date.parse('2026-11-17T12:00:00.000Z')
    expect(DIAS_QUE_SE_PREGUNTAN).toBe(30)
    expect(inicioDeAsistencia(ahora)).toBe('2026-10-18T12:00:00.000Z')
    const filtros: string[] = []
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit']) q[m] = () => q
    q.lt = (c: string, v: string) => { filtros.push(`${c}<${v}`); return q }
    q.gte = (c: string, v: string) => { filtros.push(`${c}>=${v}`); return q }
    q.then = (ok: (r: { data: never[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
    const cliente = { from: () => q } as unknown as Parameters<typeof leerAsistenciaPendiente>[0]
    expect(await leerAsistenciaPendiente(cliente, { ...PERFIL, role: 'medico' }, ahora)).toEqual([])
    expect(filtros).toEqual(['start_time<2026-11-15T12:00:00.000Z', 'start_time>=2026-10-18T12:00:00.000Z'])
  })
})

describe('punto 12 · sustituir una cancelada', () => {
  it('`sustituye_a`: sin campo, nada; un uuid, ése; cualquier otra cosa, inválido', () => {
    expect(leerSustituyeA(undefined)).toBeUndefined()
    expect(leerSustituyeA(null)).toBeUndefined()
    expect(leerSustituyeA('0b6f3c1e-4a1d-4c5e-9f0a-1b2c3d4e5f60')).toBe('0b6f3c1e-4a1d-4c5e-9f0a-1b2c3d4e5f60')
    for (const malo of ['', 'abc', 7, {}]) expect(leerSustituyeA(malo)).toBe(false)
  })

  const CITA: Appointment = {
    id: 'k1', title: 'Hugo Interián', start_time: '2026-11-25T16:00:00.000Z', end_time: '2026-11-25T16:30:00.000Z', all_day: false,
    status: 'cancelled', notes: null, paciente_id: 'p1', medico_id: 'm1', google_event_id: null, gcal_sync_status: 'synced',
    updated_at: '2026-11-01T00:00:00Z', consultorio_id: 'co1', consultorio_nombre: 'Centro', consultorio_nombre_corto: 'C',
    consultorio_direccion: null, consultorio_telefono: null, consultorio_timezone: 'America/Merida', icono: null, color: null,
    pacientes: { id: 'p1', nombre: 'Hugo', apellidos: 'Interián', telefono: '9991234567' },
  }

  it('«Reagendar cita» de una CANCELADA con paciente la sustituye; la no asistida no', () => {
    const ahora = Date.parse('2026-11-17T12:00:00.000Z')
    expect(altaParaReagendar(CITA, ahora)).toMatchObject({ sustituyeA: 'k1' })
    expect(altaParaReagendar({ ...CITA, status: 'no_show' }, ahora)).not.toHaveProperty('sustituyeA')
  })

  it('«Reasignar»: la burbuja en ESE horario, sin paciente, y con la cancelada a cerrar', () => {
    const caja = { left: 10, top: 20, width: 100, height: 40 }
    const b = burbujaParaReasignar(CITA, caja)
    expect(b.sustituyeA).toBe('k1')
    expect(b.gesto).toMatchObject({ ancla: caja, desdeHueco: false })
    expect(b.gesto.inicio.toISOString()).toBe(CITA.start_time)
    expect(b.horas.inicio < b.horas.fin).toBe(true)
    expect(burbujaParaReasignar(CITA, null).gesto.ancla).toBeDefined()
  })
})

describe('integración I · sustituir sin la migración 20261121142000', () => {
  /** Un cliente de sesión mínimo: la lectura de la cita a sustituir contesta `respuesta`. */
  function cliente(respuesta: { data: unknown; error: { code: string } | null }): Parameters<typeof comprobarSustituible>[0] {
    const cadena = { select: () => cadena, eq: () => cadena, maybeSingle: async () => respuesta }
    return { from: () => cadena } as unknown as Parameters<typeof comprobarSustituible>[0]
  }
  it('columna ausente (42703 o PGRST204): no veta, el alta entra como antes de la tanda I', async () => {
    for (const code of ['42703', 'PGRST204']) {
      await expect(comprobarSustituible(cliente({ data: null, error: { code } }), 'c1', 'k1', null)).resolves.toBeNull()
    }
  })
  it('cualquier otro error de lectura sigue siendo un error', async () => {
    await expect(comprobarSustituible(cliente({ data: null, error: { code: '42501' } }), 'c1', 'k1', null)).rejects.toThrow('42501')
  })
})
