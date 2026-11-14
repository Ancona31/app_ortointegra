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

describe('rejilla fija (G2, punto 9): la lista y la comprobación al reservar usan la misma regla', () => {
  // Martes 2031-05-06 en Mérida (UTC-6), jornada 09:00–13:00, consulta de 45 min.
  const dia = { activo: true, inicio: '09:00', fin: '13:00' }
  const cerrado = { activo: false, inicio: '09:00', fin: '13:00' }
  const h: Horario = { lunes: dia, martes: dia, miercoles: cerrado, jueves: cerrado, viernes: cerrado, sabado: cerrado, domingo: cerrado }
  const r = reglasDe({ horario: h, horario_propio: true, timezone: MERIDA }, null, 45, AJ)
  const Z = (hhmm: string) => {
    const [hh = '0', mm = '0'] = hhmm.split(':')
    return new Date(Date.UTC(2031, 4, 6, Number(hh) + 6, Number(mm))).toISOString()
  }
  const lista = (ocup: ReturnType<typeof ocupacionSinEstado>) =>
    turnosDeDias(r, '2031-05-06', ocup, AHORA, 1)[0]?.turnos.map(t => t.inicio) ?? []

  it('con 45 min desde las 9:00 son 9:00, 9:45, 10:30, 11:15 y 12:00 (el resto no llega a un turno)', () => {
    expect(lista([])).toEqual(['09:00', '09:45', '10:30', '11:15', '12:00'].map(Z))
  })

  it('si algo ocupa PARTE de un turno, ese turno no se ofrece y los demás no se corren', () => {
    // Cita de 10:00 a 10:20: tapa la de 9:45 (en parte). Antes (P9) salía 10:20.
    const ocup = ocupacionSinEstado([{ start_time: Z('10:00'), end_time: Z('10:20') }])
    expect(lista(ocup)).toEqual(['09:00', '10:30', '11:15', '12:00'].map(Z))
    // Tocar el extremo no ocupa: una cita de 9:45 a 10:30 sólo quita la de 9:45.
    expect(lista(ocupacionSinEstado([{ start_time: Z('09:45'), end_time: Z('10:30') }]))).toEqual(['09:00', '10:30', '11:15', '12:00'].map(Z))
  })

  it('lo de todo el día (sus puntas son las medianoches de la zona) tapa el día entero', () => {
    const todoElDia = ocupacionSinEstado([{ start_time: '2031-05-06T06:00:00Z', end_time: '2031-05-07T06:00:00Z' }])
    expect(lista(todoElDia)).toEqual([])
  })

  it('turnoValido es la rejilla: alineada sí aunque esté ocupada (la RPC dirá «ocupado»); fuera de la rejilla, nunca', () => {
    const ocup = ocupacionSinEstado([{ start_time: Z('10:00'), end_time: Z('10:20') }])
    for (const t of ['09:00', '09:45', '10:30', '12:00']) expect(turnoValido(r, Z(t), AHORA)?.inicio).toBe(Z(t))
    expect(turnoValido(r, Z('10:20'), AHORA)).toBeNull()      // el turno de P9 tras la cita: ya no
    expect(turnoValido(r, Z('12:45'), AHORA)).toBeNull()      // no cabe entero antes de las 13:00
    expect(turnoValido(r, Z('08:15'), AHORA)).toBeNull()      // antes de abrir
    expect(turnoValido(r, 'x', AHORA)).toBeNull()
    // Lo que la lista ofrece con cualquier ocupación es válido, y lo único que la
    // lista quita es lo que la RPC rechazaría (algo que toca el turno).
    for (const t of lista(ocup)) expect(turnoValido(r, t, AHORA)).not.toBeNull()
  })

  it('husos: la rejilla se cuenta en la zona del consultorio (Tijuana en horario de verano)', () => {
    const tj = reglasDe({ horario: h, horario_propio: true, timezone: 'America/Tijuana' }, null, 45, AJ)
    const [d] = turnosDeDias(tj, '2031-05-06', [], AHORA, 1)
    expect(d?.turnos[0]?.inicio).toBe('2031-05-06T16:00:00.000Z')   // 09:00 PDT
    expect(d?.turnos[1]?.inicio).toBe('2031-05-06T16:45:00.000Z')
    expect(turnoValido(tj, '2031-05-06T16:45:00.000Z', AHORA)).not.toBeNull()
    expect(turnoValido(tj, '2031-05-06T15:45:00.000Z', AHORA)).toBeNull()  // 9:45 de Mérida, no de Tijuana
  })
})
