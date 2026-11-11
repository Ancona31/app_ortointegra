/**
 * semanasVecinas.test.ts — las dos semanas vecinas de un rango ya encajado a
 * semana natural (A1.5b, `src/lib/agenda/semanasVecinas.ts`). Fija lo que la
 * precarga de la agenda da por hecho:
 *
 *   · `semanaAnterior`/`semanaSiguiente` devuelven 7 días exactos de
 *     calendario, pegados al rango de entrada sin hueco ni solape;
 *   · encadenar las dos vuelve al rango original;
 *   · encadenar `semanaSiguiente` dos veces da la MISMA semana que pedirla
 *     sobre el resultado de la primera (la precarga la llama en serie);
 *   · sobrevive al cambio de horario de verano, igual que `rangoQuePedir`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { semanaAnterior, semanaSiguiente } from '@/lib/agenda/semanasVecinas'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'

/** Una semana natural como la que entrega `rangoQuePedir`. */
function semanaDe(desde: Date): { startStr: string; endStr: string } {
  return rangoQuePedir({ startStr: desde.toISOString(), endStr: desde.toISOString() })
}

/** Para leer los resultados como fechas y no como ISO en otro huso. */
function comoFechas(r: { startStr: string; endStr: string }): [string, string] {
  return [new Date(r.startStr).toDateString(), new Date(r.endStr).toDateString()]
}

describe('semanaAnterior / semanaSiguiente', () => {
  const W = semanaDe(new Date(2026, 7, 19)) // miércoles 19 de agosto de 2026

  it('semanaAnterior termina donde empieza W, y empieza 7 días antes', () => {
    const anterior = semanaAnterior(W)
    expect(anterior.endStr).toBe(W.startStr)
    expect(comoFechas(anterior)).toEqual(['Mon Aug 10 2026', 'Mon Aug 17 2026'])
  })

  it('semanaSiguiente empieza donde termina W, y termina 7 días después', () => {
    const siguiente = semanaSiguiente(W)
    expect(siguiente.startStr).toBe(W.endStr)
    expect(comoFechas(siguiente)).toEqual(['Mon Aug 24 2026', 'Mon Aug 31 2026'])
  })

  it('ir y volver no mueve el rango', () => {
    expect(semanaSiguiente(semanaAnterior(W))).toEqual(W)
    expect(semanaAnterior(semanaSiguiente(W))).toEqual(W)
  })

  it('dos saltos siguientes en serie llegan a la misma semana que uno doble', () => {
    const w1 = semanaSiguiente(W)
    const w2 = semanaSiguiente(w1)
    expect(comoFechas(w2)).toEqual(['Mon Aug 31 2026', 'Mon Sep 07 2026'])
  })
})

describe('semanasVecinas — aritmética de calendario, no de milisegundos', () => {
  const TZ_ORIGINAL = process.env.TZ
  afterEach(() => { process.env.TZ = TZ_ORIGINAL })

  it('la semana siguiente a la que cruza el fin del horario de verano sigue siendo de 7 días', () => {
    // Mismo caso que `rangoQuePedir.test.ts`: Europe/Madrid, el horario de
    // verano acaba el domingo 25 de octubre de 2026, dentro de la semana del
    // 19 al 26.
    process.env.TZ = 'Europe/Madrid'
    const semanaDelCambio = semanaDe(new Date(2026, 9, 21))
    const siguiente = semanaSiguiente(semanaDelCambio)
    expect(comoFechas(siguiente)).toEqual(['Mon Oct 26 2026', 'Mon Nov 02 2026'])
    const anterior = semanaAnterior(semanaDelCambio)
    expect(comoFechas(anterior)).toEqual(['Mon Oct 12 2026', 'Mon Oct 19 2026'])
  })
})
