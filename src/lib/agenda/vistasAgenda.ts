/**
 * src/lib/agenda/vistasAgenda.ts
 *
 * Las vistas del calendario: qué formato (ancho/estrecho) le toca a cada
 * una, sus rótulos de «Compactar», si admite rejilla, y los textos del
 * "+N" y del periodo de la banda de vacío. Movido tal cual desde
 * `AgendaCliente.tsx` (A2.1, movimiento puro), con sus comentarios; sólo
 * cambiaron los `import`/`export` que hacían falta.
 */

import type { ViewApi, MoreLinkContentArg } from '@fullcalendar/core'

/* ¿La vista dibuja una REJILLA DE HORAS —Semana o Día—?
 *
 * ⚠️ NO ES LA MISMA PREGUNTA QUE «¿no es Mes?», y hasta el bloque 6 sí lo era
 * porque no había un tercer grupo de vistas. Con `@fullcalendar/list` instalado
 * lo hay, y las dos piezas que dependen de esto —el chip de la banda y el
 * sistema de tiers— sólo tienen sentido donde FullCalendar ASIGNA UN ALTO al
 * evento, que es exactamente la rejilla horaria.
 *
 * ⚠️ SE ENUMERAN LAS DOS QUE HAY, NO SE DESCARTAN LAS DE LISTA. Por descarte,
 * cualquier vista que se monte mañana —otra lista, `multiMonth`, lo que sea—
 * entraría en el camino de la rejilla y estrenaría el fallo en silencio; en
 * blanco, cae en el camino que no supone alto y como mucho se le queda corta la
 * pinta, que se ve. Las tres vistas del segmentado están en `VIEWS`.
 *
 * ⚠️ ESTO NO CONTRADICE EL AVISO DE `cayoEnLaBandaDeTodoElDia`, que prohíbe
 * preguntar por `view.type`. Allí la pregunta es DÓNDE cayó un gesto, y esa la
 * contesta el DOM porque la banda existe en más de una vista. Aquí la pregunta
 * es QUÉ VISTA está pintando, que es literalmente lo que este campo dice. */
export function esVistaDeRejilla(viewType: string): boolean {
  return viewType === 'timeGridWeek' || viewType === 'timeGridDay' || viewType === 'timeGridTresDias'
}

/* F1.16 · TERCER FORMATO, LA TABLETA (768–1023 px): Semana se dibuja como
   rejilla de TRES DÍAS (`timeGridTresDias`, vista propia en `opcionesCalendario`),
   Día como la rejilla de un día y Mes como en el teléfono. La banda azul se
   queda (`isMobile` sigue a 1024): sólo cambia el formato del periodo. */
/* ⚠️ ES LA TABLA DE LA V2 APAGADA (B13 · AG2): tres periodos y la tableta con
   su Semana de tres días, como siempre. La de la v2 encendida es
   `FORMATOS_DE_VISTA`, abajo. */
export const FORMATOS_DE_VISTA_V1 = [
  { ancho: 'dayGridMonth', estrecho: 'dayGridMonth', tableta: 'dayGridMonth'     },
  { ancho: 'timeGridWeek', estrecho: 'listWeek',     tableta: 'timeGridTresDias' },
  { ancho: 'timeGridDay',  estrecho: 'listDay',      tableta: 'timeGridDay'      },
] as const

/**
 * La vista que le toca a `viewType` con el ancho de ahora, conservando el
 * periodo. Semana sigue siendo Semana; sólo cambia de formato.
 *
 * ⚠️ ES IDEMPOTENTE A PROPÓSITO: pasarle una vista que YA está en el formato
 * correcto devuelve la misma cadena. De eso vive el efecto del `resize`, que
 * dispara en cada píxel de arrastre y compara antes de llamar a `changeView`;
 * sin la idempotencia habría que acordarse de comparar fuera, y basta olvidarlo
 * una vez para reconstruir el `dateProfile` sesenta veces por segundo.
 *
 * ⚠️ UNA VISTA DESCONOCIDA SE DEVUELVE TAL CUAL, y no es pereza: es lo que
 * impide que un `changeView` a ciegas mande la agenda a una vista que nadie ha
 * registrado. Ante la duda, no se mueve.
 */
export function vistaEnElOtroFormato(viewType: string, movil: boolean, tableta = false): string {
  const par = FORMATOS_DE_VISTA_V1.find(p => p.ancho === viewType || p.estrecho === viewType || p.tableta === viewType)
  if (!par) return viewType
  /* `tableta` sólo cuenta en estrecho: la tableta es un tramo del móvil. El
     tercer parámetro es opcional para que los llamadores de dos formatos sigan
     igual. */
  if (movil && tableta) return par.tableta
  return movil ? par.estrecho : par.ancho
}

/* ═══ B13 · AG2 · LAS CUATRO VISTAS DE LA V2 (CALMA §28 y §29.1) ═══════════
   Con la v2 el médico elige entre CUATRO periodos en todos los formatos —Mes,
   Semana, 3 días y Día— y el formato lo decide la sonda (`data-formato`,
   `src/lib/formatoPantalla.ts`), no el ancho a mano: así el estado de React y
   las hojas de estilo (`ext:`, `tel:`… y los cortes de 600/1024) cruzan en el
   MISMO píxel. Sólo el teléfono (`ext`, `tel`) cambia de forma, y sólo la
   Semana: lista por día (`listWeek`). «3 días» y Día son SIEMPRE rejilla,
   también en el teléfono; Mes, el mismo en todos.
   ⚠️ No hay columna de tableta: en `ih`/`iv` Semana son siete columnas y
   «3 días» es otra vista, no su sustituto. Apagada, `FORMATOS_DE_VISTA_V1`. */
export const FORMATOS_DE_VISTA = [
  { rotulo: 'Mes',    rejilla: 'dayGridMonth',     telefono: 'dayGridMonth'     },
  { rotulo: 'Semana', rejilla: 'timeGridWeek',     telefono: 'listWeek'         },
  { rotulo: '3 días', rejilla: 'timeGridTresDias', telefono: 'timeGridTresDias' },
  { rotulo: 'Día',    rejilla: 'timeGridDay',      telefono: 'timeGridDay'      },
] as const

/** ¿El formato de la sonda es de teléfono (Duo cerrado o teléfono en vertical)? */
export function esFormatoTelefono(formato: string): boolean {
  return formato === 'ext' || formato === 'tel'
}

/**
 * Con la v2, la vista que le toca a `viewType` en este formato, conservando
 * el periodo. Idempotente, como `vistaEnElOtroFormato`, y una vista
 * desconocida se devuelve tal cual.
 *
 * Reconoce también las de la v2 apagada: `listDay` es Día (en el teléfono
 * pasa a rejilla). ⚠️ `timeGridTresDias` aquí es «3 días»; la Semana de tres
 * días de la tableta apagada se traduce ANTES, con `vistaDeLaV1EnLaV2`.
 */
export function vistaDelFormato(viewType: string, telefono: boolean): string {
  const fila = FORMATOS_DE_VISTA.find(p => p.rejilla === viewType || p.telefono === viewType)
    ?? FORMATOS_DE_VISTA.find(p => p.rejilla === vistaEnElOtroFormato(viewType, false))
  if (!fila) return viewType
  return telefono ? fila.telefono : fila.rejilla
}

/**
 * Al encenderse la v2 sobre una vista que puso la agenda apagada: allí
 * `timeGridTresDias` sólo podía ser la Semana de la tableta (no había «3 días»
 * que elegir), así que se ensancha con la tabla de la v1 antes de traducir.
 */
export function vistaDeLaV1EnLaV2(viewType: string, telefono: boolean): string {
  return vistaDelFormato(vistaEnElOtroFormato(viewType, false), telefono)
}

/** F1.16 · ¿El ancho es de tableta (768–1023 px)? Por debajo de 768, teléfono. */
export const ANCHO_TABLETA = 768

/**
 * El rótulo de «Compactar», que NO es el mismo en las dos vistas que lo admiten.
 *
 * En rejilla el botón hace dos cosas —encoge el alto al horario y pliega las
 * columnas vacías—, y el rótulo nombra la primera porque es la que se ve de
 * golpe. En Mes sólo hace la segunda: ahí no hay `slotMinTime` que encoger, así
 * que hablar de «rejilla» y de «horario» describiría un recorte que esa vista no
 * puede hacer. Es el mismo criterio del gate de `aplicarVentana` y del texto de
 * salida de la banda; los tres cambian juntos o el botón promete una cosa, la
 * banda otra y la pantalla una tercera.
 */
export function etiquetaCompactar(viewType: string, agendaV2 = false): string {
  if (viewType === 'dayGridMonth') return 'Ocultar los días de la semana sin actividad'
  /* G4: con la v2 la rejilla se dibuja con el horario de los consultorios
     (`horarioRejilla.ts`); apagada, con el de la clínica, como siempre. */
  return agendaV2 ? 'Compactar la rejilla al horario de los consultorios' : 'Compactar la rejilla al horario de la clínica'
}

/**
 * ¿Tiene sentido «Compactar» en esta vista?
 *
 * Las de REJILLA por los dos ejes —alto y columnas— y MES sólo por el de las
 * columnas (ver el gate de `aplicarVentana`). Las dos de LISTA por ninguno: no
 * tienen ni rejilla de horas ni columnas de día, así que ahí el botón no se
 * pinta y el estado se apaga solo.
 *
 * ⚠️ ES LA MISMA PREGUNTA EN LOS DOS SITIOS —el apagado automático y el pintado
 * del botón— y por eso vive en una función y no duplicada en dos condiciones.
 * Si divergen, se puede quedar encendido donde no hay con qué apagarlo.
 */
export function vistaAdmiteCompactar(viewType: string): boolean {
  return viewType.startsWith('timeGrid') || viewType === 'dayGridMonth'
}

/* «+2», sin la palabra del locale. A nivel de módulo por la regla de identidad
   estable, igual que el resto de renderizadores de esta página. El texto largo
   sigue disponible para quien no lo ve: `moreLinkHint` del locale («Mostrar N
   eventos más») es lo que va al `title` y al lector de pantalla, y no se toca. */
export function masBreve(arg: MoreLinkContentArg): string {
  return `+${arg.num}`
}

/* El mes de la banda de vacío, en minúsculas y sin año: «agosto». Sin `timeZone`
   a propósito — el <FullCalendar> no lleva opción `timeZone`, así que sus fechas
   son del huso del navegador y formatearlas en otro las movería de mes en el
   primer día y en el último. */
const FMT_MES_BANDA = new Intl.DateTimeFormat('es-MX', { month: 'long' })

/**
 * Lo que va detrás de «Sin citas…» en la banda de vacío: «esta semana», «en
 * agosto». Cadena vacía en cualquier otra vista, y eso APAGA la banda — es lo
 * que la deja fuera de las dos vistas de LISTA, que ya tienen su propio vacío en
 * `noEventsContent`, y fuera de la vista Día, cuyo vacío lo cuenta el panel.
 *
 * ⚠️ «ESTA SEMANA» AUNQUE NO SEA ESTA SEMANA, y es literal del spec (§11). La
 * fecha exacta está en el toolbar, tres centímetros más arriba y en cuerpo
 * grande; repetirla aquí alargaría la frase para no decir nada nuevo.
 */
export function periodoDeLaVista(vista: ViewApi): string {
  if (vista.type === 'dayGridMonth') return `en ${FMT_MES_BANDA.format(vista.currentStart)}`
  if (vista.type === 'timeGridWeek') return 'esta semana'
  /* F1.16 · La «Semana» de la tableta son tres días: la banda de vacío no puede
     decir «esta semana» de ellos. */
  if (vista.type === 'timeGridTresDias') return 'en estos tres días'
  return ''
}

