/**
 * rangoQuePedir.test.ts — el rango que se le pide al servidor tiene que
 * CONTENER siempre lo que la vista pinta, y no puede moverse cuando se pliegan
 * columnas.
 *
 * Estas dos reglas se pagaron con dos de los cuatro fallos graves de la primera
 * auditoría del botón «Compactar», y hasta ahora sólo las sostenía la
 * comprobación a mano en el navegador. Ver la cabecera de
 * `@/lib/agenda/rangoQuePedir`.
 *
 * ⚠️  LAS FECHAS SE CONSTRUYEN CON `new Date(a, m, d, ...)`, igual que en
 * `ventanaRejilla.test.ts` y por el mismo motivo: ese constructor interpreta en
 * el huso de la máquina y `getDay()` devuelve en el mismo, así que los tests no
 * dependen de dónde corran. `vitest.config.ts` NO fija `TZ`.
 *
 * La excepción es el bloque de horario de verano, que SÍ fija `TZ` a propósito
 * y lo explica ahí.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'

/** Un rango como el que FullCalendar entrega a la fuente de eventos. */
function rango(desde: Date, hasta: Date): { startStr: string; endStr: string } {
  return { startStr: desde.toISOString(), endStr: hasta.toISOString() }
}

/** ¿El resultado CONTIENE a la entrada? La regla que manda sobre todas. */
function contiene(
  fuera: { startStr: string; endStr: string },
  dentro: { startStr: string; endStr: string },
): boolean {
  return new Date(fuera.startStr) <= new Date(dentro.startStr)
    && new Date(fuera.endStr) >= new Date(dentro.endStr)
}

/** Para leer los fallos como fechas y no como cadenas ISO en otro huso. */
function comoFechas(r: { startStr: string; endStr: string }): [string, string] {
  return [new Date(r.startStr).toDateString(), new Date(r.endStr).toDateString()]
}

describe('rangoQuePedir — nunca pide menos de lo que se pinta', () => {
  it('en timeGridWeek contiene la semana entregada', () => {
    const semana = rango(new Date(2026, 7, 17), new Date(2026, 7, 24))
    expect(contiene(rangoQuePedir(semana), semana)).toBe(true)
  })

  it('en timeGridDay contiene el día entregado', () => {
    // Se trae la semana entera del día mostrado. De más a propósito: a cambio
    // la URL no depende de `hiddenDays`.
    const dia = rango(new Date(2026, 7, 26), new Date(2026, 7, 27))
    expect(contiene(rangoQuePedir(dia), dia)).toBe(true)
    expect(comoFechas(rangoQuePedir(dia))).toEqual(['Mon Aug 24 2026', 'Mon Aug 31 2026'])
  })

  it('en dayGridMonth contiene el bloque de seis semanas entregado', () => {
    // Agosto de 2026 encajado a semanas de lunes: del 27 de julio al 7 de sept.
    const mes = rango(new Date(2026, 6, 27), new Date(2026, 8, 7))
    expect(contiene(rangoQuePedir(mes), mes)).toBe(true)
  })

  it('sobre un mes ya encajado no estira NI UNA semana de más', () => {
    /* ⚠️  EL CASO APRETADO, y el que justifica el `- 1 ms` de la función.
       Febrero de 2027 empieza en lunes y tiene 28 días —cuatro semanas
       exactas—, así que `fixedWeekCount` lo rellena a seis: del 1 de febrero
       al 15 de marzo, con los dos extremos ya en lunes a medianoche. Encajar
       el fin sin restar ese milisegundo lo empujaría al lunes SIGUIENTE y
       pediría una semana entera de más en cada carga de cualquier mes. */
    const febrero = rango(new Date(2027, 1, 1), new Date(2027, 2, 15))
    const pedido = rangoQuePedir(febrero)
    expect(contiene(pedido, febrero)).toBe(true)
    expect(comoFechas(pedido)).toEqual(['Mon Feb 01 2027', 'Mon Mar 15 2027'])
  })
})

describe('rangoQuePedir — invariante frente a hiddenDays', () => {
  /* ⚠️  ESTO ES LO QUE COMPRA EL «CERO PETICIONES AL PULSAR EL BOTÓN».
     `trimHiddenDays` recorta los días plegados de los EXTREMOS del rango
     activo, así que la vista entrega bordes distintos según qué columnas estén
     ocultas. Si eso llegara a la URL, plegar columnas —que es un cambio de
     VISTA— dispararía peticiones de RED. Encajado a la semana natural, los tres
     casos de abajo dan exactamente el mismo rango pedido.

     Un margen fijo NO servía: correr el borde un día lo movía con él en vez de
     fijarlo. Ese intento existió y está documentado en la cabecera. */
  const SIN_PLEGAR      = rango(new Date(2026, 7, 17), new Date(2026, 7, 24))
  const SIN_FIN_DE_SEMANA = rango(new Date(2026, 7, 17), new Date(2026, 7, 22))
  const SIN_LUNES       = rango(new Date(2026, 7, 18), new Date(2026, 7, 24))

  it('la misma semana con y sin fin de semana plegado pide lo mismo', () => {
    expect(rangoQuePedir(SIN_FIN_DE_SEMANA)).toEqual(rangoQuePedir(SIN_PLEGAR))
  })

  it('y con el lunes plegado —recorte por el otro extremo— también', () => {
    expect(rangoQuePedir(SIN_LUNES)).toEqual(rangoQuePedir(SIN_PLEGAR))
  })

  it('y lo que pide es la semana natural entera', () => {
    expect(comoFechas(rangoQuePedir(SIN_FIN_DE_SEMANA))).toEqual(['Mon Aug 17 2026', 'Mon Aug 24 2026'])
  })
})

describe('rangoQuePedir — aritmética de calendario, no de milisegundos', () => {
  const TZ_ORIGINAL = process.env.TZ
  afterEach(() => { process.env.TZ = TZ_ORIGINAL })

  it('una semana que cruza el fin del horario de verano sigue conteniéndola', () => {
    /* ⚠️  ÉSTA ES LA ÚNICA PRUEBA DEL REPO QUE FIJA `TZ`, Y NO SE PUEDE
       ESCRIBIR SIN FIJARLA: México abolió el horario de verano en 2022, así
       que en el huso de la clínica el caso no existe y en un CI en UTC tampoco.
       Se usa Europe/Madrid, donde el horario de verano acaba el domingo 25 de
       octubre de 2026 — dentro de la semana del 19 al 26.

       Lo que se rompería con aritmética de milisegundos: esa semana dura 169
       horas, no 168, así que sumarle `7 * 86 400 000` desde el lunes a
       medianoche cae en el domingo a las 23:00 — una hora ANTES del final que
       la vista pide, y por tanto ya no es superset. `setDate()` opera sobre los
       campos de calendario y no se entera del salto. */
    process.env.TZ = 'Europe/Madrid'
    const semana = rango(new Date(2026, 9, 19), new Date(2026, 9, 26))
    const pedido = rangoQuePedir(semana)
    expect(contiene(pedido, semana)).toBe(true)
    expect(comoFechas(pedido)).toEqual(['Mon Oct 19 2026', 'Mon Oct 26 2026'])
  })

  it('una semana que cruza el fin de MES sigue conteniéndola', () => {
    // Del 31 de agosto al 7 de septiembre de 2026.
    const semana = rango(new Date(2026, 7, 31), new Date(2026, 8, 7))
    expect(contiene(rangoQuePedir(semana), semana)).toBe(true)
    expect(comoFechas(rangoQuePedir(semana))).toEqual(['Mon Aug 31 2026', 'Mon Sep 07 2026'])
  })

  it('un día que cruza el fin de AÑO se encaja en su semana, a caballo entre los dos', () => {
    // Jueves 31 de diciembre de 2026 → su semana va del 28 de diciembre al 4
    // de enero de 2027. Aquí es donde un `getMonth() + 1` ingenuo se saldría.
    const dia = rango(new Date(2026, 11, 31), new Date(2027, 0, 1))
    const pedido = rangoQuePedir(dia)
    expect(contiene(pedido, dia)).toBe(true)
    expect(comoFechas(pedido)).toEqual(['Mon Dec 28 2026', 'Mon Jan 04 2027'])
  })
})
