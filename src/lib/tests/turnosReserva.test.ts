/**
 * turnosReserva.test.ts — agenda D5: turnos ofrecidos por enlace en la zona
 * del consultorio, con anticipación, horizonte, horario propio frente al de
 * la clínica y la ocupación de la RPC (sin no_show ni cancelled, que la RPC
 * ya quitó). `turnoOfrecido` es el convenio de D3 (alineación y horario).
 */
import { describe, it, expect } from 'vitest'
import type { DiaSemana, Horario } from '@/lib/configApp'
import { ocupacionSinEstado, primerDia, rangoDeConsulta, reglasDe, turnoOfrecido, turnoValido, turnosDeDias } from '@/lib/reserva/turnosReserva'

function horario(inicio: string, fin: string): Horario {
  const dia = (d: DiaSemana) => ({ activo: d !== 'domingo', inicio, fin })
  return { lunes: dia('lunes'), martes: dia('martes'), miercoles: dia('miercoles'), jueves: dia('jueves'),
    viernes: dia('viernes'), sabado: dia('sabado'), domingo: dia('domingo') }
}
const AJ = { anticipacion_min_horas: 2, horizonte_dias: 60 }
const MERIDA = 'America/Merida'   // UTC-6 sin horario de verano
// Martes 2031-05-06, 08:00 en Mérida = 14:00Z.
const AHORA = new Date('2031-05-05T12:00:00Z')

describe('reglasDe', () => {
  it('horario propio manda; si no, el de la clínica; sin ninguno, HORARIO_DEFAULT', () => {
    const propio = reglasDe({ horario: horario('10:00', '12:00'), horario_propio: true, timezone: MERIDA }, horario('08:00', '18:00'), 30, AJ)
    expect(propio.horario.martes).toEqual({ activo: true, inicio: '10:00', fin: '12:00' })
    const clinica = reglasDe({ horario: horario('10:00', '12:00'), horario_propio: false, timezone: MERIDA }, horario('08:00', '18:00'), 30, AJ)
    expect(clinica.horario.martes.inicio).toBe('08:00')
    const nada = reglasDe({ horario: null, horario_propio: false, timezone: MERIDA }, null, 30, AJ)
    expect(nada.horario.lunes.activo).toBe(true)
  })
})

describe('turnosDeDias / turnoOfrecido', () => {
  const r = reglasDe({ horario: horario('08:00', '10:00'), horario_propio: true, timezone: MERIDA }, null, 30, AJ)

  it('turnos de 30 min en la zona del consultorio, y la ocupación los quita', () => {
    const [dia] = turnosDeDias(r, '2031-05-06', [], AHORA, 1)
    expect(dia?.turnos.map(t => t.inicio)).toEqual([
      '2031-05-06T14:00:00.000Z', '2031-05-06T14:30:00.000Z', '2031-05-06T15:00:00.000Z', '2031-05-06T15:30:00.000Z'])
    const ocup = ocupacionSinEstado([{ start_time: '2031-05-06T14:30:00Z', end_time: '2031-05-06T15:00:00Z' }])
    const [conCita] = turnosDeDias(r, '2031-05-06', ocup, AHORA, 1)
    expect(conCita?.turnos.map(t => t.inicio)).not.toContain('2031-05-06T14:30:00.000Z')
  })

  it('anticipación: nada antes de ahora + 2 h; horizonte: nada a 60 días o más', () => {
    const casiYa = new Date('2031-05-06T13:00:00Z')   // 07:00 Mérida: 08:00 y 08:30 caen antes de las 09:00
    const [dia] = turnosDeDias(r, '2031-05-06', [], casiYa, 1)
    expect(dia?.turnos[0]?.inicio).toBe('2031-05-06T15:00:00.000Z')
    const lejos = turnosDeDias(r, '2031-07-04', [], AHORA, 1)[0]
    expect(lejos?.turnos).toEqual([])
  })

  it('turnoOfrecido: alineado y en horario sí; desalineado, fuera de horario u ocupado no', () => {
    expect(turnoOfrecido(r, '2031-05-06T14:30:00Z', [], AHORA)?.fin).toBe('2031-05-06T15:00:00.000Z')
    expect(turnoOfrecido(r, '2031-05-06T14:15:00Z', [], AHORA)).toBeNull()       // no alineado al paso
    expect(turnoOfrecido(r, '2031-05-06T16:00:00Z', [], AHORA)).toBeNull()       // 10:00, ya cerró
    expect(turnoOfrecido(r, '2031-05-11T14:00:00Z', [], AHORA)).toBeNull()       // domingo cerrado
    const ocup = ocupacionSinEstado([{ start_time: '2031-05-06T14:20:00Z', end_time: '2031-05-06T14:40:00Z' }])
    expect(turnoOfrecido(r, '2031-05-06T14:30:00Z', ocup, AHORA)).toBeNull()
    expect(turnoOfrecido(r, 'basura', [], AHORA)).toBeNull()
  })

  it('primerDia sube una fecha pasada a hoy en la zona; rango de 7 días de medianoche a medianoche', () => {
    expect(primerDia('2020-01-01', MERIDA, AHORA)).toBe('2031-05-05')
    expect(primerDia('2031-05-09', MERIDA, AHORA)).toBe('2031-05-09')
    expect(rangoDeConsulta('2031-05-06', MERIDA)).toEqual({ desde: '2031-05-06T06:00:00.000Z', hasta: '2031-05-13T06:00:00.000Z' })
  })
})

describe('turnoValido (P9: los turnos arrancan en cada hueco)', () => {
  const r = reglasDe({ horario: { lunes: { activo: true, inicio: '08:00', fin: '10:00' }, martes: { activo: true, inicio: '08:00', fin: '10:00' },
    miercoles: { activo: false, inicio: '08:00', fin: '10:00' }, jueves: { activo: false, inicio: '08:00', fin: '10:00' },
    viernes: { activo: false, inicio: '08:00', fin: '10:00' }, sabado: { activo: false, inicio: '08:00', fin: '10:00' },
    domingo: { activo: false, inicio: '08:00', fin: '10:00' } }, horario_propio: true, timezone: 'America/Merida' }, null, 30, AJ)
  const AHORA2 = new Date('2031-05-05T12:00:00Z')
  // Martes 2031-05-06: cita de 08:00 a 08:20 → turnos 08:20, 08:50, 09:20.
  const ocup = ocupacionSinEstado([{ start_time: '2031-05-06T14:00:00Z', end_time: '2031-05-06T14:20:00Z' }])

  it('un turno que arranca en el hueco (08:20) vale aunque no esté alineado a la jornada', () => {
    expect(turnoValido(r, '2031-05-06T14:20:00Z', ocup, AHORA2)?.fin).toBe('2031-05-06T14:50:00.000Z')
  })
  it('alineado a la jornada también vale (la RPC dirá si está ocupado)', () => {
    expect(turnoValido(r, '2031-05-06T14:30:00Z', ocup, AHORA2)).not.toBeNull()
  })
  it('el reenvío: la cita idéntica (la propia) no lo invalida', () => {
    const propia = ocupacionSinEstado([{ start_time: '2031-05-06T14:20:00Z', end_time: '2031-05-06T14:50:00Z' }, ...ocup])
    expect(turnoValido(r, '2031-05-06T14:20:00Z', propia, AHORA2)).not.toBeNull()
  })
  it('desalineado o fuera de horario: no', () => {
    expect(turnoValido(r, '2031-05-06T14:25:00Z', ocup, AHORA2)).toBeNull()
    expect(turnoValido(r, '2031-05-06T16:00:00Z', ocup, AHORA2)).toBeNull()
    expect(turnoValido(r, 'x', ocup, AHORA2)).toBeNull()
  })
})
