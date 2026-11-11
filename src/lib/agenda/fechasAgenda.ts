/**
 * src/lib/agenda/fechasAgenda.ts
 *
 * Aritmética de fechas/horas de la agenda: partir y componer ISO, el
 * convenio de fin exclusivo de los eventos de todo el día, los rangos que
 * publica una vista de FullCalendar, y el candado por tiempo de un gesto en
 * curso. Movido tal cual desde `AgendaCliente.tsx` (A2.1, movimiento puro),
 * con sus comentarios; sólo cambiaron los `import`/`export` que hacían
 * falta.
 */

import { addWeeks, differenceInCalendarDays, startOfWeek } from 'date-fns'
import type { ViewApi } from '@fullcalendar/core'
import { TZ_CLINICA, desplazarFecha, fechaSoloSegura, renderEnTZ } from '@/lib/dates'
import type { RangoVisible } from '@/lib/agenda/ventanaRejilla'
import type { Appointment, DatosGuardado } from './tiposAgenda'

/**
 * Los dos rangos que publica la vista, porque el cálculo necesita los dos.
 *
 * ⚠️  NO SON INTERCAMBIABLES Y NO SE PUEDEN UNIFICAR. Ver `aplicarVentana`.
 *
 *  · `activo` es `activeRange`: lo que la vista PINTA. Ya viene recortado por
 *    `trimHiddenDays`, así que con columnas ocultas le faltan días.
 *  · `completo` es lo que la vista representa SIN recortar por columnas
 *    plegadas. En Semana y Día es `currentRange` tal cual sale de
 *    `buildCurrentRangeInfo` (`@fullcalendar/core/internal-common.js:2814`,
 *    versión 6.1.20); en MES es `renderRange` —el mes encajado a seis semanas—,
 *    que es lo que esa vista pinta de verdad. Lo calcula `rangosDeLaVista`, y el
 *    porqué de la excepción está en `semanasPintadasDelMes`.
 *  · `esMes` dice si la vista es `dayGridMonth`. Lo lee `aplicarVentana` para
 *    apagar la MITAD DEL ALTO del modo compacto: en Mes no hay `slotMinTime` que
 *    encoger, así que compactar ahí sólo pliega columnas.
 *
 * ⚠️  `completo` NO SON SIEMPRE SIETE DÍAS, y creerlo ya costó un fallo. Depende
 * de la vista:
 *
 *    · `timeGridWeek` → la semana entera, de lunes a lunes: siete días.
 *    · `timeGridDay`  → UN solo día.
 *    · `dayGridMonth` → SEIS SEMANAS enteras, de lunes a lunes: 42 días. Aquí
 *      es donde `completo` dejó de ser `currentRange` (que daba el mes natural,
 *      de 28 a 31 días, sin el relleno de semanas que la vista sí pinta).
 *
 * ⚠️  DE ESE HECHO DEPENDE UNA GUARDA DE `diasOcultables`, Y NO SE PUEDE
 * RETIRAR. Ahí se calcula el conjunto `cubiertos` —los días de la semana que
 * este rango abarca— y se pliega sólo lo que cae dentro, con el cierre
 * `ocultables.length >= cubiertos.size`. Las dos cosas existen justamente
 * porque `completo` puede traer menos de siete días: en la vista de Día trae
 * uno, y sin la guarda se plegaban los otros seis con datos que nadie pidió, o
 * se plegaba el único que hay y FullCalendar saltaba de día
 * (`internal-common.js:2955-2959`). Leído como «aquí siempre hay siete», ese
 * código parece muerto y se borra; hizo falta una auditoría entera para
 * encontrar lo que pasa cuando no está.
 *
 * Los dos usan las llaves de `RangoVisible` (`activeStart`/`activeEnd`) por no
 * duplicar el tipo; en `completo` esos nombres mienten un poco, y por eso este
 * comentario.
 */
export type RangosDeVista = { activo: RangoVisible; completo: RangoVisible; esMes: boolean }

/* ⚠️ EL PRIMER DÍA DE LA SEMANA, Y TIENE QUE SER EL DE `esLocale`. El locale
   español declara `week.dow: 1` (`@fullcalendar/core/locales/es.js:4`), o sea
   lunes, y de ahí sale la primera columna de la rejilla del mes. Si algún día se
   cambia el locale del calendario, este número cambia con él o el rango de abajo
   deja de coincidir con lo que se pinta. */
const PRIMER_DIA_SEMANA = 1

/* ⚠️ SEIS, PORQUE `fixedWeekCount` NO SE TOCA. Su default es `true`
   (`@fullcalendar/daygrid/internal.js:949-958`), así que `dayGridMonth` rellena
   SIEMPRE hasta seis filas, mida lo que mida el mes. Si alguien pone
   `fixedWeekCount: false` en `VISTAS_FC`, este número deja de ser fijo y hay que
   derivarlo del rango. */
const SEMANAS_PINTADAS_DEL_MES = 6

/**
 * El rango que la vista Mes PINTA de verdad: el mes encajado a semanas
 * completas y rellenado hasta seis filas, o sea `renderRange`.
 *
 * ⚠️ ESTO ES EL «REQUISITO PREVIO» QUE PEDÍA `diasOcultables` POR ESCRITO, y no
 * un refinamiento. Aquella función decide qué columnas se pliegan a partir del
 * rango que se le pasa, y hasta ahora recibía `currentRange` — el mes natural,
 * del 1 al último. Pero el mes natural NO es lo que se pinta: faltan hasta ~12
 * días de relleno de las semanas de los extremos, así que una cita en uno de
 * esos días no protegía su columna y el mes podía plegar un día CON trabajo
 * dentro. Mientras «Compactar» estuvo apagado en Mes eso no mordía; al
 * encenderlo pasa a ser un fallo real, y por eso esto va PRIMERO.
 *
 * ⚠️ Y NO SIRVE `activeRange` PARA ESTO, aunque sea exactamente el rango
 * pintado. `trimHiddenDays` lo recorta por los dos extremos, así que con una
 * columna ya plegada el rango se estrecha, sus eventos caen fuera del filtro, la
 * columna sigue vacía y sigue plegada: un punto fijo del que sólo se sale
 * recargando. Esto se calcula desde `currentRange`, que nadie recorta, así que
 * el conjunto no depende de qué se plegó y el ciclo converge.
 *
 * Aritmética de CALENDARIO —`startOfWeek` y `addWeeks` de date-fns—, no de
 * milisegundos: en el cambio de horario de verano un día no dura 24 horas.
 */
export function semanasPintadasDelMes(inicio: Date): RangoVisible {
  const desde = startOfWeek(inicio, { weekStartsOn: PRIMER_DIA_SEMANA })
  return { activeStart: desde, activeEnd: addWeeks(desde, SEMANAS_PINTADAS_DEL_MES) }
}

/**
 * Los dos rangos de una vista, ya resueltos. Lo llaman los DOS sitios que antes
 * armaban el objeto a mano —`datesSet` y `rangoDeVista`—, para que la corrección
 * de Mes no pueda aplicarse en uno y olvidarse en el otro.
 */
export function rangosDeLaVista(vista: ViewApi): RangosDeVista {
  const esMes = vista.type === 'dayGridMonth'
  return {
    activo:   { activeStart: vista.activeStart, activeEnd: vista.activeEnd },
    completo: esMes
      ? semanasPintadasDelMes(vista.currentStart)
      : { activeStart: vista.currentStart, activeEnd: vista.currentEnd },
    esMes,
  }
}

/* Lo que como mucho puede durar un arrastre antes de que el candado de
   `refetch()` se dé por atascado y se suelte solo. NO es la duración de un
   gesto normal —esos son dos o tres segundos—, es la VÁLVULA DE SEGURIDAD:
   el techo del daño si `eventDragStop` no llega nunca. Ver `hayGestoEnCurso`. */
export const TOPE_GESTO_MS = 30_000

/* La válvula de seguridad del candado de `refetch()`, y NO es paranoia: hay un
   camino real por el que `eventDragStop` puede no llegar nunca.

   `stopDrag` —el único que dispara `dragend`, y con él `eventDragStop`— sale de
   `mirror.stop()` (`@fullcalendar/interaction/index.js:818-826`). Cuando el
   fantasma flotante está visible y hay que devolverlo a su sitio, ese `stop()`
   pasa por `doRevertAnimation` y espera a `whenTransitionDone`
   (`@fullcalendar/core/internal-common.js:301-311`), que SÓLO escucha
   `transitionend` y NO tiene temporizador de respaldo. Si esa transición no
   termina —la pestaña se va a segundo plano a mitad de la vuelta, el elemento
   se retira— el callback no corre y el gesto no se cierra jamás. La agenda va
   con `dragRevertDuration={200}`, así que ese camino está vivo.

   De ahí que la marca sea un INSTANTE y no un booleano: pasado el tope se
   suelta sola, y se suelta AQUÍ, en la primera consulta que la encuentre
   caducada. Un booleano dejaría la agenda sin traer datos para siempre y sin
   que nadie se entere, que es justo lo que un candado no debe hacer.

   ⚠️ VIVE FUERA DEL COMPONENTE A PROPÓSITO. Dentro, `refetch` pasaba a cerrar
   sobre una función del cuerpo y los tres efectos que llaman a `refetch` con
   deps `[]` empezaban a dar `react-hooks/exhaustive-deps`. Esos `[]` están
   razonados en cada efecto —sólo leen refs— y no se tocan; el que se mueve es
   este ayudante. El ref entra por parámetro. */
export function hayGestoEnCurso(marca: { current: number }): boolean {
  if (!marca.current) return false
  if (Date.now() - marca.current < TOPE_GESTO_MS) return true
  marca.current = 0
  return false
}

export function calcDuration(startIso: string, endIso: string) {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
}

export function addMinutes(iso: string, mins: number) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + mins); return d.toISOString()
}

/* ─── F3-6e: helper para badge de timezone ───
   `regionDeTimezone` estaba aquí y vive ahora en `@/lib/consultorios/zonas-mexico`:
   el ancla de hora local de la descripción del evento de Google la necesita
   desde el servidor, y este archivo es `'use client'`. */
export function horaEnTZ(startTimeISO: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(startTimeISO))
  } catch {
    return ''
  }
}

/* Las dos mitades que piden los dos controles del modal, en hora LOCAL.
   Sustituyen al par `toDatetimeLocal`/`fromDatetimeLocal` de cuando el campo era
   un único `datetime-local`. Ese control no sabe sostener una fecha sin hora
   —asignarle «2026-08-19» lo deja en cadena vacía y se lleva la fecha por
   delante, comprobado en navegador—, y eso es justo lo que la vista Mes
   necesita, así que el campo se partió en `<input type="date">` +
   `<input type="time">` y estos dos ayudantes hablan su idioma. */
export function partirFechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora:  `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/* La vuelta. `new Date('2026-08-19T10:00')` —sin zona— lo interpreta el motor en
   la zona LOCAL, que es lo que queremos: el médico teclea su hora de pared. */
export function componerIso(fecha: string, hora: string) { return new Date(`${fecha}T${hora}`).toISOString() }

/** Los días de calendario entre dos fechas-solo. Ancladas a mediodía, así que
 *  un cambio de horario de verano no suma ni resta un día por error. */
export function diasEntreFechas(desde: string, hasta: string): number {
  return differenceInCalendarDays(fechaSoloSegura(hasta), fechaSoloSegura(desde))
}

/**
 * EL DÍA DE CALENDARIO DE UN INSTANTE, EN LA ZONA DEL CONSULTORIO DE SU FILA.
 *
 * ⚠️ NO ES `partirFechaHora`, Y ÉSA ES TODA LA GRACIA. Aquella lee en el huso
 * del DISPOSITIVO, que es la regla del resto de la agenda (`dates.ts`) y aquí
 * sería el bug: una fila de todo el día guarda medianoche en la zona de SU
 * consultorio, y leerla desde otro huso la corre un día entero. Un evento de
 * Cancún visto desde Tijuana empezaría el día anterior.
 *
 * `TZ_CLINICA` de respaldo por las filas anteriores a `consultorio_timezone`,
 * que se añadió sin rellenar las existentes. Una fila de todo el día NO puede
 * caer ahí —el CHECK de la base exige el huso— pero el respaldo va igual, que
 * es lo que permite llamar a esto sin preguntar antes.
 *
 * DOS CONSUMIDORES, Y NO HACEN LO MISMO CON EL RESULTADO: la FUENTE del
 * calendario se queda las dos fechas tal cual (su fin es exclusivo, como el de
 * la base), y `fechasDeTodoElDia` le resta un día al fin para enseñar el último
 * día INCLUIDO. Por eso lo común es esta lectura y no la función entera.
 */
export function diaEnZonaDelConsultorio(instante: string, timezone: string | null | undefined): string {
  return renderEnTZ(instante, 'yyyy-MM-dd', timezone ?? TZ_CLINICA)
}

/* ── EL CONVENIO DE FIN EXCLUSIVO, SUS DOS DIRECCIONES, Y NADA MÁS ──────────
   Los ÚNICOS dos sitios del cliente donde se corre un día, juntos a propósito:
   son la misma regla leída al derecho y al revés, y separarlos es como se
   consigue que una de las dos se quede desfasada.

   La base, FullCalendar y Google usan las TRES el mismo convenio —el fin es
   exclusivo—, así que casi todo el código pasa las fechas derechas y no llama a
   ninguna de estas dos. Quien sí habla de «último día incluido» es la CAPA DE
   ARRIBA: el modal, porque es lo que un humano entiende por «hasta el 21», y el
   SERVIDOR, que recibe ese mismo formato en `all_day_hasta`.

   Los cuatro llamadores, para que el censo no se quede corto otra vez:
     · `ultimoDiaIncluido` ← `fechasDeTodoElDia` (leer una fila para el modal),
       la rama `allDay` de `handleSelect` (el fin de un arrastre sobre la banda)
       y `fechasDelGestoDeTodoElDia` (el fin de un evento movido o estirado).
     · `finExclusivoDeUltimoDia` ← `puntasParaLaRejilla`, y sólo en el alta
       optimista, que es el único sitio donde el cliente pinta desde lo que se
       escribió en el modal y no desde la fila guardada.
   Los tres primeros convierten HACIA el formato humano y el cuarto DESDE él, que
   es exactamente el reparto que estas dos funciones existen para sostener.

   ⚠️ SI TE VES ESCRIBIENDO UN `desplazarFecha(..., { dias: ±1 })` EN OTRO SITIO
   DE ESTE ARCHIVO, PARA. O estás convirtiendo algo que ya venía convertido, o
   la conversión que necesitas es una de estas dos. El servidor tiene su propio
   `+1` al guardar (uno por ruta) y no cuenta aquí. */
export function ultimoDiaIncluido(finExclusivo: string): string {
  return desplazarFecha(finExclusivo, { dias: -1 })
}

export function finExclusivoDeUltimoDia(ultimoDia: string): string {
  return desplazarFecha(ultimoDia, { dias: 1 })
}

/**
 * Las dos fechas que el modal enseña para un evento de TODO EL DÍA.
 *
 * El `-1` es la conversión de fin exclusivo a último día incluido, y vive en
 * `ultimoDiaIncluido` — ver el aviso de ahí arriba.
 */
export function fechasDeTodoElDia(apt: Appointment): { fecha: string; fechaFin: string } {
  const tz = apt.consultorio_timezone
  return {
    fecha:    diaEnZonaDelConsultorio(apt.start_time, tz),
    fechaFin: ultimoDiaIncluido(diaEnZonaDelConsultorio(apt.end_time, tz)),
  }
}

/** Los minutos entre las dos puntas ESCRITAS, o `null` si falta alguna de las
 *  cuatro mitades. Es lo que decide qué chip de duración sale marcado. */
export function duracionEscrita(fecha: string, hora: string, fechaFin: string, horaFin: string): number | null {
  if (!fecha || !hora || !fechaFin || !horaFin) return null
  return calcDuration(componerIso(fecha, hora), componerIso(fechaFin, horaFin))
}

/**
 * LAS DOS PUNTAS DE UNA FILA TAL COMO LAS QUIERE LA REJILLA, y si es de todo
 * el día. Punto único de las DOS construcciones de `EventInput` —la fuente y
 * `buildEventInput`—, que antes decían cada una lo suyo.
 *
 * ⚠️ CON `allDay` NO SE PUEDEN ENTREGAR INSTANTES, Y AHÍ ESTABA EL BUG. Poner
 * `allDay: true` con un ISO hace que FullCalendar TRUNQUE al día en el huso del
 * CALENDARIO (`@fullcalendar/core/internal-common.js:3261-3263`,
 * `if (allDay && startMarker) startMarker = startOfDay(startMarker)`), y ese
 * huso es el del navegador: no hay opción `timeZone` en el `<FullCalendar>` de
 * abajo. Un evento de Hermosillo visto desde Cancún se pintaría el día
 * anterior. Por eso en todo el día viajan CADENAS DE SÓLO FECHA, que no tienen
 * huso que malinterpretar, leídas con `diaEnZonaDelConsultorio`.
 *
 * ⚠️ Y LOS DOS EXTREMOS VAN DERECHOS, SIN `-1`. El `end` de FullCalendar es
 * exclusivo, igual que el de la base. `fechasDeTodoElDia` NO sirve aquí: aquélla
 * devuelve el último día INCLUIDO —lo que enseña el modal— y usarla pintaría
 * todos los eventos un día cortos, y los de una sola jornada no los pintaría.
 *
 * ── LAS TRES FORMAS EN QUE LLEGA UNA FILA DE TODO EL DÍA ────────────────────
 * 1. Con sus dos instantes (`start_time`/`end_time`): es la fila YA GUARDADA,
 *    venga de la fuente, de Realtime o de la respuesta del POST. Se leen como
 *    días en la zona de su consultorio. Es el camino normal.
 * 2. Con `all_day_desde`/`all_day_hasta` y sin instantes: es el ALTA OPTIMISTA,
 *    donde todavía no hay fila —sólo lo que se escribió en el modal— y el
 *    servidor aún no ha compuesto nada. Aquí `all_day_hasta` es el último día
 *    incluido, así que hay que pasar al fin exclusivo.
 * 3. Ninguna de las dos: no debería ocurrir, y se sale con lo que haya en vez
 *    de inventar fechas. FullCalendar descartará el evento, que es lo honesto.
 *
 * El orden importa: los instantes mandan sobre las fechas del formulario,
 * porque el objeto de la respuesta del POST trae LAS DOS COSAS
 * (`{ ...data, ...json.appointment }`) y la buena es la de la fila.
 */
export function puntasParaLaRejilla(data: DatosGuardado): { allDay: boolean; start?: string; end?: string } {
  if (data.all_day !== true) {
    return { allDay: false, start: data.start_time, end: data.end_time }
  }
  if (data.start_time && data.end_time) {
    const tz = data.consultorio_timezone
    return {
      allDay: true,
      start:  diaEnZonaDelConsultorio(data.start_time, tz),
      end:    diaEnZonaDelConsultorio(data.end_time, tz),
    }
  }
  if (data.all_day_desde && data.all_day_hasta) {
    return {
      allDay: true,
      start:  data.all_day_desde,
      end:    finExclusivoDeUltimoDia(data.all_day_hasta),
    }
  }
  return { allDay: true, start: data.start_time, end: data.end_time }
}

/** «60 min», o null si el evento no da un tramo con el que contar. */
export function duracionDeLaFila(inicio: Date | null, fin: Date | null): string | null {
  if (!inicio || !fin) return null
  const min = Math.round((fin.getTime() - inicio.getTime()) / 60000)
  return min > 0 ? `${min} min` : null
}

