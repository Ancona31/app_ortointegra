/**
 * src/lib/agenda/ventanaRejilla.ts
 *
 * Calcula la ventana vertical de la rejilla de la agenda: el par
 * `slotMinTime` / `slotMaxTime` que recibe FullCalendar.
 *
 * ─────────────────────────────────────────────────────────────────────
 * QUÉ ARREGLA
 * ─────────────────────────────────────────────────────────────────────
 *
 * La rejilla estaba clavada en 07:00–21:00. Una cita a las 23:00 —tecleada
 * mal, o llegada de un dispositivo mal configurado— EXISTE en la base, se
 * puede abrir desde el expediente y se cuenta en las estadísticas, pero NO
 * SE PINTA: cae fuera de la ventana y desde la agenda no hay forma de verla
 * ni de arrastrarla a su sitio.
 *
 * La ventana pasa a ser la unión de tres cosas:
 *
 *     horario de la clínica  ∪  eventos visibles  ∪  suelo fijo 07:00–21:00
 *
 * ⚠️  TODAS LAS CITAS A `@fullcalendar/core` DE ESTA CABECERA SON DE LA
 * VERSIÓN 6.1.20, la instalada al escribirlas. Los números de línea se van a
 * desplazar en la primera actualización del paquete: si no cuadran, comprueba
 * la versión ANTES de concluir que el razonamiento caducó — lo más probable es
 * que sólo se haya movido el archivo.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️  EL MÁXIMO NUNCA PASA DE 24:00:00, Y ESO ES LO QUE CIERRA EL BUCLE
 * ─────────────────────────────────────────────────────────────────────
 *
 * FullCalendar reajusta el RANGO ACTIVO —y por tanto vuelve a pedir eventos—
 * sólo en dos casos, y los dos están fuera de lo que emite este módulo. En
 * `@fullcalendar/core/internal-common.js:2906` y `:2911`, bajo
 * `usesMinMaxTime` (que `timeGrid` pone en `true`), las guardas son
 * literalmente:
 *
 *     if (asRoughDays(slotMinTime) < 0)  → estira activeRange.start
 *     if (asRoughDays(slotMaxTime) > 1)  → estira activeRange.end
 *
 * Mientras la salida se quede dentro de [00:00:00, 24:00:00], cambiar la
 * ventana NO mueve `activeStart`/`activeEnd` y NO provoca ninguna petición
 * de red: el `resetOptions` del wrapper de React despacha una acción
 * `'NOTHING'`, y para esa acción tanto `reduceEventSources`
 * (`@fullcalendar/core/index.js:541`) como `reduceEventStore`
 * (`internal-common.js:3553`) devuelven lo que ya tenían, sin traer nada.
 *
 * Por eso los recortes de `pisoDeHora` y `techoDeHora` NO son cosmética:
 * son LA GARANTÍA que cierra el bucle. `'24:00:00'` vale (es
 * `asRoughDays === 1`, y la guarda pide `> 1`); `'26:00:00'` estiraría el
 * rango activo, traería eventos nuevos, esos eventos volverían a entrar en
 * este cálculo y ahí sí habría realimentación. Si algún día hace falta pasar
 * de 24:00, hay que resolver ese bucle ANTES, no quitar el recorte.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️  CAMBIAR LA VENTANA SÍ REEMITE `datesSet`, CON LAS MISMAS FECHAS
 * ─────────────────────────────────────────────────────────────────────
 *
 * Que el rango activo no se mueva NO quiere decir que `datesSet` se calle.
 * Se reemite igual, con `activeStart`/`activeEnd` idénticos, porque lo que
 * FullCalendar compara no son las fechas sino la IDENTIDAD del `dateProfile`:
 *
 *   1. `slotMinTime` se refina con `createDuration` (`internal-common.js:1322`),
 *      así que una cadena distinta da un objeto `Duration` nuevo;
 *   2. `buildDateProfileGenerator` es un `memoizeObjArg` que recibe ese
 *      `Duration` (`core/index.js:1550`) → generador nuevo;
 *   3. `core/index.js:1384` ve el generador distinto y reconstruye
 *      `dateProfile`;
 *   4. `dateProfile` es un `propSetHandler` (`core/index.js:1130`), y el
 *      handler dispara `datesSet` (`core/index.js:1103`).
 *
 * Consecuencia para quien cablee esto: el consumidor recibe un `datesSet`
 * EXTRA por cada cambio de ventana. Lo que mata esa segunda vuelta es
 * comparar LA SALIDA de este módulo —las dos cadenas— antes de escribir
 * estado. Comparar el rango, o el array de eventos, no sirve: llegan objetos
 * nuevos con el mismo contenido. Ver el cableado en
 * `src/app/(app)/agenda/page.tsx`.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️  DE DÓNDE SALEN LAS HORAS: DEL RELOJ DE PARED DEL NAVEGADOR
 * ─────────────────────────────────────────────────────────────────────
 *
 * `slotMinTime` es una DURACIÓN, y FullCalendar la interpreta en la zona en
 * la que hace el LAYOUT. La agenda no le pasa `timeZone`, así que usa el
 * valor por defecto `'local'` (`internal-common.js:1517`): el huso del
 * dispositivo (ver la cabecera de `@/lib/dates`). Por eso aquí se leen las
 * horas con `getHours()`/`getMinutes()` de los `Date` que da FullCalendar,
 * que son ese mismo reloj.
 *
 * `EventApi.start` (`internal-common.js:4113`) y el `view.activeStart` de
 * `datesSet` (`:4573`) pasan los dos por `dateEnv.toDate()` (`:2174`), que
 * con `'local'` hace `arrayToLocalDate(dateToUtcArray(m))`: devuelve un
 * `Date` REAL cuya hora de pared es exactamente la de la rejilla. Las fechas
 * MARCADAS —aquellas cuyos campos UTC son la hora pintada— viven en
 * `_instance.range`, en el `eventStore` y en `dateProfile.activeRange`, y no
 * salen a la API pública. Comprobado: sobre un marker de las 23:00 y con
 * `timeZone: 'local'`, `getHours()` da 23 y `getUTCHours()` da 5.
 *
 * NUNCA derives estas horas de la cadena ISO cruda ni del huso del
 * consultorio: producirías una ventana DESPLAZADA, con eventos que siguen
 * sin verse y con la creencia de que ya está arreglado. Y si alguien llega a
 * pasarle `timeZone` a FullCalendar, este módulo deja de ser correcto y hay
 * que revisarlo entero.
 *
 * ⚠️  Y EL ARREGLO NO SERÍA CAMBIAR A `getUTCHours()`. Depende de qué
 * `timeZone` se pase, porque `toDate` tiene tres ramas:
 *
 *   · `'UTC'`, o un huso NOMBRADO sin plugin de husos instalado (hoy no hay
 *     ninguno en `package.json`): `toDate` devuelve la marca tal cual, y ahí
 *     sí `getUTCHours()` es el correcto;
 *   · un huso NOMBRADO CON plugin: `toDate` resta el offset y devuelve el
 *     instante verdadero, así que NINGUNO de los dos accesores da la hora de
 *     la rejilla. Haría falta pasar por `dateEnv` (o por `formatDate` del
 *     calendario) para recuperarla.
 *
 * O sea: si alguien pasa `timeZone`, hay que mirar CUÁL antes de tocar nada
 * aquí. Un `getUTCHours()` a ciegas cambia un bug por otro.
 */

import type { Horario } from '@/lib/configApp'

/**
 * Suelo de la ventana: la rejilla nunca enseña MENOS que 07:00–21:00.
 *
 * ⚠️  ESTO NO ES UNA POLÍTICA DE PRODUCTO. Es compatibilidad temporal.
 *
 * 07:00–21:00 es exactamente lo que la rejilla tenía clavado antes de este
 * arreglo. Sin este suelo, una clínica que atiende de 16:00 a 20:00 pasaría
 * de catorce horas de rejilla a cuatro el primer día y para todos: un cambio
 * visual grande, y una decisión estética —cuánto día se enseña— que le toca
 * al rediseño de la agenda, no a un commit de corrección.
 *
 * El rediseño es dueño de este número: puede bajarlo, subirlo, hacerlo
 * configurable o borrarlo. Hasta entonces se queda.
 */
export const VENTANA_MINIMA_PRE_REDISENO = { inicioHora: 7, finHora: 21 } as const

const MINUTOS_POR_HORA = 60
const MINUTOS_DEL_DIA = 24 * MINUTOS_POR_HORA

/**
 * Un evento tal como lo necesita este cálculo, y nada más.
 *
 * La forma coincide a propósito con la de `EventApi` de FullCalendar
 * (`start`/`end` como `Date`, `allDay`, `display`), así que sirve tanto si
 * los eventos vienen del estado de React como si se leen del calendario.
 */
export interface EventoParaVentana {
  start: Date | null
  end: Date | null
  allDay: boolean
  display?: string
}

/** El rango de fechas que la vista tiene pintado (`datesSet`). */
export interface RangoVisible {
  activeStart: Date
  activeEnd: Date
}

/** Lo que se le pasa a FullCalendar, ya en formato `HH:MM:SS`. */
export interface VentanaRejilla {
  slotMinTime: string
  slotMaxTime: string
}

/** Minutos desde medianoche en el reloj de pared del navegador. */
function minutosDeReloj(d: Date): number {
  return d.getHours() * MINUTOS_POR_HORA + d.getMinutes()
}

/** Instante de la medianoche local del día de `d`. */
function medianocheLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Días de CALENDARIO entre dos instantes (0 = mismo día local). */
function diasDeCalendarioEntre(a: Date, b: Date): number {
  return Math.round((medianocheLocal(b) - medianocheLocal(a)) / 86_400_000)
}

/** `'09:30'` → 570. Devuelve `null` si la cadena no es una hora. */
function hhmmAMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const horas = Number(m[1])
  const minutos = Number(m[2])
  if (horas > 24 || minutos > 59) return null
  return horas * MINUTOS_POR_HORA + minutos
}

/** Minutos desde medianoche → `'HH:MM:SS'`. Admite 1440 → `'24:00:00'`. */
function aHHMMSS(minutos: number): string {
  const h = Math.floor(minutos / MINUTOS_POR_HORA)
  const m = minutos % MINUTOS_POR_HORA
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/** Un tramo vertical de la rejilla, en minutos desde medianoche. */
interface Tramo { desde: number; hasta: number }

/**
 * El tramo del día que ocupa un evento.
 *
 * ⚠️  LOS QUE CRUZAN MEDIANOCHE VAN APARTE. Un evento de lunes 18:00 a
 * miércoles 10:00 no es `allDay`; FullCalendar lo trocea por día, pero un
 * mín/máx ingenuo sobre sus horas de reloj daría mín 18:00 y máx 10:00 — una
 * ventana invertida. Aquí ese caso exige el día entero, que es lo único que
 * garantiza que se vean sus dos puntas.
 *
 * Terminar EXACTAMENTE a medianoche no cuenta como cruzar: un evento de
 * 22:00 a 00:00 pide hasta las 24:00, no el día completo.
 *
 * ⚠️  UN EVENTO SIN FIN NO ES PUNTUAL: OCUPA UNA HORA.
 *
 * `EventApi.end` devuelve `null` cuando el `EventDef` no tiene `hasEnd`, pero
 * FullCalendar SÍ le pinta una duración: le aplica `defaultTimedEventDuration`,
 * que por defecto vale `'01:00:00'`
 * (`@fullcalendar/core/internal-common.js:1491`, y el `dateEnv.add` de `:3762`).
 * O sea que el módulo no puede enterarse por el dato: hay que replicar la
 * regla.
 *
 * Tratarlo como puntual reproduciría el bug original DENTRO del arreglo: un
 * evento sin fin a las 23:00 daría `slotMaxTime = '23:00:00'`, su intersección
 * con la columna sería de longitud cero, y seguiría invisible — con un síntoma
 * indistinguible del que este módulo existe para cerrar.
 *
 * El fin efectivo se calcula como una FECHA y baja por la misma ruta que los
 * demás, a propósito. Sumar 60 minutos al tramo sería incorrecto: un evento sin
 * fin a las 23:30 se pinta hasta las 00:30 del día siguiente, y ese trozo
 * necesita `slotMinTime = 00:00`. Sólo la rama del cruce lo resuelve.
 *
 * Hoy ningún camino produce uno: `appointments.end_time` es NOT NULL y Google
 * siempre devuelve fin. Esto es la red por si mañana lo hay.
 */
export function tramoDeEvento(inicio: Date, fin: Date | null): Tramo {
  const desde = minutosDeReloj(inicio)

  // Sin fin, el efectivo es el que FullCalendar va a pintar: inicio + 1 hora.
  const finEfectivo = fin ?? new Date(inicio.getTime() + MINUTOS_POR_HORA * 60_000)
  // Un fin ANTERIOR al inicio es dato corrupto, no un cruce de medianoche: se
  // ignora el fin y queda puntual, en vez de abrir el día entero. (Este camino
  // sólo lo alcanza un `fin` real; el efectivo siempre es posterior.)
  if (finEfectivo.getTime() <= inicio.getTime()) return { desde, hasta: desde }

  const dias = diasDeCalendarioEntre(inicio, finEfectivo)
  if (dias === 0) return { desde, hasta: minutosDeReloj(finEfectivo) }
  if (dias === 1 && minutosDeReloj(finEfectivo) === 0) return { desde, hasta: MINUTOS_DEL_DIA }
  return { desde: 0, hasta: MINUTOS_DEL_DIA }
}

/**
 * El tramo que hace falta para que se vean TODOS los eventos del rango
 * visible. `null` si no hay ninguno que cuente.
 *
 * Quedan fuera:
 *  · los de todo el día (`allDay === true`), que se pintan en su propia
 *    banda y no en la rejilla horaria. El filtro es por esa bandera y NO por
 *    «empieza a medianoche»: un evento CON HORA a las 00:00 existe, se pinta
 *    en la rejilla, y debe abrir la ventana hasta las 00:00 — que es
 *    justamente la tesis de este arreglo.
 *  · los de fondo (`display: 'background'` / `'inverse-background'`), que no
 *    son citas de nadie.
 *  · los que no solapan el rango visible.
 */
export function ventanaDeEventos(
  eventos: readonly EventoParaVentana[],
  rango: RangoVisible,
): Tramo | null {
  let desde = Number.POSITIVE_INFINITY
  let hasta = Number.NEGATIVE_INFINITY

  for (const ev of eventos) {
    if (ev.allDay) continue
    if (ev.display === 'background' || ev.display === 'inverse-background') continue
    if (!ev.start) continue

    // Solapamiento SEMIABIERTO: con `<=` entrarían los eventos que empiezan
    // justo en el corte del día siguiente, que esta vista no pinta.
    const finSolape = ev.end ?? ev.start
    if (!(ev.start < rango.activeEnd && finSolape > rango.activeStart)) continue

    const tramo = tramoDeEvento(ev.start, ev.end)
    if (tramo.desde < desde) desde = tramo.desde
    if (tramo.hasta > hasta) hasta = tramo.hasta
  }

  return desde === Number.POSITIVE_INFINITY ? null : { desde, hasta }
}

/**
 * El tramo que abarca el horario de consulta.
 *
 * Toma TODOS los días activos, no sólo los que la vista tiene delante: si no,
 * la rejilla cambiaría de alto al pasar de un miércoles a un sábado con
 * horario distinto, y ese salto se lee como un fallo.
 */
export function ventanaDeHorario(horario: Horario): Tramo | null {
  let desde = Number.POSITIVE_INFINITY
  let hasta = Number.NEGATIVE_INFINITY

  for (const dia of Object.values(horario)) {
    if (!dia?.activo) continue
    const inicio = hhmmAMinutos(dia.inicio)
    const fin = hhmmAMinutos(dia.fin)
    if (inicio === null || fin === null) continue

    /* ⚠️  HORARIO NOCTURNO (22:00–02:00): EL DÍA ENTERO, NO EL DESCARTE.
       Un fin que no es posterior al inicio no cabe en una ventana de un solo
       día: no hay par mín/máx que represente «de las 22:00 a las 02:00». Sin
       esta rama, el `desde: 1320 / hasta: 120` que saldría se lo traga la unión
       con el suelo y la clínica ve 07:00–21:00 — su horario no se honra en
       NINGÚN borde y no queda rastro de que se perdió. Pasarse de ancho es
       peor que quedarse corto sólo si nadie se entera; aquí es al revés.

       Y es alcanzable, no una hipótesis: el modal de horario usa dos
       `<input type="time">` sin comprobar el orden, y `PUT /api/me/horario`
       guarda el JSON tal cual sin validarlo. Hay al menos una clínica en
       producción con un día configurado desde las 04:06.

       Cubre también el caso degenerado `fin === inicio` (un 09:00–09:00 de
       longitud cero), por el mismo motivo: tampoco es representable. */
    if (fin <= inicio) { desde = 0; hasta = MINUTOS_DEL_DIA; continue }

    if (inicio < desde) desde = inicio
    if (fin > hasta) hasta = fin
  }

  return desde === Number.POSITIVE_INFINITY ? null : { desde, hasta }
}

/** Baja a la hora en punto, sin salirse del día. */
function pisoDeHora(minutos: number): number {
  const acotado = Math.min(Math.max(minutos, 0), MINUTOS_DEL_DIA)
  return Math.floor(acotado / MINUTOS_POR_HORA) * MINUTOS_POR_HORA
}

/** Sube a la hora en punto, sin salirse del día. Ver el aviso de la cabecera. */
function techoDeHora(minutos: number): number {
  const acotado = Math.min(Math.max(minutos, 0), MINUTOS_DEL_DIA)
  return Math.ceil(acotado / MINUTOS_POR_HORA) * MINUTOS_POR_HORA
}

/**
 * La ventana de la rejilla: horario ∪ eventos visibles ∪ suelo fijo.
 *
 * ⚠️  ALINEADA A LA HORA EN PUNTO, y no por gusto. Un `slotMinTime` de 05:30
 * con slots de 30 min corre TODAS las etiquetas media hora: la rejilla entera
 * se ve distinta, no sólo más alta. Piso para el mínimo, techo para el
 * máximo.
 *
 * `rango` puede llegar `null` en el primer render, antes de que la vista haya
 * dicho qué fechas tiene pintadas; entonces manda el horario con su suelo, que
 * no depende de qué semana se esté mirando.
 */
export function calcularVentanaRejilla(
  eventos: readonly EventoParaVentana[],
  rango: RangoVisible | null,
  horario: Horario,
): VentanaRejilla {
  let desde = VENTANA_MINIMA_PRE_REDISENO.inicioHora * MINUTOS_POR_HORA
  let hasta = VENTANA_MINIMA_PRE_REDISENO.finHora * MINUTOS_POR_HORA

  const porHorario = ventanaDeHorario(horario)
  if (porHorario) {
    desde = Math.min(desde, porHorario.desde)
    hasta = Math.max(hasta, porHorario.hasta)
  }

  const porEventos = rango ? ventanaDeEventos(eventos, rango) : null
  if (porEventos) {
    desde = Math.min(desde, porEventos.desde)
    hasta = Math.max(hasta, porEventos.hasta)
  }

  const min = pisoDeHora(desde)
  /* Al menos una hora de rejilla: `slotMinTime === slotMaxTime` deja la rejilla
     sin altura y sin nada que pintar.

     ⚠️  HOY ESTA LÍNEA ES INALCANZABLE, Y NO POR CASUALIDAD: EL SUELO LA TAPA.
     Con `VENTANA_MINIMA_PRE_REDISENO` vigente, `hasta` nunca baja de 1260 y
     `min` nunca sube de 420, así que `techoDeHora(hasta)` gana siempre y el
     `Math.max` no llega a morder. Por eso NO tiene test: no se le puede
     escribir uno sin retirar antes el suelo.

     Y por eso mismo es imprescindible el día que el rediseño lo retire —es su
     dueño, ver el aviso de `VENTANA_MINIMA_PRE_REDISENO`—: sin suelo, un
     horario degenerado o un único evento puntual pueden dejar `desde === hasta`
     y esta línea pasa de adorno a única defensa.

     QUIEN RETIRE EL SUELO TIENE QUE ESTRENARLE UNA PRUEBA. No la borre por
     verla sin cobertura: la falta de cobertura es consecuencia del suelo, no
     señal de código muerto. */
  const max = Math.max(techoDeHora(hasta), min + MINUTOS_POR_HORA)

  return {
    slotMinTime: aHHMMSS(min),
    slotMaxTime: aHHMMSS(Math.min(max, MINUTOS_DEL_DIA)),
  }
}
