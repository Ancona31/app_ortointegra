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
import { formatCitaHora, fechaCitaCompacta } from '@/app/(app)/dashboard/utils'
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

/**
 * El mismo cruce de medianoche pero cinco días más allá, así que NO es hoy en
 * ninguno de los dos husos: 23:00 del día 25 en Hermosillo, 00:00 del 26 en el
 * Centro. Sirve para lo que `CITA_23_SONORA` no puede probar — que la fecha
 * NUMÉRICA también se calcula en huso del dispositivo, y no sólo el bucket de
 * hoy, que es la otra mitad exacta del bug de agosto.
 */
const CITA_23_SONORA_LEJANA = '2026-08-26T06:00:00Z'

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

/**
 * La columna estrecha del renglón de próximas citas. Es un formateador NUEVO
 * —no un formato de `partesCitaHora`—, así que la corrección de husos hay que
 * fijarla otra vez aquí: tiene su propia lectura del huso y su propio bucket de
 * hoy, y podría perderla sin que ninguno de los casos de arriba se pusiera en
 * rojo.
 */
describe('fechaCitaCompacta — «HOY» o fecha numérica, en huso del dispositivo', () => {
  it('el bucket de hoy va en huso del dispositivo, no en el de la clínica', () => {
    // La mitad del bug de agosto: con el día en Centro esta cita no sería de
    // hoy y saldría con fecha numérica en vez de «Hoy».
    conHuso('America/Hermosillo')
    expect(fechaCitaCompacta(CITA_23_SONORA)).toEqual({ texto: 'Hoy', numerica: false })
  })

  it('la misma cita, desde el Centro, es otro día y sale numérica', () => {
    conHuso('America/Mexico_City')
    expect(fechaCitaCompacta(CITA_23_SONORA)).toEqual({ texto: '21/08/26', numerica: true })
  })

  it('la fecha numérica TAMBIÉN se calcula en huso del dispositivo', () => {
    // La otra mitad del bug: aquí no es hoy en ninguno de los dos husos, así
    // que lo único que puede discrepar son las cifras. Un día de diferencia.
    conHuso('America/Hermosillo')
    expect(fechaCitaCompacta(CITA_23_SONORA_LEJANA).texto).toBe('25/08/26')
    conHuso('America/Mexico_City')
    expect(fechaCitaCompacta(CITA_23_SONORA_LEJANA).texto).toBe('26/08/26')
  })

  it('NO tiene bucket de «Mañana»: mañana sale numérico', () => {
    // No es un olvido, es el spec. Si alguien añade el bucket, esto se cae.
    conHuso('America/Mexico_City')
    expect(fechaCitaCompacta(CITA_23_SONORA)).toEqual({ texto: '21/08/26', numerica: true })
    expect(formatCitaHora(CITA_23_SONORA)).toBe('Mañana · 00:00')
  })

  it('el formato es dd/MM/yy, sin nombre de día ni de mes', () => {
    conHuso('America/Hermosillo')
    expect(fechaCitaCompacta(CITA_23_SONORA_LEJANA).texto).toMatch(/^\d{2}\/\d{2}\/\d{2}$/)
  })

  it('no le pisa el rótulo a `partesCitaHora`, que sigue en palabra', () => {
    // Las dos conviven y dicen cosas distintas del mismo instante: la compacta
    // alimenta la columna estrecha, la otra sigue alimentando `formatCitaHora`
    // en otras dos pantallas. Unificarlas rompe una de las dos.
    conHuso('America/Mexico_City')
    expect(fechaCitaCompacta(CITA_23_SONORA).texto).toBe('21/08/26')
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
