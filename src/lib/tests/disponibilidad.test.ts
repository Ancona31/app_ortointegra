/**
 * disponibilidad.test.ts — qué horario manda para ofrecer turnos en un
 * consultorio (plan del bloque B, paso B5): el de la clínica salvo que el
 * consultorio tenga `horario_propio = true`, y los días dudosos salen
 * cerrados (falla cerrado).
 */
import { describe, it, expect } from 'vitest'
import { horarioEfectivo, horarioEnOrden } from '@/lib/agenda/disponibilidad'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import type { Horario } from '@/lib/configApp'

const CERRADO = { activo: false, inicio: '09:00', fin: '19:00' }

const CLINICA: Horario = {
  lunes:     { activo: true,  inicio: '08:00', fin: '16:00' },
  martes:    { activo: true,  inicio: '08:00', fin: '16:00' },
  miercoles: { activo: true,  inicio: '08:00', fin: '16:00' },
  jueves:    { activo: true,  inicio: '08:00', fin: '16:00' },
  viernes:   { activo: true,  inicio: '08:00', fin: '13:00' },
  sabado:    { activo: false, inicio: '09:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '14:00' },
}

const PROPIO: Horario = {
  lunes:     { activo: true,  inicio: '10:00', fin: '14:00' },
  martes:    { ...CERRADO },
  miercoles: { activo: true,  inicio: '16:00', fin: '20:30' },
  jueves:    { ...CERRADO },
  viernes:   { ...CERRADO },
  sabado:    { activo: true,  inicio: '09:00', fin: '12:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '14:00' },
}

const TODO_CERRADO: Horario = {
  lunes: { ...CERRADO }, martes: { ...CERRADO }, miercoles: { ...CERRADO }, jueves: { ...CERRADO },
  viernes: { ...CERRADO }, sabado: { activo: false, inicio: '09:00', fin: '14:00' },
  domingo: { activo: false, inicio: '09:00', fin: '14:00' },
}

describe('horarioEfectivo', () => {
  it('sin horario propio manda el de la clínica (lo de hoy)', () => {
    expect(horarioEfectivo({ horario: PROPIO, horario_propio: false }, CLINICA)).toEqual(CLINICA)
  })

  it('sin la columna (migración sin aplicar) o con null, también el de la clínica', () => {
    expect(horarioEfectivo({ horario: PROPIO }, CLINICA)).toEqual(CLINICA)
    expect(horarioEfectivo({ horario: PROPIO, horario_propio: null }, CLINICA)).toEqual(CLINICA)
  })

  it('sin consultorio, el de la clínica', () => {
    expect(horarioEfectivo(null, CLINICA)).toEqual(CLINICA)
    expect(horarioEfectivo(undefined, CLINICA)).toEqual(CLINICA)
  })

  it('con horario propio manda el del consultorio', () => {
    expect(horarioEfectivo({ horario: PROPIO, horario_propio: true }, CLINICA)).toEqual(PROPIO)
  })

  it('un consultorio con horario propio y todo cerrado está CERRADO: no hereda el de la clínica', () => {
    const h = horarioEfectivo({ horario: TODO_CERRADO, horario_propio: true }, CLINICA)
    expect(Object.values(h).some(d => d.activo)).toBe(false)
  })

  it('la clínica sin horario cae a HORARIO_DEFAULT, igual que la rejilla', () => {
    expect(horarioEfectivo({ horario: PROPIO, horario_propio: false }, null)).toEqual(HORARIO_DEFAULT)
  })

  it('un día activo con fin ≤ inicio sale cerrado (falla cerrado), en los dos orígenes', () => {
    const malo: Horario = { ...PROPIO, lunes: { activo: true, inicio: '14:00', fin: '14:00' } }
    expect(horarioEfectivo({ horario: malo, horario_propio: true }, CLINICA).lunes.activo).toBe(false)
    const clinicaMala: Horario = { ...CLINICA, martes: { activo: true, inicio: '18:00', fin: '09:00' } }
    expect(horarioEfectivo(null, clinicaMala).martes.activo).toBe(false)
    expect(horarioEfectivo(null, clinicaMala).lunes).toEqual(CLINICA.lunes)
  })

  it('un horario mal formado no ofrece nada: días que faltan, horas inválidas, tipos raros', () => {
    const roto = { lunes: { activo: 'true', inicio: '10:00', fin: '12:00' }, martes: { activo: true, inicio: '9:00', fin: '12:00' } }
    const h = horarioEfectivo({ horario: roto, horario_propio: true }, CLINICA)
    expect(Object.values(h).some(d => d.activo)).toBe(false)
    expect(Object.keys(h).sort()).toEqual(Object.keys(CLINICA).sort())
    for (const crudo of [null, 'lunes', 42, []]) {
      const x = horarioEfectivo({ horario: crudo, horario_propio: true }, CLINICA)
      expect(Object.values(x).some(d => d.activo)).toBe(false)
    }
  })
})

describe('horarioEnOrden', () => {
  it('acepta un horario con todos los días activos en orden', () => {
    expect(horarioEnOrden(CLINICA)).toBe(true)
    expect(horarioEnOrden(PROPIO)).toBe(true)
  })

  it('rechaza un día activo con fin igual o anterior al inicio', () => {
    expect(horarioEnOrden({ ...CLINICA, jueves: { activo: true, inicio: '16:00', fin: '16:00' } })).toBe(false)
    expect(horarioEnOrden({ ...CLINICA, jueves: { activo: true, inicio: '16:00', fin: '08:00' } })).toBe(false)
  })

  it('no mira las horas de un día inactivo', () => {
    expect(horarioEnOrden({ ...CLINICA, sabado: { activo: false, inicio: '18:00', fin: '09:00' } })).toBe(true)
  })
})
