/**
 * turnosAgenda.test.ts — B8: huecos y turnos en la zona del consultorio.
 *
 * Las citas se escriben como INSTANTES UTC (`...Z`), igual que llegan de
 * `appointments`, y la zona del proceso se fija a propósito en cada bloque
 * para demostrar que el resultado no depende de ella (en Vercel es UTC).
 *
 * Fechas de cambio de horario de EE. UU. en 2026, que siguen las cuatro zonas
 * de la franja fronteriza: se adelanta el domingo 8 de marzo y se atrasa el
 * domingo 1 de noviembre.
 */

import { describe, it, expect, afterEach } from 'vitest'
import type { EventApi } from '@fullcalendar/core'
import type { DiaSemana, Horario } from '@/lib/configApp'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { tzDispositivo } from '@/lib/dates'
import { resumenDelDia } from '@/lib/agenda/huecosAgenda'
import {
  diaDeSemanaDeFecha, jornadaDeFecha, citaOcupa, tramosDeCitasEnZona,
  huecosDeFechaEnZona, turnosDeHueco, turnosDelDia, type OcupacionCita,
} from '@/lib/agenda/turnosAgenda'

const TODOS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

function horarioDe(inicio: string, fin: string, activos: readonly DiaSemana[] = TODOS): Horario {
  const h = {} as Horario
  for (const d of TODOS) h[d] = { activo: activos.includes(d), inicio, fin }
  return h
}

function cita(start_time: string, end_time: string, status: Status | null = 'scheduled', all_day = false): OcupacionCita {
  return { start_time, end_time, status, all_day }
}

const TZ_ORIGINAL = process.env.TZ
afterEach(() => { process.env.TZ = TZ_ORIGINAL })

describe('diaDeSemanaDeFecha / jornadaDeFecha', () => {
  it('el día de la semana sale de la fecha, sin zona', () => {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    expect(diaDeSemanaDeFecha('2026-11-11')).toBe(3) // miércoles
    expect(diaDeSemanaDeFecha('2026-11-15')).toBe(0) // domingo
  })

  it('una fecha mal formada se rechaza', () => {
    expect(() => diaDeSemanaDeFecha('2026-11-1')).toThrow()
    expect(() => diaDeSemanaDeFecha('2026-13-40')).toThrow()
  })

  it('día cerrado y día con fin no posterior al inicio no tienen jornada', () => {
    const h = horarioDe('09:00', '19:00', ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])
    expect(jornadaDeFecha('2026-11-15', h)).toBeNull() // domingo cerrado
    expect(jornadaDeFecha('2026-11-11', h)).toEqual({ desde: 540, hasta: 1140 })
    expect(jornadaDeFecha('2026-11-11', horarioDe('10:00', '10:00'))).toBeNull()
  })
})

describe('citaOcupa', () => {
  it('no_show ocupa, cancelada no, todo el día no, bloque sin estado sí', () => {
    const a = '2026-11-11T15:00:00Z', b = '2026-11-11T16:00:00Z'
    expect(citaOcupa(cita(a, b, 'no_show'))).toBe(true)
    expect(citaOcupa(cita(a, b, 'attended'))).toBe(true)
    expect(citaOcupa(cita(a, b, 'cancelled'))).toBe(false)
    expect(citaOcupa(cita(a, b, 'scheduled', true))).toBe(false)
    expect(citaOcupa({ start_time: a, end_time: b })).toBe(true)
  })
})

describe('tramosDeCitasEnZona', () => {
  it('Cancún con el proceso en UTC: minutos de pared de Cancún', () => {
    process.env.TZ = 'UTC'
    const t = tramosDeCitasEnZona([cita('2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z')], '2026-11-11', 'America/Cancun')
    expect(t).toEqual([{ desde: 600, hasta: 660 }]) // 10:00–11:00, UTC-5
  })

  it('una cita que cruza la medianoche se reparte entre los dos días', () => {
    const c = [cita('2026-11-12T04:00:00Z', '2026-11-12T06:00:00Z')] // 23:00–01:00 en Cancún
    expect(tramosDeCitasEnZona(c, '2026-11-11', 'America/Cancun')).toEqual([{ desde: 1380, hasta: 1440 }])
    expect(tramosDeCitasEnZona(c, '2026-11-12', 'America/Cancun')).toEqual([{ desde: 0, hasta: 60 }])
  })

  it('semiabierto: la que acaba justo a medianoche no entra en el día siguiente', () => {
    const c = [cita('2026-11-12T03:00:00Z', '2026-11-12T05:00:00Z')] // 22:00–00:00 en Cancún
    expect(tramosDeCitasEnZona(c, '2026-11-11', 'America/Cancun')).toEqual([{ desde: 1320, hasta: 1440 }])
    expect(tramosDeCitasEnZona(c, '2026-11-12', 'America/Cancun')).toEqual([])
  })

  it('cancelada y de todo el día no dejan tramo; no_show sí', () => {
    const c = [
      cita('2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z', 'cancelled'),
      cita('2026-11-11T05:00:00Z', '2026-11-12T05:00:00Z', 'scheduled', true),
      cita('2026-11-11T17:00:00Z', '2026-11-11T18:00:00Z', 'no_show'),
    ]
    expect(tramosDeCitasEnZona(c, '2026-11-11', 'America/Cancun')).toEqual([{ desde: 720, hasta: 780 }])
  })
})

describe('turnosDeHueco (P9)', () => {
  it('turnos de 45 min consecutivos desde el inicio; el resto se pierde', () => {
    expect(turnosDeHueco({ desde: 540, hasta: 660 }, 45)).toEqual([
      { desde: 540, hasta: 585 },
      { desde: 585, hasta: 630 },
    ])
  })

  it('una duración mayor que el hueco no deja turnos', () => {
    expect(turnosDeHueco({ desde: 540, hasta: 570 }, 45)).toEqual([])
  })

  it('una duración no válida no da turnos (ni cuelga)', () => {
    expect(turnosDeHueco({ desde: 540, hasta: 660 }, 0)).toEqual([])
    expect(turnosDeHueco({ desde: 540, hasta: 660 }, -30)).toEqual([])
    expect(turnosDeHueco({ desde: 540, hasta: 660 }, 7.5)).toEqual([])
    expect(turnosDeHueco({ desde: 540, hasta: 660 }, Number.NaN)).toEqual([])
  })
})

describe('turnosDelDia', () => {
  const CDMX = 'America/Mexico_City' // UTC-6 todo el año
  const base = { fecha: '2026-11-11', tz: CDMX, horario: horarioDe('09:00', '11:00') }

  it('turnos alrededor de una cita, en instantes UTC', () => {
    process.env.TZ = 'UTC'
    const r = turnosDelDia({ ...base, citas: [cita('2026-11-11T15:30:00Z', '2026-11-11T16:00:00Z')], duracionMin: 30 })
    expect(r).toEqual([
      { inicio: '2026-11-11T15:00:00.000Z', fin: '2026-11-11T15:30:00.000Z' },
      { inicio: '2026-11-11T16:00:00.000Z', fin: '2026-11-11T16:30:00.000Z' },
      { inicio: '2026-11-11T16:30:00.000Z', fin: '2026-11-11T17:00:00.000Z' },
    ])
  })

  it('no_show ocupa y cancelada no', () => {
    const noShow = turnosDelDia({ ...base, citas: [cita('2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z', 'no_show')], duracionMin: 60 })
    expect(noShow.map(t => t.inicio)).toEqual(['2026-11-11T16:00:00.000Z'])
    const cancelada = turnosDelDia({ ...base, citas: [cita('2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z', 'cancelled')], duracionMin: 60 })
    expect(cancelada.map(t => t.inicio)).toEqual(['2026-11-11T15:00:00.000Z', '2026-11-11T16:00:00.000Z'])
  })

  it('un día cerrado no tiene turnos', () => {
    const h = horarioDe('09:00', '11:00', ['lunes'])
    expect(turnosDelDia({ ...base, horario: h, citas: [], duracionMin: 30 })).toEqual([])
  })

  it('la anticipación recorta los turnos demasiado próximos', () => {
    const r = turnosDelDia({
      ...base, citas: [], duracionMin: 30,
      ahora: new Date('2026-11-11T15:10:00Z'), anticipacionMinHoras: 1,
    })
    expect(r.map(t => t.inicio)).toEqual(['2026-11-11T16:30:00.000Z'])
  })

  it('una jornada hasta las 24:00 compone el último fin al día siguiente', () => {
    const r = turnosDelDia({ fecha: '2026-11-11', tz: CDMX, horario: horarioDe('22:00', '24:00'), citas: [], duracionMin: 60 })
    expect(r).toEqual([
      { inicio: '2026-11-12T04:00:00.000Z', fin: '2026-11-12T05:00:00.000Z' },
      { inicio: '2026-11-12T05:00:00.000Z', fin: '2026-11-12T06:00:00.000Z' },
    ])
  })
})

describe('zonas con horario de verano (franja fronteriza)', () => {
  /* 09:00 de pared, en UTC, la víspera y el día de cada cambio. Hora de pared
     igual, instante distinto: es lo que la hora del proceso nunca daría. */
  const CASOS: { tz: string; marzo: [string, string]; noviembre: [string, string] }[] = [
    { tz: 'America/Tijuana',       marzo: ['17:00', '16:00'], noviembre: ['16:00', '17:00'] },
    { tz: 'America/Ciudad_Juarez', marzo: ['16:00', '15:00'], noviembre: ['15:00', '16:00'] },
    { tz: 'America/Ojinaga',       marzo: ['15:00', '14:00'], noviembre: ['14:00', '15:00'] },
    { tz: 'America/Matamoros',     marzo: ['15:00', '14:00'], noviembre: ['14:00', '15:00'] },
    { tz: 'America/Mexico_City',   marzo: ['15:00', '15:00'], noviembre: ['15:00', '15:00'] }, // control
  ]
  const unTurno = (fecha: string, tz: string): string | undefined =>
    turnosDelDia({ fecha, tz, horario: horarioDe('09:00', '10:00'), citas: [], duracionMin: 60 })[0]?.inicio

  for (const { tz, marzo, noviembre } of CASOS) {
    it(`${tz}: las 09:00 de pared siguen el cambio de horario`, () => {
      process.env.TZ = 'UTC'
      expect(unTurno('2026-03-07', tz)).toBe(`2026-03-07T${marzo[0]}:00.000Z`)
      expect(unTurno('2026-03-08', tz)).toBe(`2026-03-08T${marzo[1]}:00.000Z`)
      expect(unTurno('2026-10-31', tz)).toBe(`2026-10-31T${noviembre[0]}:00.000Z`)
      expect(unTurno('2026-11-01', tz)).toBe(`2026-11-01T${noviembre[1]}:00.000Z`)
    })
  }

  it('Tijuana, día del adelanto: una cita de 09:00–10:00 PDT ocupa las 09:00', () => {
    const r = turnosDelDia({
      fecha: '2026-03-08', tz: 'America/Tijuana', horario: horarioDe('09:00', '11:00'),
      citas: [cita('2026-03-08T16:00:00Z', '2026-03-08T17:00:00Z')], duracionMin: 60,
    })
    expect(r).toEqual([{ inicio: '2026-03-08T17:00:00.000Z', fin: '2026-03-08T18:00:00.000Z' }])
  })

  it('Tijuana, día del atraso: misma prueba con PST', () => {
    const r = turnosDelDia({
      fecha: '2026-11-01', tz: 'America/Tijuana', horario: horarioDe('09:00', '11:00'),
      citas: [cita('2026-11-01T17:00:00Z', '2026-11-01T18:00:00Z')], duracionMin: 60,
    })
    expect(r).toEqual([{ inicio: '2026-11-01T18:00:00.000Z', fin: '2026-11-01T19:00:00.000Z' }])
  })

  it('Tijuana, la hora que no existe (02:00–03:00 del 8 de marzo) no da turnos', () => {
    const r = turnosDelDia({ fecha: '2026-03-08', tz: 'America/Tijuana', horario: horarioDe('00:00', '04:00'), citas: [], duracionMin: 60 })
    expect(r.map(t => t.inicio)).toEqual(['2026-03-08T08:00:00.000Z', '2026-03-08T10:00:00.000Z']) // 00:00 PST y 03:00 PDT
  })
})

/* ─── Paridad con el panel de día del navegador ─────────────────────── */

function eventoDe(c: OcupacionCita, isGcalBlock = false): EventApi {
  /* Mismo patrón que `agendaMovida.test.ts`: sólo los campos que lee
     `resumenDelDia`. */
  return {
    start: new Date(c.start_time),
    end: new Date(c.end_time),
    allDay: c.all_day === true,
    extendedProps: isGcalBlock ? { isGcalBlock: true } : { status: c.status, paciente_id: 'p' },
  } as unknown as EventApi
}

describe('paridad con resumenDelDia (misma zona, mínimo 60)', () => {
  const citas: OcupacionCita[] = [
    cita('2026-08-26T14:00:00Z', '2026-08-26T15:00:00Z', 'confirmed'),
    cita('2026-08-26T14:30:00Z', '2026-08-26T15:30:00Z', 'no_show'),
    cita('2026-08-26T17:00:00Z', '2026-08-26T18:00:00Z', 'cancelled'),
    cita('2026-08-26T05:00:00Z', '2026-08-27T05:00:00Z', 'scheduled', true),
    cita('2026-08-26T21:30:00Z', '2026-08-26T22:00:00Z', 'scheduled'),
  ]
  const google: OcupacionCita = { start_time: '2026-08-26T19:00:00Z', end_time: '2026-08-26T20:00:00Z' }
  const horario = horarioDe('08:00', '18:00')

  for (const tz of ['America/Mexico_City', 'America/Tijuana', 'America/Cancun']) {
    it(`${tz}: huecos idénticos`, () => {
      process.env.TZ = tz
      const fecha = '2026-08-26'
      const panel = resumenDelDia([...citas.map(c => eventoDe(c)), eventoDe(google, true)], new Date(2026, 7, 26), horario)
      const servidor = huecosDeFechaEnZona({ fecha, tz: tzDispositivo(), horario, citas: [...citas, google] }, 60)
      expect(servidor).toEqual(panel.huecos)
      expect(servidor.length).toBeGreaterThan(0)
    })
  }

  it('Tijuana el día del adelanto: el panel se separa 60 min y el servidor no (la grieta documentada)', () => {
    process.env.TZ = 'America/Tijuana'
    const c = cita('2026-03-08T16:00:00Z', '2026-03-08T17:00:00Z') // 09:00–10:00 PDT
    const h = horarioDe('08:00', '12:00')
    const panel = resumenDelDia([eventoDe(c)], new Date(2026, 2, 8), h)
    const servidor = huecosDeFechaEnZona({ fecha: '2026-03-08', tz: 'America/Tijuana', horario: h, citas: [c] }, 60)
    expect(servidor).toEqual([{ desde: 480, hasta: 540 }, { desde: 600, hasta: 720 }])
    expect(panel.huecos).toEqual([{ desde: 540, hasta: 720 }])
  })
})
