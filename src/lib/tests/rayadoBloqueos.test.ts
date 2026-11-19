import { describe, expect, it } from 'vitest'
import { tramosDelRayado, type HoraHabilFc } from '@/lib/agenda/bloqueosAgenda'

/**
 * M3 (punto 6 de Angel) · El rayado de un bloqueo se dibuja sólo sobre el
 * horario activo, con la MISMA `businessHours` que pinta el gris. Los tres
 * casos pedidos: todo el día, de horas y sin horario definido.
 *
 * MUTACIONES (comprobadas en rojo, notas_m3.md): en `tramosDelRayado`, no
 * recortar con la franja (`de = p`, `a2 = q`) → «de horas…»; devolver `[]` en
 * vez de `null` sin horario → «sin horario…»; no fundir tramos solapados →
 * «dos consultorios que se pisan…».
 */

// El admin de la semilla: Centro 08–14 y Norte 15–18 de lunes a viernes (hueco 14–15), Norte 08–13 el sábado.
const HORAS: HoraHabilFc[] = [
  { daysOfWeek: [1], startTime: '08:00', endTime: '14:00' }, { daysOfWeek: [1], startTime: '15:00', endTime: '18:00' },
  { daysOfWeek: [5], startTime: '08:00', endTime: '14:00' }, { daysOfWeek: [5], startTime: '15:00', endTime: '18:00' },
  { daysOfWeek: [6], startTime: '08:00', endTime: '13:00' },
]
const VIERNES = '2026-11-20'
const local = (d: number, h: number, m = 0): Date => new Date(2026, 10, d, h, m)

describe('tramosDelRayado', () => {
  it('todo el día: sólo los dos tramos abiertos, dentro de la ventana 07–19', () => {
    const t = tramosDelRayado(VIERNES, local(20, 0), local(21, 0), HORAS, '07:00:00', '19:00:00')
    // La franja va de 07 a 19 (12 h): 08–14 y 15–18.
    expect(t).toEqual([{ arriba: (1 / 12) * 100, alto: 50 }, { arriba: (8 / 12) * 100, alto: 25 }])
  })

  it('de horas: 12:00–18:30 cruza el hueco 14–15 y el cierre de las 18', () => {
    const t = tramosDelRayado(VIERNES, local(20, 12), local(20, 18, 30), HORAS, '07:00:00', '19:00:00')
    // Franja de 6,5 h: 12–14 (2 h) y 15–18 (3 h); de 18 a 18:30, sin rayar.
    expect(t).toEqual([{ arriba: 0, alto: (2 / 6.5) * 100 }, { arriba: (3 / 6.5) * 100, alto: (3 / 6.5) * 100 }])
  })

  it('de horas entero fuera de horario: ningún trozo (la franja sigue ahí, sin rayar)', () => {
    expect(tramosDelRayado(VIERNES, local(20, 18, 15), local(20, 19), HORAS, '07:00:00', '19:00:00')).toEqual([])
  })

  it('sin horario definido ese día (domingo, todo gris): rayado entero, `null`', () => {
    expect(tramosDelRayado('2026-11-22', local(22, 0), local(23, 0), HORAS, '07:00:00', '19:00:00')).toBeNull()
    expect(tramosDelRayado(VIERNES, local(20, 0), local(21, 0), [], '07:00:00', '19:00:00')).toBeNull()
  })

  it('dos consultorios que se pisan se funden en un trozo', () => {
    const solapados: HoraHabilFc[] = [{ daysOfWeek: [5], startTime: '08:00', endTime: '14:00' }, { daysOfWeek: [5], startTime: '12:00', endTime: '16:00' }]
    expect(tramosDelRayado(VIERNES, local(20, 8), local(20, 16), solapados, '08:00:00', '16:00:00')).toEqual([{ arriba: 0, alto: 100 }])
  })

  it('ventana pasada de medianoche: cuenta el horario del día siguiente', () => {
    const t = tramosDelRayado(VIERNES, local(20, 0), local(22, 0), HORAS, '08:00:00', '33:00:00')
    // El viernes 08–14 y 15–18, y el sábado 08–09 (32–33 h de la columna del viernes). Franja de 25 h.
    expect(t?.map(x => Math.round(x.arriba * 25 / 100 + 8))).toEqual([8, 15, 32])
  })

  it('sin franja visible (el bloqueo cae fuera de la ventana): `null`', () => {
    expect(tramosDelRayado(VIERNES, local(20, 5), local(20, 6), HORAS, '07:00:00', '19:00:00')).toBeNull()
  })
})
