import { describe, expect, it } from 'vitest'
import { esVistaDeRejilla, vistaEnElOtroFormato } from '@/lib/agenda/vistasAgenda'

/* F1.16 · El tercer formato, la tableta. Los dos de siempre los prueba
   `agendaMovida.test.ts`; aquí, el tramo nuevo y la ida y vuelta. */
describe('vistaEnElOtroFormato con la tableta', () => {
  it('Semana pasa a la rejilla de tres días; Día y Mes, como en escritorio y en el teléfono', () => {
    expect(vistaEnElOtroFormato('timeGridWeek', true, true)).toBe('timeGridTresDias')
    expect(vistaEnElOtroFormato('listWeek', true, true)).toBe('timeGridTresDias')
    expect(vistaEnElOtroFormato('timeGridDay', true, true)).toBe('timeGridDay')
    expect(vistaEnElOtroFormato('listDay', true, true)).toBe('timeGridDay')
    expect(vistaEnElOtroFormato('dayGridMonth', true, true)).toBe('dayGridMonth')
  })
  it('de la tableta vuelve a escritorio y al teléfono conservando el periodo', () => {
    expect(vistaEnElOtroFormato('timeGridTresDias', false)).toBe('timeGridWeek')
    expect(vistaEnElOtroFormato('timeGridTresDias', true)).toBe('listWeek')
  })
  it('es idempotente y la tableta sin estrecho no cuenta', () => {
    expect(vistaEnElOtroFormato('timeGridTresDias', true, true)).toBe('timeGridTresDias')
    expect(vistaEnElOtroFormato('timeGridWeek', false, true)).toBe('timeGridWeek')
  })
  it('la de tres días es rejilla', () => {
    expect(esVistaDeRejilla('timeGridTresDias')).toBe(true)
  })
})
