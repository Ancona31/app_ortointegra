/**
 * src/lib/agenda/posicionCapa.ts
 *
 * Dónde se pinta una capa flotante de la agenda (bloque F, F3): la burbuja de
 * alta rápida y la tarjeta de lectura. Las dos viven en un `Portal` con
 * `position: fixed`, así que su sitio se calcula en coordenadas de ventana a
 * partir del rectángulo del ancla (la franja seleccionada o la tarjeta pulsada).
 *
 * Reglas, en orden:
 *   1. A la DERECHA del ancla si cabe entera; si no, a la IZQUIERDA; si no cabe
 *      a ninguno de los dos lados (columna ancha de la vista Día), DEBAJO si cabe
 *      entera, y si no, ENCIMA. Lo que no se hace nunca es tapar el ancla
 *      pudiendo no taparla: es lo que el usuario acaba de tocar.
 *   2. En el eje que queda libre, alineada con el ancla (o con el punto pulsado)
 *      y AJUSTADA a la ventana con un margen.
 *   3. El `transform-origin` es el punto pulsado (o el centro del ancla), en
 *      coordenadas de la capa y recortado a su caja: la entrada crece «desde
 *      donde se pulsó» (diseño F §2, decisión 4).
 *
 * T1 (punto 3 de Angel: «la burbuja se corta cuando el hueco está al fondo»):
 *   4. NUNCA SALE DE LA VENTANA. Devuelve `altoMaximo`, que el componente pone
 *      como `max-height` (con desplazamiento interno): a un lado, el alto de la
 *      ventana menos los márgenes; arriba o abajo, el sitio que hay de ese lado.
 *      Si no cabe entera ni arriba ni abajo, va al lado con más sitio, acotada a
 *      él; y si ese sitio es menor que `ALTO_MINIMO_CAPA`, se acota a la ventana
 *      entera aunque tape el ancla (lo único peor que taparla es cortarse).
 *   5. La «ventana» es la parte VISIBLE (`visualViewport`): con el teclado del
 *      teléfono o de la tableta abierto, encoge; `left`/`top` son su
 *      desplazamiento dentro de la de layout (con zoom o con la página movida).
 *   6. El alto que se pasa es el NATURAL del contenido (`scrollHeight`), no el
 *      ya recortado: así, si el contenido encoge, la capa vuelve a su sitio.
 *
 * Pura: sin DOM. El componente mide y pinta (y vuelve a llamar cuando la capa
 * cambia de alto: resultados de búsqueda, botones tras agendar).
 */

export interface Caja { left: number; top: number; width: number; height: number }
export interface Tamano { width: number; height: number }
export interface Punto { x: number; y: number }
/** La parte visible de la ventana; sin `left`/`top`, empieza en 0. */
export interface Ventana extends Tamano { left?: number; top?: number }

export type LadoCapa = 'derecha' | 'izquierda' | 'abajo' | 'arriba'

export interface PosicionCapa {
  left: number
  top: number
  lado: LadoCapa
  /** Listo para `style.transformOrigin`, p. ej. «0px 24px». */
  origen: string
  /** Listo para `style.maxHeight`, en px: lo que cabe sin salir de la ventana. */
  altoMaximo: number
}

/* 8 px (`--ag-2`) entre el ancla y la capa, y 8 px contra el borde de la
   ventana. Son píxeles en JS porque `position: fixed` los necesita en número;
   el valor es el peldaño de la escala, no uno suelto. */
export const SEPARACION_CAPA = 8
export const MARGEN_VENTANA = 8
/* Al lado del ancla, la capa sube 24 px (`--ag-6`) sobre el punto pulsado para
   que su cabecera quede a la altura del dedo, no su borde. Sin punto, se alinea
   con el borde de arriba del ancla. */
export const SUBIDA_CAPA = 24
/* T1 · Por debajo de esto, encima o debajo del ancla no se usa con
   desplazamiento interno: 160 px son la cabecera y el primer campo de la
   burbuja. Con menos, mejor la ventana entera aunque tape el ancla. */
export const ALTO_MINIMO_CAPA = 160

function acotar(v: number, min: number, max: number): number {
  return max < min ? min : Math.min(Math.max(v, min), max)
}

interface Lado { lado: LadoCapa; valor: number; alto: number }

/** Arriba o abajo, con el alto que cabe de ese lado; `null` si ninguno sirve. */
function ladoVertical(ancla: Caja, alto: number, v: Required<Ventana>): Lado | null {
  const abajo = ancla.top + ancla.height + SEPARACION_CAPA
  const sitioAbajo = v.top + v.height - MARGEN_VENTANA - abajo
  const sitioArriba = ancla.top - SEPARACION_CAPA - (v.top + MARGEN_VENTANA)
  if (alto <= sitioAbajo) return { lado: 'abajo', valor: abajo, alto: sitioAbajo }
  if (alto <= sitioArriba) return { lado: 'arriba', valor: ancla.top - SEPARACION_CAPA - alto, alto: sitioArriba }
  if (Math.max(sitioAbajo, sitioArriba) < ALTO_MINIMO_CAPA) return null
  return sitioAbajo >= sitioArriba
    ? { lado: 'abajo', valor: abajo, alto: sitioAbajo }
    : { lado: 'arriba', valor: v.top + MARGEN_VENTANA, alto: sitioArriba }
}

/** El lado que toca, la coordenada del eje principal y el alto que cabe ahí. */
function elegirLado(ancla: Caja, capa: Tamano, v: Required<Ventana>): Lado {
  const altoVentana = Math.max(v.height - 2 * MARGEN_VENTANA, 0)
  const der = ancla.left + ancla.width + SEPARACION_CAPA
  if (der + capa.width <= v.left + v.width - MARGEN_VENTANA) return { lado: 'derecha', valor: der, alto: altoVentana }
  const izq = ancla.left - SEPARACION_CAPA - capa.width
  if (izq >= v.left + MARGEN_VENTANA) return { lado: 'izquierda', valor: izq, alto: altoVentana }
  const vertical = ladoVertical(ancla, Math.min(capa.height, altoVentana), v)
  if (vertical) return vertical
  /* Ni arriba ni abajo hay sitio útil (un arrastre que llena la columna):
     encima del ancla, acotada a la ventana. */
  return { lado: 'arriba', valor: v.top + MARGEN_VENTANA, alto: altoVentana }
}

/** La posición de la capa. `punto`: dónde se pulsó, si se sabe. */
export function posicionCapa(ancla: Caja, capa: Tamano, ventana: Ventana, punto?: Punto): PosicionCapa {
  const v: Required<Ventana> = { left: ventana.left ?? 0, top: ventana.top ?? 0, width: ventana.width, height: ventana.height }
  const { lado, valor, alto: altoMaximo } = elegirLado(ancla, capa, v)
  const alto = Math.min(capa.height, altoMaximo)
  const ref = punto ?? { x: ancla.left + ancla.width / 2, y: ancla.top + ancla.height / 2 }
  const maxLeft = v.left + v.width - MARGEN_VENTANA - capa.width
  const maxTop = v.top + v.height - MARGEN_VENTANA - alto
  const horizontal = lado === 'derecha' || lado === 'izquierda'
  const left = acotar(horizontal ? valor : ref.x - capa.width / 2, v.left + MARGEN_VENTANA, maxLeft)
  const deseado = punto ? punto.y - SUBIDA_CAPA : ancla.top
  const top = acotar(horizontal ? deseado : valor, v.top + MARGEN_VENTANA, maxTop)
  const ox = acotar(ref.x - left, 0, capa.width)
  const oy = acotar(ref.y - top, 0, alto)
  return {
    left: Math.round(left), top: Math.round(top), lado, origen: `${Math.round(ox)}px ${Math.round(oy)}px`,
    altoMaximo: Math.floor(altoMaximo),
  }
}

/**
 * La parte visible de la ventana a partir de `visualViewport` (si el navegador
 * lo tiene) y del tamaño de la de layout. Pura: el componente le pasa los dos.
 */
export function ventanaVisible(
  vv: { width: number; height: number; offsetLeft: number; offsetTop: number } | null | undefined, layout: Tamano,
): Ventana {
  if (!vv) return { left: 0, top: 0, width: layout.width, height: layout.height }
  return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height }
}
