/**
 * disponibilidad.test.ts — qué horario manda para ofrecer turnos en un
 * consultorio (plan del bloque B, paso B5): el de la clínica salvo que el
 * consultorio tenga `horario_propio = true`, y los días dudosos salen
 * cerrados (falla cerrado).
 */
import { describe, it, expect } from 'vitest'
import { horarioEfectivo, horarioEnOrden, HorarioEnOrdenSchema } from '@/lib/agenda/disponibilidad'
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

describe('HorarioEnOrdenSchema (P8, PUT /api/me/horario)', () => {
  it('acepta un horario bien formado y en orden', () => {
    expect(HorarioEnOrdenSchema.safeParse(CLINICA).success).toBe(true)
    expect(HorarioEnOrdenSchema.safeParse(HORARIO_DEFAULT).success).toBe(true)
  })

  it.each([['16:00', '16:00'], ['16:00', '08:00']])('rechaza un día activo de %s a %s y dice cuál', (inicio, fin) => {
    const r = HorarioEnOrdenSchema.safeParse({ ...CLINICA, jueves: { activo: true, inicio, fin } })
    expect(r.success).toBe(false)
    expect(r.error?.issues).toHaveLength(1)
    expect(r.error?.issues[0]?.path).toEqual(['jueves'])
    expect(r.error?.issues[0]?.message).toBe('Jueves: la hora de cierre tiene que ir después de la de apertura')
  })

  it('no mira el orden de un día inactivo', () => {
    expect(HorarioEnOrdenSchema.safeParse({ ...CLINICA, sabado: { activo: false, inicio: '18:00', fin: '09:00' } }).success).toBe(true)
  })

  it('rechaza la forma: falta un día, hora mal escrita o activo que no es booleano', () => {
    const { domingo, ...sinDomingo } = CLINICA
    expect(domingo.activo).toBe(false)
    expect(HorarioEnOrdenSchema.safeParse(sinDomingo).success).toBe(false)
    expect(HorarioEnOrdenSchema.safeParse({ ...CLINICA, lunes: { activo: true, inicio: '8:00', fin: '16:00' } }).success).toBe(false)
    expect(HorarioEnOrdenSchema.safeParse({ ...CLINICA, lunes: { activo: true, inicio: '', fin: '16:00' } }).success).toBe(false)
    expect(HorarioEnOrdenSchema.safeParse({ ...CLINICA, lunes: { activo: 'si', inicio: '08:00', fin: '16:00' } }).success).toBe(false)
    expect(HorarioEnOrdenSchema.safeParse(null).success).toBe(false)
  })

  it('descarta las claves que no son del horario (no las guarda)', () => {
    const r = HorarioEnOrdenSchema.safeParse({ ...CLINICA, festivos: ['2026-12-25'] })
    expect(r.success).toBe(true)
    expect(r.data && 'festivos' in r.data).toBe(false)
  })
})
