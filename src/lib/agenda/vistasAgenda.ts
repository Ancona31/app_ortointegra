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
export const FORMATOS_DE_VISTA = [
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
  const par = FORMATOS_DE_VISTA.find(p => p.ancho === viewType || p.estrecho === viewType || p.tableta === viewType)
  if (!par) return viewType
  /* `tableta` sólo cuenta en estrecho: la tableta es un tramo del móvil. El
     tercer parámetro es opcional para que los llamadores de dos formatos sigan
     igual. */
  if (movil && tableta) return par.tableta
  return movil ? par.estrecho : par.ancho
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
export function etiquetaCompactar(viewType: string): string {
  return viewType === 'dayGridMonth'
    ? 'Ocultar los días de la semana sin actividad'
    : 'Compactar la rejilla al horario de la clínica'
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
  return ''
}

