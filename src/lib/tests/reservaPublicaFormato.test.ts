/**
 * reservaPublicaFormato.test.ts — tanda G1, punto 1: la fecha en español con
 * la preposición en minúscula («13 de noviembre», nunca «13 De Noviembre»),
 * la tira de fechas, el rango de la semana y la agrupación Mañana/Tarde en la
 * zona del consultorio. Puras: sin red ni reloj.
 */
import { describe, it, expect } from 'vitest'
import {
  agruparTurnos, etiquetaDia, mayusculaInicial, partesDia, primerDiaConTurnos, rangoSemana, type DiaPagina,
} from '@/app/reservar/[codigo]/clienteReserva'
import { partesCuando } from '@/lib/confirmacion/vistaConfirmacion'

const dia = (fecha: string, n = 0): DiaPagina => ({
  fecha, turnos: Array.from({ length: n }, (_, i) => ({ inicio: `${fecha}T1${i}:00:00Z`, fin: `${fecha}T1${i}:30:00Z` })),
})

describe('la fecha de la página de reserva', () => {
  it('«Viernes, 13 de noviembre»: sólo la primera letra en mayúscula', () => {
    expect(etiquetaDia('2026-11-13')).toBe('Viernes, 13 de noviembre')
    expect(etiquetaDia('2026-11-13')).not.toMatch(/ De /)
  })
  it('mayusculaInicial no toca el resto de la frase', () => {
    expect(mayusculaInicial('miércoles, 2 de diciembre')).toBe('Miércoles, 2 de diciembre')
    expect(mayusculaInicial('')).toBe('')
  })
  it('la tira: día corto sin punto y número', () => {
    expect(partesDia('2026-11-18')).toEqual({ semana: 'Mié', numero: '18' })
  })
  it('el rango de la semana, en el mismo mes y cruzando de mes', () => {
    expect(rangoSemana([dia('2026-11-14'), dia('2026-11-20')])).toBe('14 – 20 de noviembre')
    expect(rangoSemana([dia('2026-11-28'), dia('2026-12-04')])).toBe('28 de noviembre – 4 de diciembre')
    expect(rangoSemana([])).toBe('')
  })
  it('el primer día con turnos (los días sin horario se saltan)', () => {
    expect(primerDiaConTurnos([dia('2026-11-14'), dia('2026-11-15', 2)])).toBe('2026-11-15')
    expect(primerDiaConTurnos([dia('2026-11-14')])).toBeNull()
  })
})

describe('la fecha grande de la confirmación', () => {
  it('«Martes» y «6 de mayo · 10:00 h», sin «De» en mayúscula', () => {
    expect(partesCuando('2031-05-06T16:00:00.000Z', 'America/Mexico_City')).toEqual({ dia: 'Martes', fecha: '6 de mayo · 10:00 h' })
  })
})

describe('agruparTurnos (Mañana y Tarde)', () => {
  const t = (iso: string) => ({ inicio: iso, fin: iso })
  it('antes de las 12:00 es mañana; de las 12:00 en adelante, tarde', () => {
    const g = agruparTurnos([t('2026-11-16T17:59:00Z'), t('2026-11-16T18:00:00Z'), t('2026-11-16T14:00:00Z')], 'America/Mexico_City')
    expect(g.manana.map(x => x.inicio)).toEqual(['2026-11-16T17:59:00Z', '2026-11-16T14:00:00Z'])
    expect(g.tarde.map(x => x.inicio)).toEqual(['2026-11-16T18:00:00Z'])
  })
  it('manda la zona del consultorio, no la del dispositivo', () => {
    // 18:30 UTC: 12:30 en Ciudad de México (tarde), 11:30 en Tijuana (mañana).
    const x = [t('2026-11-16T18:30:00Z')]
    expect(agruparTurnos(x, 'America/Mexico_City').tarde).toHaveLength(1)
    expect(agruparTurnos(x, 'America/Tijuana').manana).toHaveLength(1)
  })
  it('un día vacío da los dos grupos vacíos', () => {
    expect(agruparTurnos([], 'America/Merida')).toEqual({ manana: [], tarde: [] })
  })
})
