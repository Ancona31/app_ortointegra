import { describe, expect, it } from 'vitest'
import { tierDeTarjeta } from '@/components/agenda/MemoizedEventContent'

/* F1.3 · Con la densidad compacta la franja de media hora mide 24 px, y ahí
   entran en juego los suelos físicos (42 y 55 px) que la tarjeta escribió para
   este caso. Una cita mide (minutos / 30) franjas. */
describe('tierDeTarjeta a 24 px por franja', () => {
  const piso = 24
  it('30 min (24 px) es tiny', () => { expect(tierDeTarjeta(24, piso)).toBe('tiny') })
  it('60 min (48 px) es compact: el suelo de 42 manda sobre 1,25 × 24', () => { expect(tierDeTarjeta(48, piso)).toBe('compact') })
  it('90 min (72 px) es full', () => { expect(tierDeTarjeta(72, piso)).toBe('full') })
})

describe('tierDeTarjeta en los tramos de siempre (sin cambios)', () => {
  it('a 42 px por franja: 30 min tiny, 45 compact, 60 full', () => {
    expect(tierDeTarjeta(42, 42)).toBe('tiny')
    expect(tierDeTarjeta(63, 42)).toBe('compact')
    expect(tierDeTarjeta(84, 42)).toBe('full')
  })
  it('sin medir todavía es full', () => { expect(tierDeTarjeta(null, 36)).toBe('full') })
})
