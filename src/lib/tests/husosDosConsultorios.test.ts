/**
 * husosDosConsultorios.test.ts — un médico con dos consultorios en zonas
 * distintas (tanda T2, punto 11): Mérida (UTC-6, sin horario de verano) y
 * Tijuana (UTC-8 en noviembre). Mismo horario propio en los dos (lunes de
 * 09:00 a 11:00). Lo que se comprueba, con las funciones reales:
 *
 *   · turnos del enlace: cada consultorio ofrece SUS 09:00, que son instantes
 *     distintos (15:00Z y 17:00Z);
 *   · recordatorio por correo: «a las 09:00 (zona horaria: Baja California)»;
 *   · página de confirmación: «… 09:00 h» con la etiqueta de la zona;
 *   · la agenda: FullCalendar dibuja en la hora del DISPOSITIVO; la tarjeta de
 *     la cita de Tijuana vista desde Mérida cae a las 11:00 y lleva la etiqueta
 *     «09:00 hora Baja California» (la misma cuenta que `renderEventContent`).
 *     La banda gris del horario propio (`horarioDeLaRejilla`) también se
 *     dibuja en la hora del dispositivo: NO se cambió (documentado en las
 *     notas de la tanda).
 */
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { reglasDe } from '@/lib/reserva/turnosReserva'
import { turnosDelDia } from '@/lib/agenda/turnosAgenda'
import { correoRecordatorio } from '@/lib/confirmacion/correosCita'
import { citaPintada } from '@/lib/confirmacion/vistaConfirmacion'
import { horaEnTZ } from '@/lib/agenda/fechasAgenda'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'
import { horarioDeLaRejilla } from '@/lib/agenda/horarioRejilla'
import { avisoFueraDeHorario } from '@/lib/agenda/horarioAgenda'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import type { Horario } from '@/lib/configApp'

const CERRADO = { activo: false, inicio: '09:00', fin: '11:00' }
const LUNES_9_11: Horario = {
  lunes: { activo: true, inicio: '09:00', fin: '11:00' }, martes: CERRADO, miercoles: CERRADO, jueves: CERRADO,
  viernes: CERRADO, sabado: CERRADO, domingo: CERRADO,
}
const MERIDA = { id: 'merida', medico_id: 'medico', timezone: 'America/Merida', horario: LUNES_9_11, horario_propio: true, activo: true }
const TIJUANA = { id: 'tijuana', medico_id: 'medico', timezone: 'America/Tijuana', horario: LUNES_9_11, horario_propio: true, activo: true }
const AJUSTES = { anticipacion_min_horas: 0, horizonte_dias: 60 }
const LUNES = '2026-11-23'
const CITA_TIJUANA = '2026-11-23T17:00:00.000Z'

function turnos(c: typeof MERIDA): string[] {
  const r = reglasDe(c, null, 30, AJUSTES)
  return turnosDelDia({ fecha: LUNES, tz: r.tz, horario: r.horario, citas: [], duracionMin: 30 }).map(t => t.inicio)
}

describe('un médico, dos consultorios en zonas distintas', () => {
  /* El aviso de fuera de horario lee la hora del DISPOSITIVO (`getHours`): se fija la de Mérida. */
  const TZ_ORIGINAL = process.env.TZ
  beforeAll(() => { process.env.TZ = 'America/Merida' })
  afterAll(() => { process.env.TZ = TZ_ORIGINAL })

  it('turnos del enlace: cada consultorio ofrece sus 09:00 locales', () => {
    expect(turnos(MERIDA).map(i => new Date(i).toISOString())).toEqual(
      ['2026-11-23T15:00:00.000Z', '2026-11-23T15:30:00.000Z', '2026-11-23T16:00:00.000Z', '2026-11-23T16:30:00.000Z'])
    expect(turnos(TIJUANA).map(i => new Date(i).toISOString())).toEqual(
      ['2026-11-23T17:00:00.000Z', '2026-11-23T17:30:00.000Z', '2026-11-23T18:00:00.000Z', '2026-11-23T18:30:00.000Z'])
  })

  it('recordatorio: la hora y la zona del consultorio de la cita', () => {
    const correo = correoRecordatorio({
      inicio: CITA_TIJUANA, zona: 'America/Tijuana', medico: 'Dr. Admin Semilla Uno',
      consultorio: { nombre: 'Consultorio Tijuana', direccion: null, telefono: null }, confirmada: false,
      url: 'http://localhost:3000/confirmar/AAAAAAAAAAAAAAAAAAAAAA',
    })
    expect(correo.texto).toContain('lunes, 23 de noviembre a las 09:00 (zona horaria: Baja California)')
  })

  it('página de confirmación: «09:00 h» y la etiqueta de la zona del Pacífico', () => {
    const ctx: ContextoConfirmacion = {
      clinica_id: '00000000-0000-4000-8000-000000000001', estado: 'agendada', inicio: CITA_TIJUANA,
      fin: '2026-11-23T17:30:00.000Z', zona: 'America/Tijuana', medico: null,
      consultorio: { nombre: 'Consultorio Tijuana', direccion: null, telefono: null }, puede_confirmar: true,
      puede_cancelar: true, corte_cancelar: CITA_TIJUANA, respuesta: null, codigo_hash: 'x',
    }
    const pintada = citaPintada(ctx)
    expect(pintada.cuando).toContain('09:00 h')
    expect(pintada.zona).toMatch(/Pacífico/)
  })

  it('agenda en un dispositivo de Mérida: la tarjeta cae a las 11:00 con «09:00 hora Baja California»', () => {
    expect(horaEnTZ(CITA_TIJUANA, 'America/Merida')).toBe('11:00')
    expect(`${horaEnTZ(CITA_TIJUANA, 'America/Tijuana')} hora ${regionDeTimezone('America/Tijuana')}`).toBe('09:00 hora Baja California')
  })

  it('la banda del horario propio de Tijuana se dibuja en la hora del dispositivo (resto conocido, sin cambiar)', () => {
    const h = horarioDeLaRejilla({
      agendaV2: true, horarioClinica: null, consultorios: [MERIDA, TIJUANA], consultorioActivo: TIJUANA, medicoMostrado: 'medico',
    })
    // La cita de las 09:00 de Tijuana se pinta a las 11:00 de Mérida: la rejilla (09–11) la ve FUERA de horario.
    expect(avisoFueraDeHorario(new Date(CITA_TIJUANA), h, 'Vas a agendar a las')).not.toBeNull()
  })
})
