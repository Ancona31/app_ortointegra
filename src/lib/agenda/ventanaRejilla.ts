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

import type { DiaSemana, Horario, HorarioDia } from '@/lib/configApp'

/**
 * La ventana POR DEFECTO de la agenda: 07:00–21:00, exactamente la misma que
 * la rejilla tenía clavada antes del rediseño.
 *
 * ⚠️  EL REDISEÑO NO LA RETIRÓ: LA CONVIRTIÓ EN EL ESTADO APAGADO DE UN BOTÓN.
 *
 * Encoger la rejilla al horario real es lo que hace el botón «Compactar», y lo
 * hace porque alguien lo pide. Hacerlo para todos y sin pedirlo era otra cosa:
 * una clínica que atiende de 16:00 a 20:00 habría pasado de catorce horas de
 * rejilla a cuatro el primer día, un cambio visual grande y sin marcha atrás
 * —no había dónde pulsar para recuperar la rejilla de siempre—. Con el botón
 * la hay, y por eso este suelo sobrevivió al rediseño que iba a borrarlo.
 *
 * Sigue siendo el suelo del modo normal: `calcularVentanaRejilla` la usa de
 * semilla salvo que se le pase `{ compacta: true }`.
 *
 * ⚠️  QUIEN LA RETIRE TIENE QUE RETIRAR TAMBIÉN EL BOTÓN. Sin ella, el estado
 * apagado del botón deja de existir: los dos estados darían la misma rejilla y
 * el control quedaría mintiendo, encendido y apagado sin diferencia visible.
 */
export const VENTANA_AMPLIA = { inicioHora: 7, finHora: 21 } as const

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
 * Las horas de un día del horario, ya leídas. `null` si el día NO ABRE: o no
 * está activo, o sus cadenas no son horas.
 *
 * ⚠️  UN `fin <= inicio` NO SALE POR AQUÍ. Es legible, así que vuelve con sus
 * dos números; qué hacer con él es cosa de cada llamador, y no coinciden:
 * `ventanaDeHorario` lo trata como día entero (ver el aviso de ahí abajo) y
 * `diasOcultables` lo cuenta como cerrado. Este helper existe para que la
 * LECTURA sea una sola —el día que el formato de `HorarioDia` cambie, se toca
 * aquí y ya—, no para unificar dos políticas que son distintas a propósito.
 *
 * ⚠️  ESA DIVERGENCIA TIENE UNA CONSECUENCIA, Y NO ES TEÓRICA. Un horario
 * NOCTURNO (sábado de 22:00 a 02:00) es `fin <= inicio`, así que abre la rejilla
 * de par en par por el eje vertical y a la vez cuenta como CERRADO por el de
 * columnas: una clínica así, en una semana sin citas el sábado, PIERDE LA
 * COLUMNA DEL SÁBADO al compactar. Se acepta a sabiendas —el modo compacto se
 * apaga con el botón y la columna vuelve— y hay al menos una clínica en
 * producción con un día configurado de madrugada. Si algún día molesta, lo que
 * hay que arreglar es que el horario nocturno sea representable, no unificar
 * estas dos lecturas.
 */
function horasDeDia(dia: HorarioDia | undefined): { inicio: number; fin: number } | null {
  if (!dia?.activo) return null
  const inicio = hhmmAMinutos(dia.inicio)
  const fin = hhmmAMinutos(dia.fin)
  if (inicio === null || fin === null) return null
  return { inicio, fin }
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
    const horas = horasDeDia(dia)
    if (!horas) continue
    const { inicio, fin } = horas

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
 *
 * Con `opciones.compacta` la semilla de `VENTANA_AMPLIA` no se aplica y la
 * ventana es sólo la unión de horario y eventos: es lo que enciende el botón
 * «Compactar» de la agenda. Por defecto está APAGADO y el resultado es
 * exactamente el de siempre.
 *
 * ⚠️  LA GARANTÍA NO SE PIERDE AL COMPACTAR. Los eventos siguen entrando en la
 * unión igual que en modo normal: compactar quita el SUELO, no los eventos. Una
 * cita a las 06:00 abre la ventana hasta las 06:00 con el botón encendido y con
 * el botón apagado.
 */
export function calcularVentanaRejilla(
  eventos: readonly EventoParaVentana[],
  rango: RangoVisible | null,
  horario: Horario,
  opciones?: { compacta?: boolean },
): VentanaRejilla {
  const compacta = opciones?.compacta ?? false

  /* Compactando se arranca en ±∞ para que la unión salga limpia: el primer
     mín/máx que muerda impone su valor, sin suelo que lo tape. */
  let desde = compacta ? Number.POSITIVE_INFINITY : VENTANA_AMPLIA.inicioHora * MINUTOS_POR_HORA
  let hasta = compacta ? Number.NEGATIVE_INFINITY : VENTANA_AMPLIA.finHora * MINUTOS_POR_HORA

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

  /* Compactando, una clínica sin días activos y sin eventos no deja NADA que
     medir. Una rejilla de altura cero no es un estado válido —no hay dónde
     pulsar para crear la primera cita—, así que se cae a la ventana de siempre:
     el modo compacto encoge lo que sobra, no borra la agenda. */
  if (desde === Number.POSITIVE_INFINITY) {
    desde = VENTANA_AMPLIA.inicioHora * MINUTOS_POR_HORA
    hasta = VENTANA_AMPLIA.finHora * MINUTOS_POR_HORA
  }

  const min = pisoDeHora(desde)
  /* Al menos una hora de rejilla: `slotMinTime === slotMaxTime` deja la rejilla
     sin altura y sin nada que pintar.

     ⚠️  ESTA LÍNEA YA MUERDE. Antes del modo compacto no podía: con el suelo de
     `VENTANA_AMPLIA` siempre aplicado, `hasta` no bajaba de 1260 ni `min` subía
     de 420, así que `techoDeHora(hasta)` ganaba el `Math.max` siempre y esto era
     un adorno sin test posible.

     Con `{ compacta: true }` no hay suelo, y entonces sí: una clínica sin días
     activos y con un solo evento de longitud cero deja `desde === hasta`, y esta
     línea es lo único que separa a la rejilla de no tener altura. La cubre
     `ventanaRejilla.test.ts`, en «modo compacto» — el caso del evento puntual a
     las 09:00 que da una rejilla de una hora.

     NO LA BORRES. Ahora tiene prueba; antes no la tenía porque el suelo la
     tapaba, no porque fuera código muerto. */
  const max = Math.max(techoDeHora(hasta), min + MINUTOS_POR_HORA)

  return {
    slotMinTime: aHHMMSS(min),
    slotMaxTime: aHHMMSS(Math.min(max, MINUTOS_DEL_DIA)),
  }
}

/** Medianoche local del día de `t`, como instante. */
function inicioDelDia(t: number): Date {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Los días de la semana (`getDay()`) que cubre un rango, acotado a siete.
 *
 * Se avanza con `setDate(+1)` —aritmética de CALENDARIO— y no sumando
 * 86 400 000 ms: en el cambio de horario de verano un día no dura 24 horas y el
 * recorrido se desalinearía.
 */
function diasDelRango(rango: RangoVisible): Set<number> {
  const dias = new Set<number>()
  const hasta = rango.activeEnd.getTime() - 1
  const cursor = inicioDelDia(rango.activeStart.getTime())
  while (cursor.getTime() <= hasta && dias.size < 7) {
    dias.add(cursor.getDay())
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

/**
 * Los días de la semana que un evento TOCA, no sólo aquel en el que empieza.
 *
 * ⚠️  MARCAR SÓLO `start.getDay()` ESCONDÍA MEDIO EVENTO. FullCalendar trocea
 * por día lo que cruza medianoche —este mismo módulo lo sabe, ver la rama del
 * cruce en `tramoDeEvento`—, así que una guardia de sábado 22:00 a domingo 02:00
 * marcaba el sábado y dejaba el domingo plegable: el trozo de 00:00 a 02:00
 * desaparecía de la vista. Y por el otro eje ese mismo evento estiraba la
 * rejilla hasta las 24:00 para enseñar un tramo cuya columna se acababa de
 * borrar. Con eventos de Google multidía es peor: un congreso de viernes a lunes
 * tapaba el sábado y el domingo marcando sólo el viernes.
 *
 * El fin es EXCLUSIVO: terminar exactamente a medianoche no toca el día
 * siguiente, y por eso se recorre hasta `end - 1 ms`. Sin `end` —o con un fin
 * que no avanza— se marca sólo el día de `start`.
 *
 * ⚠️  Y AHÍ LOS DOS EJES DISCREPAN, A SABIENDAS. `tramoDeEvento` SÍ replica el
 * `defaultTimedEventDuration` de FullCalendar —una hora
 * (`@fullcalendar/core/internal-common.js:1491`)— para el evento sin `end`, y
 * tiene su propio aviso explicando por qué no hacerlo reabría el bug original.
 * Esta función NO lo replica: sin `end`, sólo el día de `start`.
 *
 * Lo que eso significa: un evento sin fin a las 23:30 de un sábado se pintaría
 * hasta las 00:30 del domingo, estiraría la rejilla para enseñar ese trozo, y
 * NO protegería la columna del domingo — justo el fallo que esta función existe
 * para no tener.
 *
 * HOY ES INALCANZABLE: `appointments.end_time` es `NOT NULL` en la base y la API
 * de Google siempre devuelve `end`, así que ningún camino produce uno. Queda
 * escrito porque la asimetría se ve rara y alguien va a querer «alinearla».
 *
 * ⚠️  SI SE ALINEAN, SE ALINEAN A CONCIENCIA Y CON PRUEBA. No copies la rama de
 * `tramoDeEvento` aquí sin más: allí el fin efectivo se calcula como FECHA
 * precisamente para que un evento sin fin a las 23:30 caiga en el día siguiente,
 * y ese detalle es el que importa en este eje. Copiarlo a medias marca el día
 * equivocado, que es peor que no marcarlo.
 *
 * El recorrido se acota al rango recibido para que un evento de meses no haga
 * iterar meses.
 */
function diasTocados(ev: EventoParaVentana, rango: RangoVisible): number[] {
  const inicio = ev.start
  if (!inicio) return []
  if (!ev.end || ev.end.getTime() <= inicio.getTime()) return [inicio.getDay()]

  const desde = Math.max(inicio.getTime(), rango.activeStart.getTime())
  const hasta = Math.min(ev.end.getTime() - 1, rango.activeEnd.getTime() - 1)
  if (hasta < desde) return []

  const dias: number[] = []
  const cursor = inicioDelDia(desde)
  while (cursor.getTime() <= hasta && dias.length < 7) {
    dias.push(cursor.getDay())
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

/**
 * Los días de la semana que la rejilla puede ocultar sin esconderle nada a
 * nadie: los que la clínica tiene CERRADOS, que el rango recibido CUBRE, y que
 * además no tienen ni un evento pintado. Devuelve sus índices `fc`
 * (0 = domingo), listos para el `hiddenDays` de FullCalendar.
 *
 * La regla es la misma que en el eje vertical y es deliberadamente binaria:
 * **hay evento, no se colapsa; no hay evento, se colapsa.** Un domingo cerrado
 * con una sola cita se queda ENTERO. Nada a medias — una columna medio plegada
 * es peor que las dos alternativas.
 *
 * ⚠️  SÓLO SE PLIEGA LO QUE EL RANGO CUBRE. Fuera del rango no hay información:
 * sus citas no se han traído, así que «vacío» no se puede afirmar, sólo suponer.
 * Sin esta guarda, en la vista de DÍA —donde el botón también se pinta— el rango
 * es un solo día y los otros seis se plegaban con datos que nadie pidió. Y no
 * era inocuo: con un día entero oculto, `buildRangeFromDuration` llama a
 * `skipHiddenDays` y RECALCULA el rango
 * (`@fullcalendar/core/internal-common.js:2955-2959`, versión 6.1.20), así que
 * desde el viernes «siguiente» saltaba al lunes y una cita del sábado no había
 * forma de alcanzarla.
 *
 * ⚠️  CUENTAN TODOS LOS EVENTOS, incluidos los `allDay` y los de fondo, al revés
 * que en `ventanaDeEventos`. El motivo es CONSERVADOR, no de layout: aquí
 * equivocarse de más deja una columna vacía a la vista —feo y reversible con el
 * botón—, y equivocarse de menos ESCONDE algo que existe. Ante la duda, no se
 * pliega. (Ojo: la agenda va con `allDaySlot={false}`, así que hoy los `allDay`
 * ni siquiera se pintan en la rejilla; la regla se queda igual porque protege
 * del caso en que eso cambie.)
 *
 * ⚠️  `rango === null` DEVUELVE `[]`. Sin saber qué hay pintado no se puede
 * saber qué está vacío, y ante la duda no se oculta: quedarse ancho es
 * recuperable de un vistazo, esconder una columna con trabajo dentro no.
 *
 * ⚠️  ESTO DECIDE SOBRE `currentRange`, Y LA VISTA MES PINTA `renderRange`.
 * Quien cablea esta función le pasa el rango `completo`, que es `currentRange`:
 * en `dayGridMonth` eso es el mes natural, del día 1 al último. Pero esa vista
 * no pinta el mes natural — pinta `renderRange`, que `buildDayTableRenderRange`
 * encaja a semanas completas y `fixedWeekCount` rellena hasta seis filas
 * (`@fullcalendar/daygrid/internal.js:949-958`). Son hasta ~12 días de relleno
 * VISIBLES que caen fuera del rango con el que se decide aquí, así que una cita
 * en uno de esos días no protegería su columna.
 *
 * Hoy no muerde, porque `compactar` se apaga solo al salir de las vistas
 * `timeGrid*` (el efecto de `agenda/page.tsx` que vigila `currentView` e
 * `isMobile`). Aun así el cálculo llega a correr UN FOTOGRAMA con
 * `compactarRef.current` todavía en `true` —el ref se escribe en render y el
 * efecto de apagado despacha después—, y eso se ve como un parpadeo de columnas
 * plegadas al pasar de Semana a Mes. Molesto, no grave.
 *
 * ⚠️  PASA A FALLO REAL EL DÍA QUE «COMPACTAR» SE HABILITE EN VISTA MES. Quien
 * lo habilite tiene que resolver esto ANTES: hacer que aquí llegue el rango que
 * de verdad se pinta, no la unidad que la vista representa. No es un detalle a
 * pulir después — es el requisito previo.
 *
 * ⚠️  NUNCA PLIEGA TODOS LOS DÍAS QUE CUBRE. Con los siete, `initHiddenDays`
 * lanza `invalid hiddenDays` (`internal-common.js:3045`) y la agenda se cae
 * entera; con uno solo —la vista de Día— plegarlo dispara el salto de arriba.
 * Las dos son el mismo caso: quedarse sin ninguna columna que enseñar.
 *
 * `diasFc` lo pasa la página con su propia constante `DIAS`, para que este
 * módulo no tenga que importar nada de ella.
 */
export function diasOcultables(
  eventos: readonly EventoParaVentana[],
  rango: RangoVisible | null,
  horario: Horario,
  diasFc: readonly { key: DiaSemana; fc: number }[],
): number[] {
  if (!rango) return []

  /* Mismo solapamiento SEMIABIERTO que `ventanaDeEventos`, por el mismo motivo:
     con `<=` entrarían los eventos del corte del día siguiente, que esta vista
     no pinta. Los días salen de `getDay()` — reloj de pared del navegador, igual
     que todo lo demás aquí (ver el aviso de la cabecera). */
  const conEventos = new Set<number>()
  for (const ev of eventos) {
    if (!ev.start) continue
    const finSolape = ev.end ?? ev.start
    if (!(ev.start < rango.activeEnd && finSolape > rango.activeStart)) continue
    for (const dia of diasTocados(ev, rango)) conEventos.add(dia)
  }

  const cubiertos = diasDelRango(rango)
  const ocultables: number[] = []
  for (const { key, fc } of diasFc) {
    if (!cubiertos.has(fc)) continue
    if (conEventos.has(fc)) continue
    const horas = horasDeDia(horario[key])
    // Cerrado es no abrir, no ser legible, o un tramo que no avanza: los tres
    // dejan la columna sin horario que enseñar. Ver `horasDeDia`.
    if (!horas || horas.fin <= horas.inicio) ocultables.push(fc)
  }

  return ocultables.length >= cubiertos.size ? [] : ocultables
}

/**
 * La frase que confiesa el recorte, o `null` si no se recortó nada.
 *
 * Un calendario que enseña MENOS de lo que enseñaba tiene que decirlo: sin esta
 * línea, una rejilla que empieza a las 09:00 y una semana sin domingo se leen
 * como datos que faltan, no como una vista plegada a propósito.
 *
 * ⚠️ VA SIN MAYÚSCULA INICIAL, Y NO ES UN DESCUIDO. Quien abre la línea es la
 * etiqueta «Vista compacta:» que pinta la banda en `agenda/page.tsx`, así que
 * esto es la continuación de una oración y no su principio. Hubo aquí un
 * `charAt(0).toUpperCase()` sobre la frase ya montada y se retiró con la banda;
 * si algún día vuelve a usarse suelta, la mayúscula la pone el llamador.
 *
 * ⚠️ LOS DÍAS VAN PRIMERO, y el orden no es estético. Una columna que falta NO
 * se deduce de la rejilla —ver cinco días seguidos no dice si la clínica abre el
 * sexto—, mientras que las horas recortadas sí: el gutter imprime la primera y
 * la última a la izquierda de la propia rejilla. Lo que no se puede deducir se
 * dice antes. Hasta el bloque 4 iban al revés.
 *
 * ⚠️ Y LA MITAD DE LAS HORAS NO DA EL RANGO, A PROPÓSITO. Decía «Rejilla
 * ajustada a 09:00–19:00» y ahora sólo declara que se recortó, por lo mismo del
 * párrafo de arriba: esos dos números ya están impresos a dos centímetros, en el
 * gutter. Repetirlos alargaba una banda que lleva el enlace de salida a la
 * derecha, a cambio de nada. Si algún día el gutter deja de enseñar sus
 * extremos, este párrafo es el que hay que releer.
 *
 * Las dos mitades son independientes —se puede recortar sólo el alto, sólo el
 * ancho, o los dos— y se unen SIEMPRE con ` · `. La tentación es la «y», que es
 * lo que enseña el mockup, pero el mockup sólo dibuja el caso de UN día: con dos
 * o más la lista ya trae su propia «y» («sábado y domingo ocultos») y saldría
 * una segunda seguida. Un separador que no depende del número de días es una
 * forma sola, y una forma sola es lo que se pidió.
 *
 * `diasEtiqueta` lo pasa la página con su constante `DIAS`, igual que en
 * `diasOcultables`, para que este módulo no importe nada de ella. Lee `label`
 * («Domingo») y NO `plural` («los domingos»): el campo `plural` sigue vivo y con
 * dueño —los dos avisos de fuera de horario del alta— pero aquí daba «los
 * domingos oculto» en singular, que no es una frase.
 */
export function avisoDeRecorte(
  ventana: VentanaRejilla,
  diasOcultos: readonly number[],
  diasEtiqueta: readonly { label: string; fc: number }[],
): string | null {
  const dosDigitos = (n: number): string => String(n).padStart(2, '0')
  const masEstrecha =
    ventana.slotMinTime > `${dosDigitos(VENTANA_AMPLIA.inicioHora)}:00:00` ||
    ventana.slotMaxTime < `${dosDigitos(VENTANA_AMPLIA.finHora)}:00:00`

  const partes: string[] = []

  /* Coma entre todos menos el último, y «y» antes del último: «sábado y
     domingo», «viernes, sábado y domingo». Con uno solo el `slice(0, -1)` queda
     vacío y sale tal cual — y es justo ahí donde el singular tiene que aparecer
     también en el participio, o se lee «domingo ocultos». */
  const plegados = diasEtiqueta
    .filter(d => diasOcultos.includes(d.fc))
    .map(d => d.label.toLowerCase())
  if (plegados.length > 0) {
    const lista = plegados.length === 1
      ? plegados[0]
      : `${plegados.slice(0, -1).join(', ')} y ${plegados[plegados.length - 1]}`
    partes.push(`${lista} ${plegados.length === 1 ? 'oculto' : 'ocultos'}`)
  }

  if (masEstrecha) partes.push('horas fuera de horario recortadas')

  return partes.length === 0 ? null : partes.join(' · ')
}
