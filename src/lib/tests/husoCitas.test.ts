/**
 * husoCitas.test.ts — regresión del bug de husos de agosto de 2026.
 *
 * Una médica en Sonora (`America/Hermosillo`, UTC-7 todo el año, sin horario
 * de verano) veía las horas de sus citas UNA HORA MÁS TARDE de lo que eran:
 * los renders llamaban a `renderEnTZ`/`hoyEnTZ` sin pasar huso y heredaban el
 * default `TZ_CLINICA` (Centro, UTC-6).
 *
 * LA REGLA que se fija aquí: las horas de citas se pintan en el huso del
 * DISPOSITIVO de quien mira. Ver la cabecera de `@/lib/dates`.
 *
 * ⚠️  EL HUSO SE FIJA A MANO EN CADA CASO. `vitest.config.ts` NO fija `TZ`,
 * así que sin `conHuso()` estos tests dependerían de la máquina donde corran
 * y pasarían en verde en el Centro justo con el bug puesto. `process.env.TZ`
 * se relee en cada llamada a `Intl`, que es lo que hace `tzDispositivo()`.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { formatCitaHora } from '@/app/(app)/dashboard/utils'
import {
  ultimaConsultaLabel,
  ultimaConsultaFecha,
  formatFechaRelativaFutura,
  formatFechaCompleta,
} from '@/lib/expedienteUtils'
import { tzDispositivo } from '@/lib/dates'
import type { Consulta } from '@/types'

const TZ_ORIGINAL = process.env.TZ

/** Instante congelado: 08:00 en Hermosillo, 09:00 en el Centro, mismo día. */
const AHORA = new Date('2026-08-20T15:00:00Z')

/** 09:00 en Hermosillo, 10:00 en el Centro. La cita de la beta tester. */
const CITA_9_SONORA = '2026-08-20T16:00:00Z'

/** 23:00 del día 20 en Hermosillo, pero 00:00 del día 21 en el Centro. */
const CITA_23_SONORA = '2026-08-21T06:00:00Z'

function conHuso(tz: string): void {
  process.env.TZ = tz
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
})

afterEach(() => {
  vi.useRealTimers()
})

afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_ORIGINAL
})

describe('tzDispositivo', () => {
  it('devuelve el huso del entorno donde corre, no el de la clínica', () => {
    conHuso('America/Hermosillo')
    expect(tzDispositivo()).toBe('America/Hermosillo')
  })
})

describe('formatCitaHora — la hora es la del dispositivo', () => {
  it('en Sonora pinta 09:00, no 10:00 (el bug reportado)', () => {
    conHuso('America/Hermosillo')
    expect(formatCitaHora(CITA_9_SONORA)).toBe('Hoy · 09:00')
  })

  it('en el Centro sigue pintando 10:00 — sin regresión para el resto', () => {
    conHuso('America/Mexico_City')
    expect(formatCitaHora(CITA_9_SONORA)).toBe('Hoy · 10:00')
  })

  it('el bucket Hoy/Mañana también va en huso del dispositivo', () => {
    // Por esto las CINCO llamadas llevan huso y no sólo las dos de la hora:
    // con el día en Centro, esta cita salía como "Mañana · 00:00".
    conHuso('America/Hermosillo')
    expect(formatCitaHora(CITA_23_SONORA)).toBe('Hoy · 23:00')
  })

  it('la misma cita SÍ es de mañana para quien mira desde el Centro', () => {
    conHuso('America/Mexico_City')
    expect(formatCitaHora(CITA_23_SONORA)).toBe('Mañana · 00:00')
  })
})

describe('tarjeta PRÓXIMA CITA — título y subtítulo no pueden discrepar', () => {
  it('los dos leen el mismo huso', () => {
    conHuso('America/Hermosillo')
    expect(formatFechaRelativaFutura(CITA_9_SONORA)).toBe('Hoy')
    expect(formatFechaCompleta(CITA_9_SONORA)).toBe('20 de agosto · 09:00')
  })

  it('una cita de las 23:00 en Sonora es de HOY en las dos mitades', () => {
    conHuso('America/Hermosillo')
    expect(formatFechaRelativaFutura(CITA_23_SONORA)).toBe('Hoy')
    expect(formatFechaCompleta(CITA_23_SONORA)).toBe('20 de agosto · 23:00')
  })
})

describe('ultimaConsultaLabel — no puede mezclar dos husos', () => {
  const consulta = (fecha: string): Consulta => ({
    id: 'c1',
    paciente_id: 'p1',
    motivo_consulta: 'control',
    fecha,
  })

  it('una consulta de las 17:00 en Sonora es de HOY, no de ayer', () => {
    // 17:00 del día 20 en Hermosillo, pero ya es día 21 en UTC. Antes,
    // `hoyEnTZ()` daba el día en Centro y `fechaSoloSegura` cortaba en UTC:
    // dos husos comparados entre sí, y salía "Hace -1 días".
    conHuso('America/Hermosillo')
    expect(ultimaConsultaLabel([consulta('2026-08-21T00:00:00Z')])).toBe('Hoy')
  })

  it('sigue distinguiendo Ayer correctamente', () => {
    conHuso('America/Hermosillo')
    expect(ultimaConsultaLabel([consulta('2026-08-19T20:00:00Z')])).toBe('Ayer')
  })

  it('el subtítulo de la tarjeta lee el mismo huso que el título', () => {
    // Misma consulta de las 17:00 en Sonora. `ultimaConsultaFecha` ya acertaba
    // heredando el runtime, así que esto NO es un cambio de comportamiento:
    // fija el contrato de que las dos mitades de la tarjeta no pueden divergir.
    conHuso('America/Hermosillo')
    const consultas = [consulta('2026-08-21T00:00:00Z')]
    expect(ultimaConsultaLabel(consultas)).toBe('Hoy')
    expect(ultimaConsultaFecha(consultas)).toBe('20 de agosto 2026')
  })

  it('sin consultas no revienta', () => {
    conHuso('America/Hermosillo')
    expect(ultimaConsultaLabel([])).toBe('Sin consultas')
    expect(ultimaConsultaFecha([])).toBeNull()
  })
})
