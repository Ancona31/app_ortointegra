/**
 * src/lib/agenda/conteoAgenda.ts
 *
 * Las filas resueltas del panel del día y el conteo de lo que la vista está
 * pintando (citas/eventos/Google), con las frases del subtítulo. Movido tal
 * cual desde `AgendaCliente.tsx` (A2.1, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import type { EventApi } from '@fullcalendar/core'
import type { Appointment } from './tiposAgenda'
import type { RangoVisible } from '@/lib/agenda/ventanaRejilla'
import { esEventoGenerico, tintasDelChipDeMes } from './tarjetasAgenda'
import { horaDeReloj } from './horarioAgenda'

/** Una fila del panel, ya resuelta: aquí no se vuelve a mirar el `EventApi`. */
export type FilaDelDia = {
  id: string
  /** Milisegundos del inicio, o `-1` en los de todo el día, que van primero. */
  orden: number
  hora: string
  todoElDia: boolean
  nombre: string
  esDeGoogle: boolean
  esEvento: boolean
  cancelada: boolean
  tinta: string
}

/**
 * Las filas del día `dia`, ordenadas: primero los de todo el día y después por
 * hora de inicio.
 *
 * ⚠️ SOLAPAMIENTO SEMIABIERTO, igual que en `ventanaDeEventos` y en
 * `diasOcultables` y por el mismo motivo: con `<=` entrarían los eventos que
 * TERMINAN a la medianoche de este día, o sea los del día anterior.
 *
 * ⚠️ EL NOMBRE ES EL DEL PACIENTE Y NO `event.title`, que es el motivo escrito
 * en el alta. Es la misma regla que ya aplica `MonthChip`, y las dos tienen que
 * decir lo mismo: el punto de la celda y la fila de abajo son el mismo evento.
 */
export function filasDelDia(eventos: readonly EventApi[], dia: Date): FilaDelDia[] {
  const desde = new Date(dia)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 1)

  const filas: FilaDelDia[] = []
  for (const ev of eventos) {
    if (!ev.start) continue
    if (!(ev.start < hasta && (ev.end ?? ev.start) > desde)) continue
    /* ANOTADO Y NO CASTEADO, igual que en `clasesDelEvento` y por su mismo
       motivo: `extendedProps` es `Record<string, any>` (`Dictionary`,
       `core/internal-common.d.ts`) y leerlo directo mete `any` en el archivo.
       `Partial` porque la fuente de Google no trae ninguno de estos campos.
       Esta fila NO lleva la cita entera: para abrirla basta el `id`, y quien la
       resuelve es `abrirCita` desde el `EventApi` — así el único punto del
       archivo que estrecha `extendedProps` a `Appointment` sigue siendo uno. */
    const ext: Partial<Appointment> & { isGcalBlock?: boolean } = ev.extendedProps
    const esDeGoogle = ext?.isGcalBlock === true
    const esEvento = esEventoGenerico(ext)
    const pac = ext?.pacientes
    filas.push({
      id: ev.id,
      orden: ev.allDay ? -1 : ev.start.getTime(),
      hora: ev.allDay ? 'todo el día' : horaDeReloj(ev.start),
      todoElDia: ev.allDay,
      nombre: pac ? `${pac.nombre} ${pac.apellidos}` : ev.title,
      esDeGoogle,
      esEvento,
      cancelada: ext?.status === 'cancelled',
      tinta: tintasDelChipDeMes(ext, esDeGoogle, esEvento).tinta,
    })
  }
  return filas.sort((a, b) => a.orden - b.orden)
}

/* La misma disciplina de guarda que `ventana` y `conteo`: se compara una CADENA
   y no el array. `getEvents()` recorre un mapa, así que su orden cambia con
   altas, bajas y refetches; aquí además las filas se reconstruyen enteras en
   cada llamada, o sea que la identidad no vale para nada. Con la firma, un
   `eventsSet` que no cambia nada del día muere en el bail-out de React. */
export function firmaDeFilas(filas: readonly FilaDelDia[]): string {
  return filas.map(f => `${f.id}|${f.hora}|${f.nombre}|${f.tinta}|${f.cancelada}`).join('\n')
}

/** El conteo del día, en la MISMA forma que consume `frasearConteo`. */
export function contarFilas(filas: readonly FilaDelDia[]): ConteoVisible {
  let citas = 0, eventos = 0, google = 0
  for (const f of filas) {
    if (f.esDeGoogle) google++
    else if (f.esEvento) eventos++
    else citas++
  }
  return { citas, eventos, google }
}

/** Lo que el subtítulo cuenta, por categoría. */
export type ConteoVisible = { citas: number; eventos: number; google: number }

/* Un evento tal como lo necesita el CONTEO, y nada más. Es un SUBCONJUNTO de
   `EventoParaVentana` —que a su vez calca la de `EventApi`— para que los dos
   cálculos se alimenten de la MISMA llamada, sin recorrer dos listas.

   ⚠️ `allDay` SE CAYÓ DE AQUÍ EN EL BLOQUE 5 y no es un descuido: era la entrada
   de la reja `sinAllDay`, que se retiró al encender la banda (ver el docstring
   de `contarVisibles`). En `EventoParaVentana` SIGUE VIVO y ahí no se toca: lo
   lee `tramoDeEvento` para que un evento de todo el día no estire la ventana
   vertical de la rejilla a 24 horas. Son dos usos distintos del mismo campo. */
/**
 * ¿El tramo `[inicio, fin)` toca algún día que NO esté plegado?
 *
 * Sólo lo usa `contarVisibles`, y sólo tiene efecto con «Compactar» encendido:
 * `ocultos` es el `hiddenDays` de FullCalendar, o sea los `getDay()` de las
 * columnas que se han quitado.
 *
 * ⚠️ RECORRE DÍAS DE CALENDARIO CON `setDate()` Y NO SUMANDO 24 h, por lo mismo
 * que `rangoQuePedir`: en el cambio de horario de verano un día no dura 24 horas
 * y la suma se desalinea. El tope de 7 vueltas es lo que impide que un evento
 * larguísimo pasee la semana entera sin necesidad: con siete días ya se han visto
 * todos los `getDay()` posibles, así que si ninguno era visible, ninguno lo será.
 */
export function tocaDiaVisible(inicio: Date, fin: Date, ocultos: readonly number[]): boolean {
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  for (let i = 0; i < 7; i += 1) {
    if (i > 0 && cursor >= fin) break
    if (!ocultos.includes(cursor.getDay())) return true
    cursor.setDate(cursor.getDate() + 1)
  }
  return false
}

/* ⚠️ LLEVA `end` DESDE QUE LA CONSULTA FILTRA POR SOLAPE, y no es opcional: sin
   él no hay forma de saber si un evento que empezó antes de la ventana sigue
   dentro. `EventApi` de FullCalendar lo trae, así que los tres llamadores lo
   pasan sin cambiar nada. */
export type EventoParaConteo = { start: Date | null; end: Date | null; extendedProps: Record<string, unknown> }

/**
 * Cuenta por categoría lo que la vista está PINTANDO ahora mismo.
 *
 * ⚠️ NO CUENTA EL `eventStore`, Y LA DIFERENCIA ES VISIBLE. `rangoQuePedir`
 * ensancha cada petición a semanas completas, así que el store guarda eventos
 * que la vista no dibuja; contarlos daría un subtítulo que promete citas que no
 * están en pantalla. De ahí el filtro por el rango ACTIVO.
 *
 * ⚠️⚠️ ESE FILTRO ES POR SOLAPE Y NO POR DÓNDE EMPIEZA EL EVENTO, y el cambio va
 * en pareja con el de `/api/appointments`. Mientras la consulta sólo devolvía lo
 * que EMPEZABA dentro de la ventana, mirar el inicio aquí bastaba porque no podía
 * llegar otra cosa. Desde que la consulta compara por solape sí llega: un evento
 * de varios días que arrancó la semana pasada. Con la reja vieja, ese evento se
 * PINTA y no se CUENTA — y eso no es un número flojo, es una contradicción en
 * pantalla, porque de este conteo cuelga también la banda de vacío del bloque 9:
 * la agenda enseñaría un congreso encima de una banda que dice «Sin citas esta
 * semana».
 *
 * La forma del test es la MISMA que la de `filasDelDia`, que ya contaba por
 * solape desde el bloque 6 (`ev.start < hasta && (ev.end ?? ev.start) > desde`).
 * Se copia en vez de compartirse porque son dos rejas contra rangos distintos —un
 * día allí, el rango activo aquí— y un helper común ataría el panel del mes al
 * conteo del subtítulo. Si divergen, es que tenían que divergir.
 *
 * `ev.end ?? ev.start` para el evento sin fin: entonces el solape se reduce a que
 * su instante caiga dentro, que es lo que se quiere.
 *
 * ⚠️ Y DESCUENTA `diasOcultos`, que es el caso que se escapa al filtro anterior:
 * con «Compactar» encendido, `hiddenDays` quita COLUMNAS que siguen cayendo
 * dentro de activeStart..activeEnd. Sin esta línea el subtítulo diría «5 citas»
 * con tres a la vista.
 *
 * ⚠️ HUBO UNA TERCERA REJA, `sinAllDay`, Y SE RETIRÓ EN EL BLOQUE 5. NO LA
 * REPONGAS. Decía —y era cierto— que con `allDaySlot={false}` FullCalendar no
 * MONTA la fila de todo el día, así que un evento `allDay` pasaba las otras dos
 * rejas y no se dibujaba en ninguna parte de Semana ni de Día: contarlo daba «1
 * de Google» sobre una rejilla que no lo enseñaba. Su propia nota avisaba de que
 * era el único de los tres filtros que dependía de una OPCIÓN del calendario y
 * no de la geometría de la vista, y de que había que retirarla el día que la
 * banda se encendiera.
 *
 * Ese día llegó: `allDaySlot` está en `true` y la banda pinta los `allDay` en
 * las tres vistas. La reja pasó de proteger a mentir al revés —descontaría unos
 * eventos que ahora SÍ están en pantalla—, así que se fue, y con ella el
 * parámetro y el `vista` que el llamador calculaba sólo para pasárselo.
 *
 * Es correcto HOY porque el único `allDay` posible viene de Google y cae en la
 * categoría `google`, que es la que le toca. El día que la aplicación sepa
 * escribir `all_day` (bloque 5B), un bloqueo de todo el día entrará por el
 * `else` de abajo y se contará como `cita` o como `evento` según tenga paciente:
 * eso es una decisión de producto que aquí no está tomada.
 *
 * ⚠️ EL FILTRO DE MÉDICO NO SE APLICA AQUÍ, Y NO ES UN OLVIDO: NO LO AÑADAS. Lo
 * aplica el SERVIDOR —las dos fuentes le mandan `medico_id` y devuelven ya
 * filtrado—, así que el store sólo contiene lo que pasa el filtro y contar el
 * store es contar lo filtrado. Un filtro de cliente encima sería o inocuo o,
 * el día que las dos reglas discrepen, un conteo distinto del que se pinta.
 *
 * ⚠️ AVISO PARA EL INTERRUPTOR DE GOOGLE (bloque siguiente): esto cuenta lo que
 * hay EN EL STORE. Si el interruptor se implementa retirando la fuente `gcal` de
 * `eventSourcesStable`, los eventos salen del store y el conteo se corrige solo.
 * Si en cambio se implementa ESCONDIENDO los eventos ya cargados —CSS,
 * `display: none`, una clase por `eventClassNames`—, seguirán aquí dentro y el
 * subtítulo dirá «1 de Google» con cero a la vista. La decisión es de aquel
 * bloque; la consecuencia cae en esta función.
 */
export function contarVisibles(
  eventos: readonly EventoParaConteo[],
  activo: RangoVisible | null,
  ocultos: readonly number[],
): ConteoVisible {
  let citas = 0, genericos = 0, google = 0
  for (const ev of eventos) {
    const inicio = ev.start
    if (!inicio) continue
    const fin = ev.end ?? inicio
    if (activo && !(inicio < activo.activeEnd && fin > activo.activeStart)) continue
    /* ⚠️ LA REJA DE DÍAS OCULTOS MIRA EL TRAMO ENTERO Y NO SÓLO EL DÍA DE INICIO,
       y es la misma corrección que la de arriba llevada a su terreno. Mirando el
       inicio, un evento de varios días que ARRANCA en un sábado plegado no se
       contaba aunque siguiera pintándose de lunes a viernes. Para un evento de un
       solo día —que son todos menos los de todo el día— esto da exactamente lo
       mismo que antes: su único día es el de inicio. */
    if (ocultos.length > 0 && !tocaDiaVisible(inicio, fin, ocultos)) continue

    const ext = ev.extendedProps
    if (ext.isGcalBlock === true) { google += 1; continue }
    /* Por `esEventoGenerico` y no reimplementando su regla: es el mismo
       despachador que usan las tarjetas, y así no puede divergir. El `typeof`
       es lo que estrecha el `unknown` de `extendedProps` sin un `as`. */
    const pacienteId = ext.paciente_id
    if (esEventoGenerico({ paciente_id: typeof pacienteId === 'string' ? pacienteId : null })) genericos += 1
    else citas += 1
  }
  return { citas, eventos: genericos, google }
}

/** «3 citas · 2 eventos · 1 de Google». Sólo las categorías con al menos uno;
 *  cadena vacía si no hay ninguna.
 *
 *  ⚠️ DEVUELVE LA FRASE SUELTA, SIN SEPARADOR DELANTE. Lo llevaba —empezaba por
 *  « · » para pegarse detrás de «Gestión de citas clínicas»— y dejó de servir
 *  cuando esa frase pasó a esconderse por debajo de `2xl`: el separador se
 *  quedaba huérfano al principio de la línea. Ahora lo pone quien compone el
 *  subtítulo, que es el único que sabe si hay algo delante. */
export function frasearConteo(c: ConteoVisible): string {
  const partes: string[] = []
  if (c.citas > 0)   partes.push(`${c.citas} ${c.citas === 1 ? 'cita' : 'citas'}`)
  if (c.eventos > 0) partes.push(`${c.eventos} ${c.eventos === 1 ? 'evento' : 'eventos'}`)
  // Sin plural que cambiar: «1 de Google», «4 de Google».
  if (c.google > 0)  partes.push(`${c.google} de Google`)
  return partes.join(' · ')
}

/**
 * El mismo conteo, abreviado. SÓLO PARA MÓVIL.
 *
 * ⚠️ ES UNA SEGUNDA REDACCIÓN DEL MISMO DATO, y eso normalmente sería un olor.
 * Aquí es la decisión: en la banda del teléfono el subtítulo comparte fila con
 * el hamburguesa y la caja del título, y en 390 px «13 citas · 2 eventos · 1 de
 * Google» no cabe entero. Recortarlo con elipsis parte la última palabra a la
 * mitad («… · 1 de Goo…»), que se lee como un fallo; abreviado cabe y se
 * entiende. Escritorio se queda con la forma larga, donde sobra ancho.
 *
 * ⚠️ «GCal» Y NO «Google»: es exactamente el rótulo que la leyenda de la agenda
 * ya usa para lo mismo, y por el mismo motivo (ver su nota, con la medida). Dos
 * abreviaturas distintas del mismo origen serían peor que una.
 *
 * ⚠️ LOS NÚMEROS SON LOS MISMOS: esto sólo cambia las palabras. Si algún día hay
 * que tocar QUÉ se cuenta, se toca `contarVisibles` y las dos frases siguen.
 */
export function frasearConteoBreve(c: ConteoVisible): string {
  const partes: string[] = []
  if (c.citas > 0)   partes.push(`${c.citas} cit`)
  if (c.eventos > 0) partes.push(`${c.eventos} ev`)
  if (c.google > 0)  partes.push(`${c.google} GCal`)
  return partes.join(' · ')
}

