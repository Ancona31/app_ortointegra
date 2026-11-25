/**
 * agendaMovida.test.ts — A2.1: pruebas nuevas para la lógica pura que
 * `AgendaCliente.tsx` tenía sin exportar y que se movió a `src/lib/agenda/
 * {horario,fechas,huecos,conteo,vistas,tarjetas}Agenda.ts`. El movimiento NO
 * cambió comportamiento; estas pruebas documentan el comportamiento ACTUAL,
 * no uno deseado.
 *
 * ⚠️ `eventoOcupa` (huecosAgenda.ts) NO EXCLUYE «no asistió» DE LA OCUPACIÓN,
 * Y ES A PROPÓSITO — no es el defecto que podría parecer a primera vista. El
 * comentario de cabecera del bloque 8 (`huecosAgenda.ts`, justo antes de
 * `Tramo`) lo dice en claro: «`no_show` SÍ ocupa — el paciente no vino, pero
 * la hora se consumió y ofrecerla como libre sería ofrecer una hora que ya
 * pasó». Sólo `cancelled` libera el tramo. Las pruebas de abajo verifican
 * ESO, que es lo que el código hace y lo que el código dice que quiere hacer.
 *
 * ⚠️  LAS FECHAS SE CONSTRUYEN CON `new Date(a, m, d, h, min)`, igual que en
 * `ventanaRejilla.test.ts` y por el mismo motivo: ese constructor interpreta
 * en el huso de la máquina y `getDay()`/`getHours()` devuelven en el mismo,
 * así que estos tests no dependen de dónde corran. `vitest.config.ts` NO fija
 * `TZ`.
 */

import { describe, it, expect } from 'vitest'
import type { EventApi } from '@fullcalendar/core'
import type { DiaSemana, Horario } from '@/lib/configApp'
import type { Appointment, Status } from '@/lib/agenda/tiposAgenda'
import {
  tramosDeOcupacion, fusionarTramos, recortarATramo, huecosDe, resumenDelDia,
  type Tramo,
} from '@/lib/agenda/huecosAgenda'
import { avisoFueraDeHorario, avisoDiaCerrado } from '@/lib/agenda/horarioAgenda'
import { fechasDeTodoElDia, finExclusivoDeUltimoDia } from '@/lib/agenda/fechasAgenda'
import { vistaEnElOtroFormato } from '@/lib/agenda/vistasAgenda'

/* ─── Fixtures compartidas ──────────────────────────────────────────── */

function horarioDe(inicio: string, fin: string, diasActivos: readonly DiaSemana[]): Horario {
  const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
  const h = {} as Horario
  for (const d of DIAS) h[d] = { activo: diasActivos.includes(d), inicio, fin }
  return h
}

/** Lunes a viernes 09:00–19:00, fin de semana cerrado — la clínica típica. */
const HORARIO_NORMAL = horarioDe('09:00', '19:00', ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])

/**
 * Un `EventApi` falso con sólo los campos que `eventoOcupa`/`tramosDeOcupacion`
 * /`desgloseDeEstados`/`contarTodoElDia` leen de verdad: `start`, `end`,
 * `allDay` y `extendedProps`. `EventApi` es una interfaz enorme con métodos
 * (`setProp`, `setStart`…) que nadie aquí llama; reconstruirla entera no
 * aportaría nada a la prueba. Mismo patrón que `as unknown as SupabaseClient`
 * en `gcalConexion.test.ts` y `as unknown as Paciente` en
 * `hojaFrontalData.test.ts`.
 */
function evento(
  desde: [number, number],
  hasta: [number, number] | null,
  extra: { status?: Status; isGcalBlock?: boolean; paciente_id?: string | null } = {},
  dia = 26,
): EventApi {
  return {
    start: new Date(2026, 7, dia, desde[0], desde[1]),
    end:   hasta ? new Date(2026, 7, dia, hasta[0], hasta[1]) : null,
    allDay: false,
    extendedProps: { ...extra },
  } as unknown as EventApi
}

/** Un evento de TODO EL DÍA, propio o de Google. */
function eventoTodoElDia(extra: { isGcalBlock?: boolean } = {}, dia = 26): EventApi {
  return {
    start: new Date(2026, 7, dia, 0, 0),
    end:   new Date(2026, 7, dia + 1, 0, 0),
    allDay: true,
    extendedProps: { ...extra },
  } as unknown as EventApi
}

const DIA = new Date(2026, 7, 26) // miércoles 26/08/2026

/* ─── tramosDeOcupacion / fusionarTramos / recortarATramo / huecosDe ──── */

describe('tramosDeOcupacion', () => {
  it('convierte un evento con hora a minutos desde medianoche', () => {
    expect(tramosDeOcupacion([evento([9, 0], [10, 0])], DIA)).toEqual([{ desde: 540, hasta: 600 }])
  })

  it('una cita cancelada NO ocupa — el hueco queda libre', () => {
    expect(tramosDeOcupacion([evento([9, 0], [10, 0], { status: 'cancelled' })], DIA)).toEqual([])
  })

  it('una cita «no asistió» SÍ ocupa — decisión de producto documentada, no un defecto', () => {
    expect(tramosDeOcupacion([evento([9, 0], [10, 0], { status: 'no_show' })], DIA))
      .toEqual([{ desde: 540, hasta: 600 }])
  })

  it('un evento de Google CON HORA ocupa, aunque no tenga `status`', () => {
    expect(tramosDeOcupacion([evento([9, 0], [10, 0], { isGcalBlock: true })], DIA))
      .toEqual([{ desde: 540, hasta: 600 }])
  })

  it('un evento de Google de TODO EL DÍA no resta nada — `allDay` corta antes de mirar el origen', () => {
    expect(tramosDeOcupacion([eventoTodoElDia({ isGcalBlock: true })], DIA)).toEqual([])
  })

  it('un evento PROPIO de todo el día tampoco resta', () => {
    expect(tramosDeOcupacion([eventoTodoElDia()], DIA)).toEqual([])
  })

  it('descarta un evento sin start o sin end', () => {
    expect(tramosDeOcupacion([evento([9, 0], null)], DIA)).toEqual([])
  })

  it('recorta al día un evento que cruza la medianoche de salida', () => {
    // Empieza a las 23:00 del 26 y termina a las 01:00 del 27: dentro del 26
    // sólo cuenta de 23:00 a 24:00 (1380–1440).
    const ev = evento([23, 0], [1, 0], {}, 26)
    ;(ev as unknown as { end: Date }).end = new Date(2026, 7, 27, 1, 0)
    expect(tramosDeOcupacion([ev], DIA)).toEqual([{ desde: 1380, hasta: 1440 }])
  })
})

describe('fusionarTramos', () => {
  it('ordena y funde dos tramos solapados en uno', () => {
    expect(fusionarTramos([{ desde: 570, hasta: 630 }, { desde: 540, hasta: 600 }]))
      .toEqual([{ desde: 540, hasta: 630 }])
  })

  it('tramos que no se tocan quedan separados', () => {
    expect(fusionarTramos([{ desde: 540, hasta: 600 }, { desde: 700, hasta: 760 }]))
      .toEqual([{ desde: 540, hasta: 600 }, { desde: 700, hasta: 760 }])
  })

  it('un tramo justo pegado al anterior (fin = inicio del siguiente) se funde', () => {
    expect(fusionarTramos([{ desde: 540, hasta: 600 }, { desde: 600, hasta: 660 }]))
      .toEqual([{ desde: 540, hasta: 660 }])
  })

  it('lista vacía da lista vacía', () => {
    expect(fusionarTramos([])).toEqual([])
  })
})

describe('recortarATramo', () => {
  const jornada: Tramo = { desde: 540, hasta: 1140 } // 09:00–19:00

  it('un tramo ya dentro de la jornada no cambia', () => {
    expect(recortarATramo([{ desde: 600, hasta: 660 }], jornada)).toEqual([{ desde: 600, hasta: 660 }])
  })

  it('una cirugía que empieza antes de abrir se recorta al suelo de la jornada', () => {
    expect(recortarATramo([{ desde: 0, hasta: 600 }], jornada)).toEqual([{ desde: 540, hasta: 600 }])
  })

  it('un tramo entero fuera de la jornada se descarta', () => {
    expect(recortarATramo([{ desde: 1200, hasta: 1260 }], jornada)).toEqual([])
  })
})

describe('huecosDe', () => {
  const jornada: Tramo = { desde: 540, hasta: 1140 } // 09:00–19:00, 600 min

  it('sin ocupación, toda la jornada es un único hueco', () => {
    expect(huecosDe(jornada, [], 60)).toEqual([{ desde: 540, hasta: 1140 }])
  })

  it('reparte el hueco antes y después de una ocupación central', () => {
    expect(huecosDe(jornada, [{ desde: 600, hasta: 660 }], 60)).toEqual([
      { desde: 540, hasta: 600 },
      { desde: 660, hasta: 1140 },
    ])
  })

  it('un hueco por debajo del mínimo no se lista (30 min entre citas, mínimo 60)', () => {
    const ocupados: Tramo[] = [{ desde: 540, hasta: 600 }, { desde: 630, hasta: 1140 }]
    expect(huecosDe(jornada, ocupados, 60)).toEqual([])
  })

  it('la jornada entera ocupada no deja huecos', () => {
    expect(huecosDe(jornada, [{ desde: 540, hasta: 1140 }], 60)).toEqual([])
  })
})

/* ─── resumenDelDia ─────────────────────────────────────────────────── */

describe('resumenDelDia', () => {
  it('un día sin eventos, con jornada normal, da la jornada entera libre', () => {
    const r = resumenDelDia([], DIA, HORARIO_NORMAL)
    expect(r.jornada).toEqual({ desde: 540, hasta: 1140 })
    expect(r.ocupadas).toBe(0)
    expect(r.libres).toBe(600)
    expect(r.huecos).toEqual([{ desde: 540, hasta: 1140 }])
    expect(r.todoElDia).toBe(0)
    expect(r.porEstado).toEqual([])
  })

  it('ocupadas + libres siempre suman la jornada, incluso con una cita fuera de horario', () => {
    // 19:00–21:00: el consultorio cierra a las 19:00, así que esa cita aporta
    // CERO horas ocupadas — el mismo caso que razona el comentario de cabecera.
    const r = resumenDelDia([evento([19, 0], [21, 0], { status: 'confirmed' })], DIA, HORARIO_NORMAL)
    expect(r.ocupadas).toBe(0)
    expect(r.libres).toBe(600)
    expect(r.ocupadas + r.libres).toBe(600)
  })

  it('un día sin horario de consulta (domingo) no tiene jornada ni huecos', () => {
    const domingo = new Date(2026, 7, 30) // domingo
    const r = resumenDelDia([], domingo, HORARIO_NORMAL)
    expect(r.jornada).toBeNull()
    expect(r.ocupadas).toBe(0)
    expect(r.libres).toBe(0)
    expect(r.huecos).toEqual([])
  })

  it('cuenta el desglose por estado sólo de las citas, con cero en los ausentes', () => {
    const eventos = [
      evento([9, 0], [10, 0], { status: 'scheduled', paciente_id: 'p1' }),
      evento([10, 0], [11, 0], { status: 'scheduled', paciente_id: 'p2' }),
      evento([11, 0], [12, 0], { status: 'attended', paciente_id: 'p3' }),
      // Evento genérico (sin paciente): no cuenta en el desglose de CITAS.
      evento([12, 0], [13, 0], { status: 'scheduled', paciente_id: null }),
      // Bloque de Google: tampoco.
      evento([13, 0], [14, 0], { isGcalBlock: true }),
    ]
    const r = resumenDelDia(eventos, DIA, HORARIO_NORMAL)
    expect(r.porEstado).toEqual([
      { estado: 'scheduled', n: 2 },
      { estado: 'attended', n: 1 },
    ])
  })

  it('cuenta los eventos de todo el día aparte, sin que resten horas', () => {
    const r = resumenDelDia([eventoTodoElDia()], DIA, HORARIO_NORMAL)
    expect(r.todoElDia).toBe(1)
    expect(r.ocupadas).toBe(0)
    expect(r.libres).toBe(600)
  })
})

/* ─── avisoFueraDeHorario / avisoDiaCerrado ────────────────────────────
 * DIAS usa `getDay()`: 26/08/2026 es miércoles, 30/08/2026 es domingo. */

describe('avisoFueraDeHorario', () => {
  it('dentro del horario no hay aviso', () => {
    expect(avisoFueraDeHorario(new Date(2026, 7, 26, 10, 0), HORARIO_NORMAL, 'Vas a agendar a las')).toBeNull()
  })

  it('antes de abrir, avisa con la hora y el horario de ese día', () => {
    const r = avisoFueraDeHorario(new Date(2026, 7, 26, 7, 0), HORARIO_NORMAL, 'Vas a agendar a las')
    expect(r).toContain('07:00')
    expect(r).toContain('09:00 a 19:00')
  })

  it('un día SIN consulta activa avisa que esa clínica no atiende ese día', () => {
    const r = avisoFueraDeHorario(new Date(2026, 7, 30, 10, 0), HORARIO_NORMAL, 'Vas a agendar a las')
    expect(r).toContain('domingo')
    expect(r).toContain('no atiende')
  })

  it('justo a la hora de cierre todavía cuenta como fuera (el inicio es exclusivo arriba)', () => {
    expect(avisoFueraDeHorario(new Date(2026, 7, 26, 19, 0), HORARIO_NORMAL, 'x')).not.toBeNull()
  })
})

describe('avisoDiaCerrado', () => {
  it('un día activo no da aviso', () => {
    expect(avisoDiaCerrado(new Date(2026, 7, 26), HORARIO_NORMAL)).toBeNull()
  })

  it('un día sin consulta (domingo) avisa sin mencionar ninguna hora', () => {
    const r = avisoDiaCerrado(new Date(2026, 7, 30), HORARIO_NORMAL)
    expect(r).not.toBeNull()
    expect(r).toContain('domingo')
    expect(r).not.toMatch(/\d\d:\d\d/)
  })
})

/* ─── fechasDeTodoElDia / finExclusivoDeUltimoDia ──────────────────────
 * El convenio: `start_time`/`end_time` guardan medianoche en la zona del
 * CONSULTORIO, fin EXCLUSIVO (un día de un solo día va de 19T00:00 a
 * 20T00:00). `fechasDeTodoElDia` lo traduce al «último día incluido» que
 * enseña el modal, con `desplazarFecha` sobre fechas-solo (no en UTC). */

function apt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1', title: 'Evento', start_time: '2026-08-19T00:00:00-06:00', end_time: '2026-08-20T00:00:00-06:00',
    all_day: true, status: 'scheduled', notes: null, paciente_id: null, medico_id: null,
    google_event_id: null, gcal_sync_status: 'unbound', updated_at: '2026-08-01T00:00:00Z',
    consultorio_id: null, consultorio_nombre: null, consultorio_nombre_corto: null,
    consultorio_direccion: null, consultorio_telefono: null, consultorio_timezone: 'America/Mexico_City',
    icono: null, color: null,
    ...over,
  }
}

describe('fechasDeTodoElDia', () => {
  it('un evento de un solo día: fecha y fechaFin son el mismo día (último día incluido)', () => {
    expect(fechasDeTodoElDia(apt())).toEqual({ fecha: '2026-08-19', fechaFin: '2026-08-19' })
  })

  it('un evento de varios días: fechaFin es el último día INCLUIDO, un día antes del fin exclusivo', () => {
    const r = fechasDeTodoElDia(apt({
      start_time: '2026-08-19T00:00:00-06:00',
      end_time:   '2026-08-22T00:00:00-06:00', // fin exclusivo: hasta el 22 sin incluirlo
    }))
    expect(r).toEqual({ fecha: '2026-08-19', fechaFin: '2026-08-21' })
  })

  it('lee las fechas en la zona del CONSULTORIO de la fila, no en la del dispositivo', () => {
    // Medianoche en Cancún (America/Cancun, UTC-5 fijo) es la 1 a.m. en el
    // Centro (UTC-6): si esto leyera en el huso local se correría un día.
    const r = fechasDeTodoElDia(apt({
      start_time: '2026-08-19T05:00:00Z', // 00:00 del 19 en Cancún
      end_time:   '2026-08-20T05:00:00Z',
      consultorio_timezone: 'America/Cancun',
    }))
    expect(r).toEqual({ fecha: '2026-08-19', fechaFin: '2026-08-19' })
  })
})

describe('finExclusivoDeUltimoDia', () => {
  it('es el inverso de `ultimoDiaIncluido`: suma un día', () => {
    expect(finExclusivoDeUltimoDia('2026-08-19')).toBe('2026-08-20')
  })

  it('cruza el fin de mes correctamente', () => {
    expect(finExclusivoDeUltimoDia('2026-08-31')).toBe('2026-09-01')
  })
})

/* ─── vistaEnElOtroFormato ──────────────────────────────────────────── */

describe('vistaEnElOtroFormato', () => {
  it('Semana en ancho pasa a listWeek en estrecho', () => {
    expect(vistaEnElOtroFormato('timeGridWeek', true)).toBe('listWeek')
  })

  it('listWeek en estrecho vuelve a timeGridWeek en ancho', () => {
    expect(vistaEnElOtroFormato('listWeek', false)).toBe('timeGridWeek')
  })

  it('Día se comporta igual que Semana, con su propia pareja', () => {
    expect(vistaEnElOtroFormato('timeGridDay', true)).toBe('listDay')
    expect(vistaEnElOtroFormato('listDay', false)).toBe('timeGridDay')
  })

  it('Mes es su propia pareja en los dos anchos', () => {
    expect(vistaEnElOtroFormato('dayGridMonth', true)).toBe('dayGridMonth')
    expect(vistaEnElOtroFormato('dayGridMonth', false)).toBe('dayGridMonth')
  })

  it('es idempotente: pedir el formato en el que ya está devuelve la misma vista', () => {
    expect(vistaEnElOtroFormato('listWeek', true)).toBe('listWeek')
    expect(vistaEnElOtroFormato('timeGridWeek', false)).toBe('timeGridWeek')
  })

  it('una vista desconocida se devuelve tal cual, sin intentar adivinar', () => {
    expect(vistaEnElOtroFormato('multiMonthYear', true)).toBe('multiMonthYear')
  })
})
