import { describe, expect, it } from 'vitest'
import { desplazarMeses, diaSemanaLunes, diasDelMes, enRango, moverFoco, rejillaDelMes } from '@/lib/agenda/rejillaMes'

const T = (key: string, shiftKey = false) => ({ key, shiftKey })

describe('rejillaDelMes', () => {
  it('noviembre de 2026 empieza en domingo: la rejilla arranca el lunes 26 de octubre', () => {
    const r = rejillaDelMes('2026-11-12')
    expect(r).toHaveLength(6)
    expect(r[0][0]).toEqual({ fecha: '2026-10-26', delMes: false })
    expect(r[0][6]).toEqual({ fecha: '2026-11-01', delMes: true })
    expect(r[5][6].fecha).toBe('2026-12-06')
  })
  it('febrero de 2027 empieza en lunes: el primer día de la rejilla es el 1', () => {
    const r = rejillaDelMes('2027-02-15')
    expect(r[0][0]).toEqual({ fecha: '2027-02-01', delMes: true })
    expect(r.flat().filter(d => d.delMes)).toHaveLength(28)
  })
  it('siempre 6 semanas de 7 días, lunes primero', () => {
    for (const mes of ['2026-01-01', '2026-03-01', '2028-02-01']) {
      const r = rejillaDelMes(mes)
      expect(r.map(s => s.length)).toEqual([7, 7, 7, 7, 7, 7])
      expect(diaSemanaLunes(r[0][0].fecha)).toBe(0)
    }
  })
  it('el cambio de horario no mete ni quita un día (marzo de 2026 en EE. UU.)', () => {
    const fechas = rejillaDelMes('2026-03-10').flat().map(d => d.fecha)
    expect(new Set(fechas).size).toBe(42)
  })
})

describe('desplazarMeses y diasDelMes', () => {
  it('recorta al último día del mes de destino', () => {
    expect(desplazarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(desplazarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(desplazarMeses('2026-03-31', -1)).toBe('2026-02-28')
  })
  it('cruza el año en los dos sentidos', () => {
    expect(desplazarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(desplazarMeses('2026-01-15', -1)).toBe('2025-12-15')
    expect(desplazarMeses('2026-06-15', -12)).toBe('2025-06-15')
  })
  it('cuenta los bisiestos', () => {
    expect(diasDelMes('2028-02-01')).toBe(29)
    expect(diasDelMes('2100-02-01')).toBe(28)
  })
})

describe('moverFoco (APG)', () => {
  it('flechas: día y semana', () => {
    expect(moverFoco('2026-11-12', T('ArrowLeft'))).toBe('2026-11-11')
    expect(moverFoco('2026-11-12', T('ArrowRight'))).toBe('2026-11-13')
    expect(moverFoco('2026-11-12', T('ArrowUp'))).toBe('2026-11-05')
    expect(moverFoco('2026-11-30', T('ArrowDown'))).toBe('2026-12-07')
  })
  it('Inicio y Fin: lunes y domingo de esa semana', () => {
    expect(moverFoco('2026-11-12', T('Home'))).toBe('2026-11-09')
    expect(moverFoco('2026-11-12', T('End'))).toBe('2026-11-15')
  })
  it('Re Pág y Av Pág cambian de mes; con Mayús, de año', () => {
    expect(moverFoco('2026-11-12', T('PageUp'))).toBe('2026-10-12')
    expect(moverFoco('2026-11-12', T('PageDown'))).toBe('2026-12-12')
    expect(moverFoco('2026-11-12', T('PageDown', true))).toBe('2027-11-12')
  })
  it('lo que no es suyo devuelve null', () => {
    expect(moverFoco('2026-11-12', T('a'))).toBeNull()
    expect(moverFoco('2026-11-12', T('Enter'))).toBeNull()
  })
})

describe('enRango', () => {
  it('el fin es exclusivo, como el rango de FullCalendar', () => {
    expect(enRango('2026-11-09', '2026-11-09', '2026-11-16')).toBe(true)
    expect(enRango('2026-11-16', '2026-11-09', '2026-11-16')).toBe(false)
  })
})
