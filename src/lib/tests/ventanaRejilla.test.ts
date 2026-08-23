/**
 * ventanaRejilla.test.ts — la rejilla de la agenda tiene que enseñar
 * TODAS las citas que existen, no sólo las que caen en 07:00–21:00.
 *
 * El bug: cinco citas reales de clínicas en producción están agendadas fuera
 * de esa franja (23:00, 05:30…). Existen, se editan y se cuentan, pero la
 * agenda no las pinta porque la rejilla estaba clavada. No se corrigen —son
 * datos de clínicas reales y son pasado—: lo que se corrige es la rejilla.
 *
 * ⚠️  LAS FECHAS SE CONSTRUYEN CON `new Date(a, m, d, h, min)`, A PROPÓSITO.
 * Ese constructor interpreta y `getHours()` devuelve en el huso de la máquina,
 * así que `new Date(2026, 7, 24, 23, 0).getHours()` vale 23 en Mérida, en
 * Madrid y en el CI. `vitest.config.ts` NO fija `TZ` (ver el aviso de
 * `husoCitas.test.ts`), y esta simetría es lo que hace que estos tests no
 * dependan de dónde corran. Con cadenas ISO (`'2026-08-24T23:00:00Z'`) sí
 * dependerían.
 */

import { describe, it, expect } from 'vitest'
import {
  calcularVentanaRejilla,
  tramoDeEvento,
  ventanaDeHorario,
  VENTANA_MINIMA_PRE_REDISENO,
  type EventoParaVentana,
  type RangoVisible,
} from '@/lib/agenda/ventanaRejilla'
import type { Horario } from '@/lib/configApp'

/** Semana del lunes 24/08/2026 al lunes 31/08/2026, como la da `datesSet`. */
const SEMANA: RangoVisible = {
  activeStart: new Date(2026, 7, 24, 0, 0),
  activeEnd:   new Date(2026, 7, 31, 0, 0),
}

function horarioDe(inicio: string, fin: string, activo = true): Horario {
  const dia = { activo, inicio, fin }
  return {
    lunes: { ...dia }, martes: { ...dia }, miercoles: { ...dia },
    jueves: { ...dia }, viernes: { ...dia },
    sabado: { activo: false, inicio, fin }, domingo: { activo: false, inicio, fin },
  }
}

/** Un evento con hora, del día 26/08/2026 (miércoles) salvo que se diga otro. */
function evento(
  desde: [number, number],
  hasta: [number, number] | null,
  extra: Partial<EventoParaVentana> = {},
  dia = 26,
): EventoParaVentana {
  return {
    start: new Date(2026, 7, dia, desde[0], desde[1]),
    end:   hasta ? new Date(2026, 7, dia, hasta[0], hasta[1]) : null,
    allDay: false,
    ...extra,
  }
}

const HORARIO_NORMAL = horarioDe('09:00', '19:00')

describe('calcularVentanaRejilla — el suelo previo al rediseño', () => {
  it('sin eventos y con horario normal, deja la rejilla como estaba', () => {
    expect(calcularVentanaRejilla([], SEMANA, HORARIO_NORMAL)).toEqual({
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
    })
  })

  it('no encoge la rejilla de una clínica de tarde (16:00–20:00)', () => {
    // Sin suelo, esta clínica pasaría de catorce horas de rejilla a cuatro el
    // primer día. Eso es cosa del rediseño, no de este arreglo.
    expect(calcularVentanaRejilla([], SEMANA, horarioDe('16:00', '20:00'))).toEqual({
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
    })
  })

  it('el suelo son las horas que la rejilla tenía clavadas', () => {
    expect(VENTANA_MINIMA_PRE_REDISENO).toEqual({ inicioHora: 7, finHora: 21 })
  })

  it('con todos los días inactivos, se queda en el suelo', () => {
    expect(calcularVentanaRejilla([], SEMANA, horarioDe('16:00', '20:00', false))).toEqual({
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
    })
  })
})

describe('calcularVentanaRejilla — el horario abre la ventana', () => {
  it('una clínica de 06:00 a 22:00 estira la rejilla, y eso es lo deseado', () => {
    // Hoy esta clínica pierde eventos en los dos bordes. Con el arreglo su
    // rejilla CRECE el día uno: es visible, y es correcto.
    expect(calcularVentanaRejilla([], SEMANA, horarioDe('06:00', '22:00'))).toEqual({
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
    })
  })

  it('toma el día más madrugador y el más tardío, no los de la vista', () => {
    const mixto = horarioDe('09:00', '19:00')
    mixto.sabado = { activo: true, inicio: '06:30', fin: '23:30' }
    expect(calcularVentanaRejilla([], SEMANA, mixto)).toEqual({
      slotMinTime: '06:00:00',
      slotMaxTime: '24:00:00',
    })
  })

  it('ignora una hora corrupta en vez de reventar', () => {
    const roto = horarioDe('09:00', '19:00')
    roto.martes = { activo: true, inicio: 'mañana', fin: '25:99' }
    expect(ventanaDeHorario(roto)).toEqual({ desde: 9 * 60, hasta: 19 * 60 })
  })

  /* ⚠️  UN HORARIO NOCTURNO NO SE PUEDE DESCARTAR EN SILENCIO.
     Sin la rama de `fin <= inicio`, un 22:00–02:00 daba `desde: 1320,
     hasta: 120` y la unión con el suelo se lo tragaba entero: la clínica veía
     07:00–21:00 y su horario no se honraba en ningún borde, sin ningún rastro.
     Es alcanzable: ni el modal ni `PUT /api/me/horario` comprueban el orden. */
  it('un día nocturno (22:00–02:00) abre el día entero, no se pierde', () => {
    const nocturno = horarioDe('09:00', '19:00')
    nocturno.viernes = { activo: true, inicio: '22:00', fin: '02:00' }
    expect(ventanaDeHorario(nocturno)).toEqual({ desde: 0, hasta: 1440 })
  })

  it('y la ventana resultante lo refleja', () => {
    const nocturno = horarioDe('09:00', '19:00')
    nocturno.viernes = { activo: true, inicio: '22:00', fin: '02:00' }
    expect(calcularVentanaRejilla([], SEMANA, nocturno)).toEqual({
      slotMinTime: '00:00:00', slotMaxTime: '24:00:00',
    })
  })

  it('un día de longitud cero (09:00–09:00) también, por lo mismo', () => {
    const degenerado = horarioDe('09:00', '19:00')
    degenerado.jueves = { activo: true, inicio: '09:00', fin: '09:00' }
    expect(ventanaDeHorario(degenerado)).toEqual({ desde: 0, hasta: 1440 })
  })

  it('un día nocturno no encoge lo que otros días ya habían abierto', () => {
    const mixto = horarioDe('06:00', '22:00')
    mixto.viernes = { activo: true, inicio: '23:00', fin: '05:00' }
    expect(ventanaDeHorario(mixto)).toEqual({ desde: 0, hasta: 1440 })
  })
})

describe('calcularVentanaRejilla — los eventos abren la ventana', () => {
  it('una cita a las 23:00 hace que la rejilla llegue a medianoche', () => {
    const v = calcularVentanaRejilla([evento([23, 0], [23, 30])], SEMANA, HORARIO_NORMAL)
    expect(v.slotMaxTime).toBe('24:00:00')
  })

  it('una cita a las 05:30 baja la rejilla a las 05:00', () => {
    const v = calcularVentanaRejilla([evento([5, 30], [6, 20])], SEMANA, HORARIO_NORMAL)
    expect(v.slotMinTime).toBe('05:00:00')
  })

  it('una cita CON HORA a las 00:00 abre la ventana hasta medianoche', () => {
    // El filtro es por `allDay`, no por «empieza a medianoche»: esta cita
    // existe, se pinta en la rejilla, y es justamente la que hay que ver.
    const v = calcularVentanaRejilla([evento([0, 0], [0, 45])], SEMANA, HORARIO_NORMAL)
    expect(v.slotMinTime).toBe('00:00:00')
  })

  it('nunca pasa de 24:00:00 — el recorte que impide el bucle', () => {
    const v = calcularVentanaRejilla([evento([23, 0], [23, 59])], SEMANA, HORARIO_NORMAL)
    expect(v.slotMaxTime).toBe('24:00:00')
  })
})

describe('calcularVentanaRejilla — alineación a la hora en punto', () => {
  it('el mínimo baja a la hora en punto (piso)', () => {
    expect(calcularVentanaRejilla([evento([5, 45], [6, 15])], SEMANA, HORARIO_NORMAL).slotMinTime)
      .toBe('05:00:00')
  })

  it('el máximo sube a la hora en punto (techo)', () => {
    expect(calcularVentanaRejilla([evento([21, 0], [21, 10])], SEMANA, HORARIO_NORMAL).slotMaxTime)
      .toBe('22:00:00')
  })

  it('lo que ya está en punto no se mueve', () => {
    const v = calcularVentanaRejilla([evento([6, 0], [22, 0])], SEMANA, HORARIO_NORMAL)
    expect(v).toEqual({ slotMinTime: '06:00:00', slotMaxTime: '22:00:00' })
  })

  it('siempre devuelve HH:MM:SS con dos dígitos', () => {
    const v = calcularVentanaRejilla([evento([5, 30], [23, 30])], SEMANA, HORARIO_NORMAL)
    expect(v.slotMinTime).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(v.slotMaxTime).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('calcularVentanaRejilla — qué eventos NO cuentan', () => {
  it('los de todo el día no tocan la rejilla horaria', () => {
    const todoElDia = evento([0, 0], [0, 0], { allDay: true })
    expect(calcularVentanaRejilla([todoElDia], SEMANA, HORARIO_NORMAL)).toEqual({
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
    })
  })

  it('los de fondo tampoco', () => {
    const fondo = evento([23, 0], [23, 30], { display: 'background' })
    expect(calcularVentanaRejilla([fondo], SEMANA, HORARIO_NORMAL).slotMaxTime).toBe('21:00:00')
  })

  /* `inverse-background` es la etiqueta que FullCalendar le pone al fondo de
     `businessHours`, y sus horas son el COMPLEMENTO del horario: colarlo
     abriría la ventana justo AL REVÉS de lo que se pretende.
     Hoy no llega ninguno —`businessHours` es una rebanada de estado aparte y no
     entra en el `eventStore` que alimenta `eventsSet`—, así que este test
     protege el filtro, no un camino vivo. Es la red para el día que alguien
     meta un evento de fondo por una fuente normal. */
  it('los de fondo INVERSO tampoco, que son los peligrosos', () => {
    const inverso = evento([23, 0], [23, 30], { display: 'inverse-background' })
    expect(calcularVentanaRejilla([inverso], SEMANA, HORARIO_NORMAL).slotMaxTime).toBe('21:00:00')
  })

  it('los de otra semana tampoco', () => {
    const otraSemana = evento([23, 0], [23, 30], {}, 15)
    expect(calcularVentanaRejilla([otraSemana], SEMANA, HORARIO_NORMAL).slotMaxTime).toBe('21:00:00')
  })
})

describe('calcularVentanaRejilla — solapamiento semiabierto', () => {
  it('excluye el que empieza justo en el corte (activeEnd)', () => {
    const enElCorte: EventoParaVentana = {
      start: new Date(2026, 7, 31, 0, 0), end: new Date(2026, 7, 31, 1, 0), allDay: false,
    }
    expect(calcularVentanaRejilla([enElCorte], SEMANA, HORARIO_NORMAL).slotMinTime).toBe('07:00:00')
  })

  it('excluye el que termina justo en activeStart', () => {
    const pegadoAntes: EventoParaVentana = {
      start: new Date(2026, 7, 23, 23, 0), end: new Date(2026, 7, 24, 0, 0), allDay: false,
    }
    expect(calcularVentanaRejilla([pegadoAntes], SEMANA, HORARIO_NORMAL).slotMaxTime).toBe('21:00:00')
  })

  it('incluye el que sólo asoma un minuto dentro del rango', () => {
    const asoma: EventoParaVentana = {
      start: new Date(2026, 7, 23, 23, 0), end: new Date(2026, 7, 24, 0, 30), allDay: false,
    }
    // Cruza medianoche → exige el día entero (ver `tramoDeEvento`).
    expect(calcularVentanaRejilla([asoma], SEMANA, HORARIO_NORMAL)).toEqual({
      slotMinTime: '00:00:00', slotMaxTime: '24:00:00',
    })
  })
})

describe('tramoDeEvento — los que cruzan medianoche', () => {
  it('lunes 18:00 → miércoles 10:00 exige el día entero, no 18:00–10:00', () => {
    const t = tramoDeEvento(new Date(2026, 7, 24, 18, 0), new Date(2026, 7, 26, 10, 0))
    expect(t).toEqual({ desde: 0, hasta: 1440 })
  })

  it('terminar EXACTAMENTE a medianoche no es cruzar', () => {
    const t = tramoDeEvento(new Date(2026, 7, 26, 22, 0), new Date(2026, 7, 27, 0, 0))
    expect(t).toEqual({ desde: 22 * 60, hasta: 1440 })
  })

  /* ⚠️  EL CRUCE DE UN SOLO DÍA CON MINUTOS SUELTOS — el que se escapa.
     Los dos casos de arriba se salvan por rutas distintas: el de 18:00→10:00
     cruza dos días, y el de 22:00→00:00 no cruza. Éste cae justo en medio
     (`dias === 1` con minutos ≠ 0) y es donde un mín/máx ingenuo daría
     mín 23:00 y máx 00:30 — una ventana INVERTIDA.
     Y lo que se pierde con ella no es la punta del lunes: en timeGrid el
     evento se trocea por día, y el trozo del MARTES es 00:00–00:30, que sin
     `slotMinTime = 00:00` queda invisible. */
  it('lunes 23:00 → martes 00:30 exige el día entero, no 23:00–00:30', () => {
    const t = tramoDeEvento(new Date(2026, 7, 24, 23, 0), new Date(2026, 7, 25, 0, 30))
    expect(t).toEqual({ desde: 0, hasta: 1440 })
  })

  it('y el trozo del MARTES de ese evento cabe en la ventana resultante', () => {
    const v = calcularVentanaRejilla(
      [{ start: new Date(2026, 7, 24, 23, 0), end: new Date(2026, 7, 25, 0, 30), allDay: false }],
      SEMANA,
      HORARIO_NORMAL,
    )
    expect(v).toEqual({ slotMinTime: '00:00:00', slotMaxTime: '24:00:00' })
  })

  it('un evento normal da sus dos horas de reloj', () => {
    const t = tramoDeEvento(new Date(2026, 7, 26, 9, 15), new Date(2026, 7, 26, 10, 45))
    expect(t).toEqual({ desde: 9 * 60 + 15, hasta: 10 * 60 + 45 })
  })

  /* ⚠️  ESTE TEST DECÍA «sin fin, es puntual» Y CONGELABA UNA GRIETA.
     `EventApi.end` vale `null` cuando el def no tiene `hasEnd`, pero
     FullCalendar sí le pinta una hora (`defaultTimedEventDuration`), así que
     tratarlo como puntual devolvía el bug original: un evento sin fin a las
     23:00 daba `slotMaxTime = '23:00:00'` y seguía invisible. */
  it('sin fin, ocupa la hora que FullCalendar le pinta', () => {
    expect(tramoDeEvento(new Date(2026, 7, 26, 13, 0), null)).toEqual({ desde: 780, hasta: 840 })
  })

  it('sin fin a las 23:00, llega justo a medianoche y no cruza', () => {
    expect(tramoDeEvento(new Date(2026, 7, 26, 23, 0), null)).toEqual({ desde: 23 * 60, hasta: 1440 })
  })

  /* La razón de calcular el fin efectivo como FECHA y no sumando 60 al tramo:
     este evento se pinta hasta las 00:30 del día siguiente, y ese trozo
     necesita `slotMinTime = 00:00`. Sumar minutos daría `hasta: 1470`, que el
     techo recortaría a 1440 dejando el mínimo en 23:00 — trozo invisible. */
  it('sin fin a las 23:30 cruza medianoche y exige el día entero', () => {
    expect(tramoDeEvento(new Date(2026, 7, 26, 23, 30), null)).toEqual({ desde: 0, hasta: 1440 })
  })

  it('un fin ANTERIOR al inicio no abre el día entero', () => {
    // Dato corrupto, no un cruce de medianoche. Que un registro invertido
    // estire la rejilla a 00:00–24:00 sería peor que ignorar su fin.
    const t = tramoDeEvento(new Date(2026, 7, 26, 18, 0), new Date(2026, 7, 26, 9, 0))
    expect(t).toEqual({ desde: 18 * 60, hasta: 18 * 60 })
  })
})

describe('calcularVentanaRejilla — sin rango todavía', () => {
  it('en el primer render manda el horario con su suelo', () => {
    const v = calcularVentanaRejilla([evento([23, 0], [23, 30])], null, horarioDe('06:00', '22:00'))
    expect(v).toEqual({ slotMinTime: '06:00:00', slotMaxTime: '22:00:00' })
  })
})
