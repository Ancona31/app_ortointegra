/**
 * horarioRejilla.test.ts — la fuente única del horario de la agenda (puntos
 * 10 a 13 y 19 de Angel): qué consultorios cuentan, el horario y el gris en la
 * hora del dispositivo (con los de otra zona convertidos), la identidad estable
 * de la salida, y el aviso de fuera de horario en la hora del consultorio de
 * la cita. Apagada: el de la clínica, el MISMO objeto, y los avisos de siempre.
 *
 * Las horas de los avisos dependen del huso del dispositivo (`getHours`): se
 * fija el de Mérida, como en `husosDosConsultorios.test.ts`.
 */
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import {
  consultoriosDeLaRejilla, crearAvisosHorario, desfaseConDispositivo, fuenteDeLaRejilla, horariosParaAviso,
  type ConsultorioRejilla, type EntradaAvisos,
} from '@/lib/agenda/horarioRejilla'
import { HORARIO_DEFAULT, avisoFueraDeHorario, avisoFinFueraDeHorario, avisoDiaCerrado } from '@/lib/agenda/horarioAgenda'
import type { Horario, HorarioDia } from '@/lib/configApp'

const CERRADO: HorarioDia = { activo: false, inicio: '09:00', fin: '14:00' }
function semana(lv: HorarioDia, sabado: HorarioDia = CERRADO, domingo: HorarioDia = CERRADO): Horario {
  return { lunes: lv, martes: lv, miercoles: lv, jueves: lv, viernes: lv, sabado, domingo }
}
const abre = (inicio: string, fin: string): HorarioDia => ({ activo: true, inicio, fin })

const CLINICA = semana(abre('08:00', '18:00'), abre('08:00', '13:00'))
const MERIDA = 'America/Merida'
const TIJUANA = 'America/Tijuana'

/* Semilla A, con horarios propios distintos: el administrador con dos (Centro de
   mañana, Norte de tarde) y la invitada con uno (Rehab, también sábado). */
const CENTRO: ConsultorioRejilla = { id: 'centro', medico_id: 'admin', timezone: MERIDA, horario: semana(abre('08:00', '12:00')), horario_propio: true, activo: true }
const NORTE: ConsultorioRejilla = { id: 'norte', medico_id: 'admin', timezone: MERIDA, horario: semana(abre('15:00', '19:00')), horario_propio: true, activo: true }
const REHAB: ConsultorioRejilla = { id: 'rehab', medico_id: 'invitada', timezone: MERIDA, horario: semana(abre('10:00', '14:00'), abre('09:00', '13:00')), horario_propio: true, activo: true }
const ARCHIVADO: ConsultorioRejilla = { id: 'viejo', medico_id: 'admin', timezone: MERIDA, horario: semana(abre('05:00', '23:00')), horario_propio: true, activo: false }
const TODOS = [CENTRO, NORTE, REHAB, ARCHIVADO]

/* Un médico con dos consultorios en zonas distintas, 09:00–11:00 cada uno en SU hora. */
const MED_MERIDA: ConsultorioRejilla = { id: 'm', medico_id: 'medico', timezone: MERIDA, horario: semana(abre('09:00', '11:00')), horario_propio: true, activo: true }
const MED_TIJUANA: ConsultorioRejilla = { id: 't', medico_id: 'medico', timezone: TIJUANA, horario: semana(abre('09:00', '11:00')), horario_propio: true, activo: true }

const NOV = Date.parse('2026-11-23T18:00:00Z') // lunes; Tijuana UTC-8, Mérida UTC-6
const JUL = Date.parse('2026-07-20T18:00:00Z') // lunes; Tijuana UTC-7 (horario de verano)

const fuente = (seleccion: readonly ConsultorioRejilla[], referencia = NOV) =>
  fuenteDeLaRejilla({ agendaV2: true, horarioClinica: CLINICA, seleccion, zonaDispositivo: MERIDA, referencia })

describe('consultoriosDeLaRejilla — qué consultorios cuentan', () => {
  it('«Todos los médicos»: todos los activos, de todos los médicos', () => {
    expect(consultoriosDeLaRejilla({ consultorios: TODOS, consultorioActivo: CENTRO, medicoMostrado: null }).map(c => c.id))
      .toEqual(['centro', 'norte', 'rehab'])
  })
  it('un médico concreto: la unión de los suyos', () => {
    expect(consultoriosDeLaRejilla({ consultorios: TODOS, consultorioActivo: null, medicoMostrado: 'admin' }).map(c => c.id))
      .toEqual(['centro', 'norte'])
  })
  it('con su consultorio activo elegido en el menú lateral: sólo ése', () => {
    expect(consultoriosDeLaRejilla({ consultorios: TODOS, consultorioActivo: NORTE, medicoMostrado: 'admin' })).toEqual([NORTE])
  })
  it('el consultorio activo de OTRO médico no cuenta: la unión del filtrado', () => {
    expect(consultoriosDeLaRejilla({ consultorios: TODOS, consultorioActivo: CENTRO, medicoMostrado: 'invitada' })).toEqual([REHAB])
  })
})

describe('fuenteDeLaRejilla — apagada, lo de antes al bit', () => {
  it('el horario de la clínica, el MISMO objeto, y sin businessHours propios', () => {
    const f = fuenteDeLaRejilla({ agendaV2: false, horarioClinica: CLINICA, seleccion: [CENTRO], zonaDispositivo: MERIDA, referencia: NOV })
    expect(f.horario).toBe(CLINICA)
    expect(f.businessHours).toBeNull()
    expect(fuenteDeLaRejilla({ agendaV2: false, horarioClinica: undefined, seleccion: [], zonaDispositivo: MERIDA, referencia: NOV }).horario)
      .toBe(HORARIO_DEFAULT)
  })
  it('con la v2 y sin consultorios (médico sin ninguno): también el de la clínica', () => {
    expect(fuente([]).horario).toBe(CLINICA)
  })
})

describe('fuenteDeLaRejilla — varios consultorios con horarios distintos', () => {
  it('«Todos»: de la apertura más temprana al cierre más tardío, día por día', () => {
    const f = fuente([CENTRO, NORTE, REHAB])
    expect(f.horario.lunes).toEqual(abre('08:00', '19:00'))
    expect(f.horario.sabado).toEqual(abre('09:00', '13:00'))
    expect(f.horario.domingo.activo).toBe(false)
  })
  it('el gris respeta el hueco entre consultorios: un tramo por consultorio y día', () => {
    const lunes = fuente([CENTRO, NORTE]).businessHours?.filter(b => b.daysOfWeek[0] === 1)
    expect(lunes).toEqual([
      { daysOfWeek: [1], startTime: '08:00', endTime: '12:00' },
      { daysOfWeek: [1], startTime: '15:00', endTime: '19:00' },
    ])
  })
  it('un médico concreto: su unión; con el consultorio activo, sólo el de ése', () => {
    expect(fuente([CENTRO, NORTE]).horario.martes).toEqual(abre('08:00', '19:00'))
    expect(fuente([NORTE]).horario.martes).toEqual(abre('15:00', '19:00'))
  })
  it('consultorios con exactamente el horario de la clínica (recién migrados): el MISMO objeto y sin gris propio', () => {
    const copia = (c: ConsultorioRejilla): ConsultorioRejilla => ({ ...c, horario: JSON.parse(JSON.stringify(CLINICA)) })
    const f = fuente([copia(CENTRO), copia(NORTE)])
    expect(f.horario).toBe(CLINICA)
    expect(f.businessHours).toBeNull()
    // Basta un consultorio distinto para que mande la unión.
    expect(fuente([copia(CENTRO), NORTE]).horario).not.toBe(CLINICA)
  })
  it('un consultorio sin horario propio usa el de la clínica (la herencia aún no aplicada)', () => {
    expect(fuente([{ ...REHAB, horario_propio: false }]).horario.lunes).toEqual(abre('08:00', '18:00'))
  })
  it('con la salida anterior y el mismo contenido, devuelve ESE objeto (aunque los arrays sean nuevos); si cambia, uno nuevo', () => {
    const a = fuente([CENTRO, NORTE])
    const entrada = { agendaV2: true, horarioClinica: CLINICA, zonaDispositivo: MERIDA, referencia: NOV }
    const b = fuenteDeLaRejilla({ ...entrada, seleccion: [{ ...CENTRO }, { ...NORTE }] }, a)
    expect(b).toBe(a)
    expect(b.horario).toBe(a.horario)
    expect(b.businessHours).toBe(a.businessHours)
    expect(fuenteDeLaRejilla({ ...entrada, seleccion: [NORTE] }, a)).not.toBe(a)
  })
})

describe('fuenteDeLaRejilla — un médico con consultorios en Mérida y en Tijuana', () => {
  it('desfase de Tijuana a Mérida: +2 h en noviembre, +1 h en julio', () => {
    expect(desfaseConDispositivo(TIJUANA, MERIDA, NOV)).toBe(120)
    expect(desfaseConDispositivo(TIJUANA, MERIDA, JUL)).toBe(60)
    expect(desfaseConDispositivo(MERIDA, MERIDA, NOV)).toBe(0)
    expect(desfaseConDispositivo('Zona/Inventada', MERIDA, NOV)).toBe(0)
  })
  it('el gris de Tijuana se convierte a la hora del dispositivo (09–11 de Tijuana = 11–13 de Mérida)', () => {
    const f = fuente([MED_MERIDA, MED_TIJUANA])
    expect(f.businessHours?.filter(b => b.daysOfWeek[0] === 1)).toEqual([
      { daysOfWeek: [1], startTime: '09:00', endTime: '11:00' },
      { daysOfWeek: [1], startTime: '11:00', endTime: '13:00' },
    ])
    expect(f.horario.lunes).toEqual(abre('09:00', '13:00'))
  })
  it('en julio el desfase es otro y el gris lo sigue (10–12 de Mérida)', () => {
    expect(fuente([MED_TIJUANA], JUL).horario.lunes).toEqual(abre('10:00', '12:00'))
  })
  it('un tramo que la conversión lleva más allá de medianoche se parte en los dos días', () => {
    const noche: ConsultorioRejilla = { ...MED_TIJUANA, horario: semana(CERRADO, abre('21:00', '23:30')) }
    const bh = fuente([noche]).businessHours
    expect(bh).toEqual([
      { daysOfWeek: [0], startTime: '00:00', endTime: '01:30' },
      { daysOfWeek: [6], startTime: '23:00', endTime: '24:00' },
    ])
  })
})

describe('crearAvisosHorario — en la hora del consultorio de la cita', () => {
  const TZ_ORIGINAL = process.env.TZ
  beforeAll(() => { process.env.TZ = MERIDA })
  afterAll(() => { process.env.TZ = TZ_ORIGINAL })

  const entrada = (o: Partial<EntradaAvisos> = {}): EntradaAvisos => ({
    agendaV2: true, horarioClinica: CLINICA, consultorios: [MED_MERIDA, MED_TIJUANA, ...TODOS], seleccion: [MED_TIJUANA], ...o,
  })

  it('apagada: exactamente los avisos de siempre (la clínica, en la hora del dispositivo)', () => {
    const a = crearAvisosHorario(entrada({ agendaV2: false }))
    const lunes19 = new Date(2026, 10, 23, 19, 0)
    const lunes1730 = new Date(2026, 10, 23, 17, 30)
    expect(a.hora(lunes19, null, 'Vas a agendar a las', { consultorioId: 't' })).toBe(avisoFueraDeHorario(lunes19, CLINICA, 'Vas a agendar a las'))
    expect(a.hora(lunes1730, lunes19, 'Vas a moverlo a las')).toBe(avisoFinFueraDeHorario(lunes19, CLINICA))
    expect(a.dia(new Date(2026, 10, 29, 12, 0))).toBe(avisoDiaCerrado(new Date(2026, 10, 29, 12, 0), CLINICA))
    expect(horariosParaAviso(entrada({ agendaV2: false }))[0].horario).toBe(CLINICA)
  })

  it('una cita a las 09:00 de Tijuana (11:00 en Mérida) NO avisa: sin falsos positivos', () => {
    const a = crearAvisosHorario(entrada())
    const inicio = new Date('2026-11-23T17:00:00Z')
    const fin = new Date('2026-11-23T17:30:00Z')
    expect(a.hora(inicio, fin, 'Vas a moverlo a las', { consultorioId: 't' })).toBeNull()
    // La regla de antes (horario de Tijuana leído en la hora del dispositivo) sí avisaba.
    expect(avisoFueraDeHorario(inicio, MED_TIJUANA.horario as Horario, 'Vas a moverlo a las')).not.toBeNull()
  })

  it('fuera del horario de Tijuana avisa con la hora y la zona del consultorio', () => {
    const a = crearAvisosHorario(entrada())
    const aviso = a.hora(new Date('2026-11-23T19:30:00Z'), null, 'Vas a moverlo a las', { consultorioId: 't' })
    expect(aviso).toBe('Vas a moverlo a las 11:30 hora Baja California, y este consultorio atiende de 09:00 a 11:00. ¿Es correcto?')
  })

  it('el fin también se mide en la zona del consultorio', () => {
    const a = crearAvisosHorario(entrada())
    const aviso = a.hora(new Date('2026-11-23T18:30:00Z'), new Date('2026-11-23T19:30:00Z'), 'Empezaría a las', { consultorioId: 't' })
    expect(aviso).toBe('Terminaría a las 11:30 hora Baja California, y este consultorio atiende de 09:00 a 11:00. ¿Es correcto?')
  })

  it('en el consultorio de Mérida, la misma hora de pared sin etiqueta de zona', () => {
    const a = crearAvisosHorario(entrada())
    expect(a.hora(new Date(2026, 10, 23, 11, 30), null, 'Vas a agendar a las', { consultorioId: 'm' }))
      .toBe('Vas a agendar a las 11:30, y este consultorio atiende de 09:00 a 11:00. ¿Es correcto?')
  })

  it('sin consultorio: los del médico de la cita; cabe en cualquiera, no avisa', () => {
    const a = crearAvisosHorario(entrada())
    expect(a.hora(new Date(2026, 10, 23, 16, 0), null, 'Vas a agendar a las', { medicoId: 'admin' })).toBeNull()
    expect(a.hora(new Date(2026, 10, 23, 13, 0), null, 'Vas a agendar a las', { medicoId: 'admin' })).not.toBeNull()
  })

  it('sin consultorio ni médico (un alta desde la rejilla): los de la rejilla', () => {
    const a = crearAvisosHorario(entrada({ seleccion: [CENTRO, NORTE] }))
    expect(a.hora(new Date(2026, 10, 23, 16, 0), null, 'Vas a agendar a las')).toBeNull()
    expect(a.dia(new Date(2026, 10, 29, 12, 0))).toBe('Vas a agendar un domingo, y este consultorio no atiende los domingos. ¿Es correcto?')
    expect(a.dia(new Date(2026, 10, 24, 12, 0))).toBeNull()
  })
})
