/**
 * horarioRejilla.test.ts — qué horario pinta la agenda y usan los avisos de
 * fuera de horario (tanda T2, punto 10): con la v2, el del consultorio activo
 * cuando tiene horario propio; si no, el de la clínica; apagada, el de la
 * clínica, el MISMO objeto (identidad estable para FullCalendar).
 */
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { consultorioDeLaRejilla, horarioDeLaRejilla, type ConsultorioRejilla, type EntradaRejilla } from '@/lib/agenda/horarioRejilla'
import { HORARIO_DEFAULT, avisoFueraDeHorario } from '@/lib/agenda/horarioAgenda'
import type { Horario } from '@/lib/configApp'

const CLINICA: Horario = {
  lunes: { activo: true, inicio: '08:00', fin: '18:00' }, martes: { activo: true, inicio: '08:00', fin: '18:00' },
  miercoles: { activo: true, inicio: '08:00', fin: '18:00' }, jueves: { activo: true, inicio: '08:00', fin: '18:00' },
  viernes: { activo: true, inicio: '08:00', fin: '18:00' }, sabado: { activo: true, inicio: '08:00', fin: '13:00' },
  domingo: { activo: false, inicio: '09:00', fin: '14:00' },
}
const PROPIO: Horario = { ...CLINICA, lunes: { activo: true, inicio: '08:00', fin: '12:00' } }

const REHAB: ConsultorioRejilla = { id: 'rehab', medico_id: 'invitada', horario: PROPIO, horario_propio: true, activo: true }
const CENTRO: ConsultorioRejilla = { id: 'centro', medico_id: 'admin', horario: PROPIO, horario_propio: true, activo: true }
const NORTE: ConsultorioRejilla = { id: 'norte', medico_id: 'admin', horario: CLINICA, horario_propio: false, activo: true }

const BASE: EntradaRejilla = {
  agendaV2: true, horarioClinica: CLINICA, consultorios: [REHAB, CENTRO, NORTE], consultorioActivo: null, medicoMostrado: 'invitada',
}

describe('horarioDeLaRejilla', () => {
  /* El aviso de fuera de horario lee la hora del DISPOSITIVO (`getHours`): se fija la de Mérida. */
  const TZ_ORIGINAL = process.env.TZ
  beforeAll(() => { process.env.TZ = 'America/Merida' })
  afterAll(() => { process.env.TZ = TZ_ORIGINAL })

  it('apagada: el de la clínica, el mismo objeto, aunque el consultorio tenga uno propio', () => {
    expect(horarioDeLaRejilla({ ...BASE, agendaV2: false })).toBe(CLINICA)
    expect(horarioDeLaRejilla({ ...BASE, agendaV2: false, horarioClinica: undefined })).toBe(HORARIO_DEFAULT)
  })

  it('encendida: el propio del único consultorio del médico mostrado; el aviso lo usa', () => {
    const h = horarioDeLaRejilla(BASE)
    expect(h.lunes).toEqual({ activo: true, inicio: '08:00', fin: '12:00' })
    // Lunes 13:00 en Mérida: dentro del de la clínica, fuera del propio.
    const lunes13 = new Date('2026-11-16T19:00:00Z')
    expect(avisoFueraDeHorario(lunes13, CLINICA, 'Vas a agendar a las')).toBeNull()
    expect(avisoFueraDeHorario(lunes13, h, 'Vas a agendar a las')).not.toBeNull()
  })

  it('con «Todos los médicos» o sin médico: el de la clínica', () => {
    expect(horarioDeLaRejilla({ ...BASE, medicoMostrado: null })).toBe(CLINICA)
  })

  it('médico con dos consultorios: el activo de la app si es suyo; sin elegir, el de la clínica', () => {
    const admin = { ...BASE, medicoMostrado: 'admin' }
    expect(horarioDeLaRejilla(admin)).toBe(CLINICA)
    expect(horarioDeLaRejilla({ ...admin, consultorioActivo: CENTRO }).lunes.fin).toBe('12:00')
    expect(horarioDeLaRejilla({ ...admin, consultorioActivo: NORTE })).toBe(CLINICA)
    // El activo de OTRO médico no cuenta: cae a la regla del único consultorio.
    expect(consultorioDeLaRejilla({ ...BASE, consultorioActivo: CENTRO })).toBe(REHAB)
  })

  it('un consultorio sin horario propio usa el de la clínica (la plantilla)', () => {
    expect(horarioDeLaRejilla({ ...BASE, consultorios: [{ ...REHAB, horario_propio: false }] })).toBe(CLINICA)
  })
})
