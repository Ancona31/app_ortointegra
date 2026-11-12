/**
 * src/lib/agenda/flipTarjetas.ts
 *
 * La técnica FLIP para una tarjeta que cambia de sitio sin que la mueva el
 * usuario (bloque F, F2.6-lib): la cita que otra persona movió y llega por
 * tiempo real, y la que vuelve a su franja cuando se cancela el aviso de un
 * arrastre (`restaurarPosicion`, B2). En vez de saltar, se desliza de donde
 * estaba a donde está.
 *
 * First · Last · Invert · Play:
 *   1. se mide el rectángulo de la tarjeta ANTES del cambio;
 *   2. se aplica el cambio — FullCalendar pinta en SÍNCRONO (`flushSync` dentro
 *      de `handleRenderRequest`, `@fullcalendar/core/index.js:2092-2100`), así
 *      que al volver de `aplicar()` el nodo ya está en su sitio nuevo;
 *   3. se vuelve a medir;
 *   4. se anima `translate(dx, dy) → none` con WAAPI, en `--ag-dur-base` y
 *      `--ag-ease` («lo que se mueve, las dos»).
 *
 * EL CONTRATO DEL DOM ES `[data-cita-id]`, fijado en F0: la raíz de cada
 * tarjeta (`MemoizedEventContent`, `MonthChip`, `FilaLista*`) lleva el id, y el
 * nodo que se anima es su `.fc-event` más cercano —el harness que FullCalendar
 * posiciona—. Hasta que la superficie (F1.4) ponga el atributo, `medirTarjeta`
 * no encuentra nada y `animarFlip` aplica el cambio sin animar: degrada a hoy.
 *
 * ⚠️ EN LISTAS NO HAY TRASLACIÓN, SÓLO UN FUNDIDO. La fila es un `<tr>`
 * (`.fc-list-event`) y un `transform` sobre una fila de tabla la despega de la
 * rejilla de celdas mientras dura: la misma lección que `ag-entra`
 * (`globals.css`, nota junto al keyframe).
 *
 * ⚠️ CON MOVIMIENTO REDUCIDO SE APLICA EL CAMBIO Y NO SE ANIMA. El bloque CSS de
 * `prefers-reduced-motion` no alcanza a WAAPI; la guarda va aquí.
 *
 * Sin dependencias: WAAPI es nativo. `motion` no se usa (diseño F §2).
 */
import { curvaToken, duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'

/** Lo que se lee de `getBoundingClientRect()`. */
export interface Rect { left: number; top: number; width: number; height: number }

/** Lo mínimo de un `Element` que hace falta; un `HTMLElement` lo cumple. */
export interface NodoAnimable {
  getBoundingClientRect(): Rect
  animate(fotogramas: Keyframe[], opciones: KeyframeAnimationOptions): unknown
  closest(selector: string): NodoAnimable | null
  matches(selector: string): boolean
}

/** Donde se buscan las tarjetas: la raíz de la agenda o el `document`. */
export interface RaizTarjetas { querySelector(selector: string): NodoAnimable | null }

/** Menos de medio píxel no es un movimiento: es redondeo de subpíxel. */
const UMBRAL_PX = 0.5

/**
 * El selector de la tarjeta de una cita. Con `JSON.stringify` y no con
 * `CSS.escape` (que no existe fuera del navegador): una cadena JSON entre
 * comillas dobles es también una cadena CSS válida, con `"` y `\` escapadas.
 */
export function selectorDeCita(id: string): string {
  return `[data-cita-id=${JSON.stringify(id)}]`
}

/** El `.fc-event` de una cita (el nodo que FullCalendar posiciona), o `null`. */
export function nodoDeCita(raiz: RaizTarjetas, id: string): NodoAnimable | null {
  return raiz.querySelector(selectorDeCita(id))?.closest('.fc-event') ?? null
}

/** El rectángulo de la tarjeta de una cita, o `null` si no está pintada. */
export function medirTarjeta(raiz: RaizTarjetas, id: string): Rect | null {
  return nodoDeCita(raiz, id)?.getBoundingClientRect() ?? null
}

/** Cuánto hay que desplazar el nodo nuevo para que parezca estar donde estaba. `null` = no se movió. */
export function deltaFlip(antes: Rect | null, despues: Rect | null): { dx: number; dy: number } | null {
  if (!antes || !despues) return null
  const dx = antes.left - despues.left
  const dy = antes.top - despues.top
  if (Math.abs(dx) < UMBRAL_PX && Math.abs(dy) < UMBRAL_PX) return null
  return { dx, dy }
}

/** Los dos fotogramas de la traslación. Sin `to` implícito: el último es `none`. */
export function fotogramasFlip(d: { dx: number; dy: number }): Keyframe[] {
  return [{ transform: `translate(${d.dx}px, ${d.dy}px)` }, { transform: 'none' }]
}

/** El fundido de las listas: aparece en su sitio nuevo, sin moverse. */
export const FOTOGRAMAS_FUNDIDO: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }]

export type ResultadoFlip = 'trasladada' | 'fundida' | 'sin-animar'

/**
 * Mide, aplica el cambio, vuelve a medir y anima. `aplicar` se llama SIEMPRE,
 * una vez, pase lo que pase: animar es opcional, el cambio no.
 */
export function animarFlip(raiz: RaizTarjetas, id: string, aplicar: () => void): ResultadoFlip {
  if (prefiereMenosMovimiento()) { aplicar(); return 'sin-animar' }
  const antes = medirTarjeta(raiz, id)
  aplicar()
  const nodo = nodoDeCita(raiz, id)
  if (!antes || !nodo) return 'sin-animar'
  const d = deltaFlip(antes, nodo.getBoundingClientRect())
  if (!d) return 'sin-animar'
  const duration = duracionToken('--ag-dur-base')
  if (nodo.matches('.fc-list-event')) {
    nodo.animate(FOTOGRAMAS_FUNDIDO, { duration, easing: curvaToken('--ag-ease-out') })
    return 'fundida'
  }
  nodo.animate(fotogramasFlip(d), { duration, easing: curvaToken('--ag-ease') })
  return 'trasladada'
}
