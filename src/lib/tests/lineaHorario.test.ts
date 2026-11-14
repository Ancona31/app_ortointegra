/** lineaHorario.test.ts — G2, punto 5: el horario de un consultorio en una línea. */
import { describe, it, expect } from 'vitest'
import type { Horario } from '@/lib/configApp'
import { lineaHorario } from '@/lib/agenda/lineaHorario'

const dia = (activo: boolean, inicio = '08:00', fin = '18:00') => ({ activo, inicio, fin })

describe('lineaHorario', () => {
  it('junta los días seguidos con la misma hora y no dice los cerrados', () => {
    const h: Horario = { lunes: dia(true), martes: dia(true), miercoles: dia(true), jueves: dia(true), viernes: dia(true),
      sabado: dia(true, '08:00', '13:00'), domingo: dia(false) }
    expect(lineaHorario(h)).toBe('Lun–vie 08:00 – 18:00 · Sáb 08:00 – 13:00')
  })
  it('dos días seguidos van con «y»; un hueco parte el tramo', () => {
    const h: Horario = { lunes: dia(true, '08:00', '12:00'), martes: dia(true, '08:00', '12:00'), miercoles: dia(false),
      jueves: dia(true, '08:00', '12:00'), viernes: dia(false), sabado: dia(false), domingo: dia(false) }
    expect(lineaHorario(h)).toBe('Lun y mar 08:00 – 12:00 · Jue 08:00 – 12:00')
  })
  it('todo cerrado', () => {
    const h: Horario = { lunes: dia(false), martes: dia(false), miercoles: dia(false), jueves: dia(false), viernes: dia(false),
      sabado: dia(false), domingo: dia(false) }
    expect(lineaHorario(h)).toBe('Sin días abiertos')
  })
})
