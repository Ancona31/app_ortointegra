import { describe, expect, it } from 'vitest'
import { differenceInCalendarWeeks } from 'date-fns'
import { semanasPintadasDelMes } from '@/lib/agenda/fechasAgenda'

/* F1.6 · El mes de escritorio pinta sus semanas reales (`fixedWeekCount: false`)
   y el del teléfono sigue con seis. Las fechas son locales, como las de la vista. */
const semanas = (mes: string, fijas: boolean): number => {
  const r = semanasPintadasDelMes(new Date(`${mes}T00:00:00`), fijas)
  return differenceInCalendarWeeks(r.activeEnd, r.activeStart, { weekStartsOn: 1 })
}

describe('semanasPintadasDelMes', () => {
  it('febrero de 2027 empieza en lunes y acaba en domingo: 4 semanas reales', () => {
    expect(semanas('2027-02-01', false)).toBe(4)
    const r = semanasPintadasDelMes(new Date('2027-02-01T00:00:00'), false)
    expect(r.activeStart.getDate()).toBe(1)
    expect(r.activeEnd.getMonth()).toBe(2) // 1 de marzo
    expect(r.activeEnd.getDate()).toBe(1)
  })
  it('noviembre de 2026 empieza en domingo: 6 semanas reales', () => {
    expect(semanas('2026-11-01', false)).toBe(6)
  })
  it('con semanas fijas (teléfono) son 6 siempre, también en febrero de 2027', () => {
    expect(semanas('2027-02-01', true)).toBe(6)
    expect(semanas('2026-11-01', true)).toBe(6)
    const porOmision = semanasPintadasDelMes(new Date('2026-08-01T00:00:00'))
    expect(differenceInCalendarWeeks(porOmision.activeEnd, porOmision.activeStart, { weekStartsOn: 1 })).toBe(6)
  })
  it('el cambio de horario no descuadra los bordes (marzo de 2026 en EE. UU.)', () => {
    const r = semanasPintadasDelMes(new Date('2026-03-01T00:00:00'), false)
    expect(r.activeStart.getHours()).toBe(0)
    expect(r.activeEnd.getHours()).toBe(0)
    expect(r.activeEnd.getDay()).toBe(1)
    expect(semanas('2026-03-01', false)).toBe(6)
  })
})
