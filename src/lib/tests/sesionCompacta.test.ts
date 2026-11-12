/**
 * F1.5 · La sesión de «Compactar» sólo se ensancha (`ventanaRejilla.ts`):
 * unión de ventanas e intersección de días plegados.
 */
import { describe, expect, it } from 'vitest'
import { intersecarOcultos, unirVentanas } from '@/lib/agenda/ventanaRejilla'

describe('unirVentanas', () => {
  it('toma el inicio más temprano y el fin más tardío', () => {
    expect(unirVentanas({ slotMinTime: '08:00:00', slotMaxTime: '19:00:00' }, { slotMinTime: '07:00:00', slotMaxTime: '18:00:00' }))
      .toEqual({ slotMinTime: '07:00:00', slotMaxTime: '19:00:00' })
  })
  it('con una contenida en la otra devuelve la de fuera', () => {
    expect(unirVentanas({ slotMinTime: '07:00:00', slotMaxTime: '21:00:00' }, { slotMinTime: '09:00:00', slotMaxTime: '14:00:00' }))
      .toEqual({ slotMinTime: '07:00:00', slotMaxTime: '21:00:00' })
  })
  it('admite el fin de día 24:00', () => {
    expect(unirVentanas({ slotMinTime: '00:00:00', slotMaxTime: '23:00:00' }, { slotMinTime: '08:00:00', slotMaxTime: '24:00:00' }).slotMaxTime)
      .toBe('24:00:00')
  })
})

describe('intersecarOcultos', () => {
  it('sólo quedan los plegados en las dos', () => {
    expect(intersecarOcultos([0, 6], [0])).toEqual([0])
  })
  it('un día con citas en la semana nueva vuelve a verse', () => {
    expect(intersecarOcultos([0], [])).toEqual([])
  })
  it('un día plegado sólo en la nueva no se pliega (sólo mengua)', () => {
    expect(intersecarOcultos([0], [0, 6])).toEqual([0])
  })
})
