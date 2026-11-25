import { describe, expect, it } from 'vitest'
import {
  esVistaDeRejilla, vistaEnElOtroFormato, vistaDelFormato, vistaDeLaV1EnLaV2, esFormatoTelefono, FORMATOS_DE_VISTA,
} from '@/lib/agenda/vistasAgenda'

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

/* B13 · AG2 · Con la v2: cuatro periodos en todos los formatos (CALMA §29.1).
   En el teléfono sólo la Semana es lista; «3 días» y Día, rejilla (§28). */
describe('vistaDelFormato (v2)', () => {
  it('la tabla tiene los cuatro periodos, en su orden', () => {
    expect(FORMATOS_DE_VISTA.map(f => f.rotulo)).toEqual(['Mes', 'Semana', '3 días', 'Día'])
  })
  it('en el teléfono, Semana en lista y el resto en rejilla', () => {
    expect(vistaDelFormato('timeGridWeek', true)).toBe('listWeek')
    expect(vistaDelFormato('timeGridTresDias', true)).toBe('timeGridTresDias')
    expect(vistaDelFormato('timeGridDay', true)).toBe('timeGridDay')
    expect(vistaDelFormato('listDay', true)).toBe('timeGridDay')
    expect(vistaDelFormato('dayGridMonth', true)).toBe('dayGridMonth')
  })
  it('en tableta y computadora, Semana de siete columnas y «3 días» aparte', () => {
    expect(vistaDelFormato('listWeek', false)).toBe('timeGridWeek')
    expect(vistaDelFormato('timeGridTresDias', false)).toBe('timeGridTresDias')
    expect(vistaDelFormato('listDay', false)).toBe('timeGridDay')
  })
  it('es idempotente y deja tal cual una vista desconocida', () => {
    for (const f of FORMATOS_DE_VISTA) {
      expect(vistaDelFormato(f.telefono, true)).toBe(f.telefono)
      expect(vistaDelFormato(f.rejilla, false)).toBe(f.rejilla)
    }
    expect(vistaDelFormato('multiMonthYear', true)).toBe('multiMonthYear')
  })
  it('al encenderse, la Semana de tres días de la tableta apagada sigue siendo Semana', () => {
    expect(vistaDeLaV1EnLaV2('timeGridTresDias', false)).toBe('timeGridWeek')
    expect(vistaDeLaV1EnLaV2('timeGridTresDias', true)).toBe('listWeek')
    expect(vistaDeLaV1EnLaV2('listDay', true)).toBe('timeGridDay')
  })
  it('los formatos de teléfono son ext y tel', () => {
    expect(['ext', 'tel', 'ih', 'iv', 'esc', 'desconocido'].map(esFormatoTelefono)).toEqual([true, true, false, false, false, false])
  })
})
