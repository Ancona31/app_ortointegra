/**
 * src/components/agenda/opcionesCalendario.ts
 *
 * Las opciones literales de `<FullCalendar>` que tienen que vivir a nivel de
 * módulo por la regla de identidad estable: vistas por formato (escritorio y
 * móvil), toolbar de escritorio, plugins y los dos formatos de hora. Movido
 * tal cual desde `AgendaCliente.tsx` (A2.5.1, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { FormatterInput, PluginDef } from '@fullcalendar/core'
import { masBreve } from '@/lib/agenda/vistasAgenda'

/* ── LAS TRES VISTAS, CADA UNA EN SUS DOS FORMATOS ─────────────────────────
   Lo que el médico elige es un PERIODO —mes, semana, día—, no una vista de
   FullCalendar. El formato en el que ese periodo se dibuja lo decide el ancho:
   rejilla cuando sobra y lista cuando no.

   ⚠️ MES APARECE A LOS DOS LADOS CON EL MISMO VALOR, Y NO ES UN HUECO SIN
   RELLENAR. El mes se dibuja igual de ancho que de estrecho —lo que cambia son
   sus celdas, que es otro bloque—, así que su pareja es él mismo. Ponerlo aquí y
   no tratarlo como caso aparte es lo que deja `vistaEnElOtroFormato` sin ninguna
   rama especial: la tabla contesta por las tres.

   ⚠️ ESTA TABLA NO REGISTRA NADA. Las vistas se registran por el PLUGIN, en la
   prop `plugins` del <FullCalendar>; esto sólo dice quién es pareja de quién. Si
   añades un par aquí sin que las dos vistas existan, `changeView` lanzará. */

/* Opciones POR VISTA. A nivel de módulo por la regla de identidad estable: un
   literal en el JSX sería un objeto nuevo en cada render y FullCalendar vuelve
   a refinar sus opciones cuando la referencia cambia.

   `dayHeaderFormat` va aquí dentro y NO como prop suelta del calendario: a
   nivel raíz se la comería también el time-grid, donde la cabecera la compone
   `renderDayHeader` con su abreviatura de tres letras y su número apilado.
   Sin esto, el fallback de FullCalendar para una vista de varias semanas es
   `weekday: 'short'` (core/internal-common.js:6143-6144), que con `esLocale` da
   «lun» — y el mockup del mes pide «LUNES». Las mayúsculas ya las pone
   `globals.css` en `.fc-col-header-cell-cushion`; aquí sólo se pide el nombre
   largo. */
/* ⚠️ `titleFormat` VA AQUÍ DENTRO, POR VISTA, y no como prop suelta: cada una
   quiere una forma distinta y a nivel raíz se la comerían las tres. El default
   de FullCalendar para Semana es `{month:'short', day:'numeric', year:'numeric'}`,
   que con `esLocale` daba «17 – 23 Ago 2026» — mes abreviado y sin preposición.

   Cómo compone el rango la de SEMANA, porque no es obvio: `NativeFormatter`
   detecta que la unidad que difiere es el DÍA, formatea los dos extremos
   enteros («17 de agosto de 2026» / «22 de agosto de 2026»), busca la parte
   común y la saca fuera. Resultado: «17 – 22 de agosto de 2026». Por eso basta
   con pedir el formato de UNA fecha; el rango sale solo. El guión largo lo pone
   `titleRangeSeparator` en el calendario — el default es « - », con guión
   corto.

   ⚠️ QUE EL TÍTULO LLEGUE HASTA EL 23 Y EL MOCKUP HASTA EL 22 NO ES UN FALLO DE
   FORMATO: el mockup tiene el domingo plegado y nosotros no. El título sigue al
   rango real de la vista, que es lo correcto. No lo «arregles».

   La de DÍA sale «miércoles, 19 de agosto de 2026»: con coma, que es la forma
   del locale, mientras que el mockup la dibujó sin ella. Se respeta el locale.
   La mayúscula inicial —que Intl no pone en español— la da un `::first-letter`
   en `globals.css`. Y NO el `text-transform: capitalize` de
   `.fc .fc-toolbar-title`, que la regla de la agenda anula a propósito: ese
   capitalize pone mayúscula en CADA palabra y con este formato largo daría
   «17 – 22 De Agosto De 2026». Con el formato corto de antes no se notaba
   porque no había preposiciones que estropear. */
/* F1.6 · EL MES DE ESCRITORIO PINTA SUS SEMANAS REALES (spec §7.2, decisión
   14): `fixedWeekCount: false` quita la sexta fila de relleno y `expandRows:
   false` deja que cada fila mida su contenido (la prop global `expandRows` del
   <FullCalendar> es para la rejilla de horas; ésta, por vista, la pisa sólo
   aquí). ⚠️ `semanasPintadasDelMes` lee `fixedWeekCount` de la vista para
   contar las semanas: si quitas esto, aquélla vuelve a seis sola. El teléfono
   (`VISTAS_FC_MOVIL`) sigue con seis: lo exige `.ag-cal-mes-movil`. */
export const VISTAS_FC = {
  dayGridMonth: {
    dayHeaderFormat: { weekday: 'long' },
    titleFormat:     { month: 'long', year: 'numeric' },
    fixedWeekCount:  false,
    expandRows:      false,
  },
  /* ⚠️ `month: 'short'` Y NO `'long'`. En largo esto daba «24 – 28 de agosto de
     2026» y medía 282,77 px a 22 px de cuerpo — el elemento más ancho de la fila
     con diferencia, y lo que dejaba a la leyenda sin sitio para caber en una
     línea. En corto sale «24 – 28 ago 2026». El separador largo lo pone
     `titleRangeSeparator` en el <FullCalendar>, no esto.
     Mes y Día se quedan en largo A PROPÓSITO: Mes ya es sólo «agosto de 2026» y
     no aprieta, y en Día el día de la semana es información que ahí se quiere. */
  /* ⚠️ `dayMaxEvents: 2` VA AQUÍ Y NO EN EL <FullCalendar>, y la diferencia es
     visible. Es el tope de la BANDA DE TODO EL DÍA, y `dayMaxEvents` es una
     opción global que Mes también lee: bajarla en el componente dejaría las
     celdas del mes en dos chips, que es otro bloque y otra decisión. Puesta por
     vista, sólo alcanza a las dos de rejilla.

     QUE LA BANDA LA LEA ESTÁ COMPROBADO EN LA LIBRERÍA, no supuesto:
     `@fullcalendar/timegrid/internal.js:315-322` (`getAllDayMaxEventProps`) la
     saca de `this.context.options` y la reparte al `DayTable` de la banda en
     `:1130`; sólo convierte el valor cuando es `true` (el modo «auto»), así que
     un número pasa entero. Y `context.options` es POR VISTA —
     `@fullcalendar/core/internal-common.js:2338-2342`, `buildViewContext` recibe
     `viewOptions` y los publica como `options`—, que es lo que hace que ponerla
     aquí funcione. */
  timeGridWeek: { titleFormat: { day: 'numeric', month: 'short', year: 'numeric' }, dayMaxEvents: 2 },
  timeGridDay:  { titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, dayMaxEvents: 2 },
  /* ⚠️ LAS DOS DE LISTA SÓLO LLEVAN `titleFormat`, Y NO ES UN OLVIDO: sus
     `listDayFormat` / `listDaySideFormat` siguen SIN PONERSE a propósito, porque
     los textos de la cabecera de día los compone `CabeceraDiaLista` a mano —los
     defaults del plugin vienen invertidos, ver su nota—. Esto es otra cosa: es la
     etiqueta de FECHA de la banda móvil, que sale de `view.title`.
     Sin estas dos entradas caían al default de FullCalendar, que trae el año y el
     mes abreviado —«17 – 22 ago 2026»—; el mockup pide «17 – 22 de agosto», sin
     año, porque en una pantalla de 390 px el año es la parte que no aporta.
     El rango lo compone solo `NativeFormatter` a partir del formato de UNA fecha,
     igual que en `timeGridWeek`; el guión largo lo pone `titleRangeSeparator`. */
  listDay:  { titleFormat: { weekday: 'short', day: 'numeric', month: 'long' } },
  listWeek: { titleFormat: { day: 'numeric', month: 'long' } },
} as const

/* ── LAS OPCIONES DEL MES EN UN TELÉFONO ────────────────────────────────────
   La MISMA tabla que la de arriba con la entrada de Mes sustituida. A nivel de
   módulo por la regla de identidad estable, igual que su hermana, y como objeto
   COMPLETO y no como spread: es la lista que hay que leer para saber qué ve el
   teléfono, y un spread obliga a mirar dos sitios.

   ⚠️ LA CUADRÍCULA SIGUE SIENDO LA DE FULLCALENDAR. Aquí no hay ninguna rejilla
   propia: lo único que cambia son cuatro opciones y una hoja de estilos.

   · `dayHeaderFormat: { weekday: 'narrow' }` — «L M X J V S D». En `long` («LUNES»)
     las siete cabeceras se pisaban unas a otras a 51 px de columna. Es la
     abreviatura más corta que el locale ofrece, que es «lo que quepa».
   · `showNonCurrentDates: false` — los días de los meses vecinos se dejan en
     blanco. Con `fixedWeekCount` en su default (`true`, y NO se toca aquí: el
     escritorio lo apaga desde F1.6, el teléfono no) las seis filas siguen ahí, así
     que la rejilla no cambia de alto al navegar; lo que se va es el número de un
     día que no es de este mes y que en modo punto no se distingue de los suyos.
   · `dayMaxEvents: 3` — tres puntos y el cuarto hueco como «+N». El global es 3
     también, pero el de aquí es POR VISTA y sobrevive a que alguien mueva aquél.
   · `moreLinkContent` — «+2» y no «+2 más». El texto del locale son 35 px en una
     celda de 51 que ya lleva tres puntos.
   · ⚠️ `eventDisplay: 'list-item'` — Y ESTA NO ES COSMÉTICA, ES LO QUE HACE QUE
     LA FILA DE PUNTOS FUNCIONE. Con el default (`'auto'`) `dayGridMonth` reparte
     los segmentos en DOS mecanismos: los de hora van EN FLUJO dentro de la celda
     y los de todo el día —y los de varios días— van a una capa de la FILA con
     `position: absolute`. Un hijo posicionado en absoluto NO es un ítem de flex,
     así que la fila centrada de la hoja no lo colocaría: la barra se quedaría en
     el `top` que se calculó para el apilado vertical, encima del número del día.
     Con `'list-item'` todos los segmentos van por el camino en flujo y por
     celda, que es el único que la fila de puntos sabe repartir. De paso, un
     evento de varios días deja un punto en CADA día que ocupa, que es justo lo
     que un resumen de «cuánto hay» tiene que decir.
   · `navLinks: false` — ⚠️ Y ESTO NO ES UN RECORTE, ES QUITAR UN CONFLICTO. El
     número del día es un enlace a `timeGridDay` (ver `navLinkDayClick`), o sea
     que en el teléfono llevaba a una REJILLA de horas, que es justo el formato
     que el móvil no usa. Y además competía con el toque de la celda, que ahora
     selecciona el día. La ruta a la vista Día en móvil es el «Ver día ›» del
     panel de abajo, y es una sola.

   ⚠️ `hiddenDays` NO SE TOCA AQUÍ: el mes arranca con las SIETE columnas. Que se
   plieguen las vacías es una decisión del médico —el botón «Compactar» de la
   banda— y es reversible desde la misma banda. El mockup dibuja seis columnas
   con el domingo fijo; eso se descartó. */

export const VISTAS_FC_MOVIL = {
  dayGridMonth: {
    dayHeaderFormat:     { weekday: 'narrow' },
    titleFormat:         { month: 'long', year: 'numeric' },
    showNonCurrentDates: false,
    dayMaxEvents:        3,
    moreLinkContent:     masBreve,
    eventDisplay:        'list-item',
    navLinks:            false,
  },
  timeGridWeek: { titleFormat: { day: 'numeric', month: 'short', year: 'numeric' }, dayMaxEvents: 2 },
  timeGridDay:  { titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, dayMaxEvents: 2 },
  /* ⚠️ AQUÍ ESTUVO `stickyHeaderDates: false` PARA `listDay`, Y SE RETIRÓ. NO LO
     REPONGAS SIN LEER ESTO: el problema que venía a esquivar está resuelto por
     su causa, y volver a apagar el pegado sólo lo taparía otra vez.

     LA HISTORIA. En Día, al scrollear, la primera cita se metía debajo de la
     cabecera del día y se leía a medias. Se apagó el pegado con el argumento de
     que con UN solo grupo no hay relevo que hacer. Después se comprobó, mockup
     en mano, que el solape es inevitable con cualquier cabecera pegada —el
     propio mockup lo asume por escrito: «el fondo tiene que ser OPACO, o las
     filas se ven por debajo»— y que el defecto de verdad era otro: el fondo NO
     estaba tapando, porque vivía en el `<th>`, una caja de tabla cuyos adornos
     se pintan en la posición de flujo y no viajan con el desplazamiento
     pegajoso. Arreglado eso —fondo y líneas mudados al cushion, y orden de
     pintado explícito; todo en `globals.css`, junto a `.fc-list-day-cushion`—,
     el pegado ya no tapa nada legible y las dos vistas de lista se comportan
     igual, que es lo que se quería. */
  listDay:  { titleFormat: { weekday: 'short', day: 'numeric', month: 'long' } },
  listWeek: { titleFormat: { day: 'numeric', month: 'long' } },
} as const

/* Las dos configuraciones del toolbar nativo, A NIVEL DE MÓDULO por la regla de
   identidad estable: un literal en el JSX es un objeto nuevo en cada render y
   FullCalendar vuelve a refinar sus opciones cuando la referencia cambia.
   Estaban en línea y se subieron aquí al tocarlas en el bloque 4.

   ⚠️ EN ESCRITORIO LA FECHA VA EN EL CHUNK `left`, con los botones, y `center`
   queda vacío. Antes iba en `center`, o sea flotando en mitad de la tarjeta y
   lejos de las flechas que la mueven. En MÓVIL se queda centrada: ahí el chunk
   izquierdo sólo lleva las dos flechas y no hay ancho para poner la fecha al
   lado sin partirla. */
/* ⚠️ AQUÍ VIVÍA `TOOLBAR_MOVIL`, Y SE FUE EN EL PASO 8a. Era
   `{ left: 'prev,next', center: 'title', right: 'today' }`, la configuración del
   toolbar NATIVO en móvil. Ya no hay toolbar nativo en móvil: `headerToolbar` va
   en `false` y lo sustituye entero `BandaMovil`. Si algún día vuelve el toolbar
   nativo ahí, esa es la línea — pero entonces sobra la banda, no conviven. */
export const TOOLBAR_ESCRITORIO  = { left: 'prev,next today title', center: '', right: '' } as const

/* ── A1-bis.2 · LAS PROPS LITERALES DE `<FullCalendar>`, A NIVEL DE MÓDULO ────
   `@fullcalendar/react` llama a `resetOptions` con TODAS las props en cada render
   del padre, y FullCalendar re-refina cada opción cuya identidad cambió —y con
   una sola que cambie, repinta el calendario entero—. Un array o un objeto
   escrito en el JSX es uno nuevo en cada render. Aquí son el mismo siempre.
   ⚠️ El orden de `PLUGINS_FC` es una decisión: ver la nota junto a la prop. */
export const PLUGINS_FC: PluginDef[] = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]
export const TEXTO_BOTONES_FC = { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }
/** El de las horas de las tarjetas y el de la columna de horas: el mismo. */
export const FORMATO_HORA_FC: FormatterInput = { hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }
