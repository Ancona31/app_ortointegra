/**
 * turnosHueco.test.ts — H4 (punto 20): el panel «Huecos disponibles» parte
 * cada hueco en los turnos de la rejilla fija (G2), la MISMA del enlace de
 * reserva (`turnosEnTramo` → `turnosDelDia`).
 *
 * MUTACIONES (comprobadas en rojo): `turnosEnTramo` contando desde el inicio
 * del hueco y no desde la apertura (10:20, 11:05… en vez de 10:30, 11:15…);
 * sin el filtro de «cabe entero» (sale el 9:45 que la cita de 10:00 tapa en
 * parte).
 */
import { describe, it, expect } from 'vitest'
import type { DiaSemana, Horario } from '@/lib/configApp'
import { fechaHoraLocalAInstante } from '@/lib/dates'
import { turnosEnTramo } from '@/lib/agenda/turnosAgenda'

const TODOS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
function horarioDe(inicio: string, fin: string): Horario {
  const h = {} as Horario
  for (const d of TODOS) h[d] = { activo: d !== 'domingo', inicio, fin }
  return h
}

const FECHA = '2026-11-16' // lunes
const TZ = 'America/Merida'
const en = (hora: string, tz = TZ): number => Date.parse(fechaHoraLocalAInstante(FECHA, hora, tz))
const horas = (lista: { inicio: string }[], tz = TZ): string[] => lista.map(t =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t.inicio)))
const REJILLA = { fecha: FECHA, tz: TZ, horario: horarioDe('09:00', '13:00'), duracionMin: 45 }

describe('turnosEnTramo (rejilla fija de 45 min desde las 9:00)', () => {
  it('un hueco de toda la jornada: los cinco turnos de la rejilla; el resto que no llega a un turno se pierde', () => {
    expect(horas(turnosEnTramo(REJILLA, en('09:00'), en('13:00')))).toEqual(['09:00', '09:45', '10:30', '11:15', '12:00'])
  })
  it('tras una cita de 10:00 a 10:20, el 9:45 (tocado en parte) no sale y los demás siguen en la rejilla', () => {
    expect(horas(turnosEnTramo(REJILLA, en('09:00'), en('10:00')))).toEqual(['09:00'])
    expect(horas(turnosEnTramo(REJILLA, en('10:20'), en('13:00')))).toEqual(['10:30', '11:15', '12:00'])
  })
  it('un hueco en que no cabe ningún turno entero no da ninguno', () => {
    expect(turnosEnTramo(REJILLA, en('09:10'), en('10:20'))).toEqual([])
  })
  it('cada turno dura lo de la consulta', () => {
    for (const t of turnosEnTramo(REJILLA, en('09:00'), en('13:00'))) expect(Date.parse(t.fin) - Date.parse(t.inicio)).toBe(45 * 60_000)
  })
  it('en la zona del consultorio: Tijuana abre a las 9:00 de SU hora', () => {
    const tij = { ...REJILLA, tz: 'America/Tijuana' }
    expect(horas(turnosEnTramo(tij, en('09:00', 'America/Tijuana'), en('11:00', 'America/Tijuana')), 'America/Tijuana')).toEqual(['09:00', '09:45'])
  })
  it('sin duración válida o con el día cerrado, nada', () => {
    expect(turnosEnTramo({ ...REJILLA, duracionMin: 0 }, en('09:00'), en('13:00'))).toEqual([])
    expect(turnosEnTramo({ ...REJILLA, fecha: '2026-11-15' }, Date.parse('2026-11-15T15:00:00Z'), Date.parse('2026-11-15T19:00:00Z'))).toEqual([])
  })
})
