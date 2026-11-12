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
 *      a ninguno de los dos lados (columna ancha de la vista Día), DEBAJO, y si
 *      tampoco, ENCIMA. Lo que no se hace nunca es tapar el ancla pudiendo no
 *      taparla: es lo que el usuario acaba de tocar.
 *   2. En el eje que queda libre, alineada con el ancla (o con el punto pulsado)
 *      y AJUSTADA a la ventana con un margen.
 *   3. El `transform-origin` es el punto pulsado (o el centro del ancla), en
 *      coordenadas de la capa y recortado a su caja: la entrada crece «desde
 *      donde se pulsó» (diseño F §2, decisión 4).
 *
 * Pura: sin DOM. El componente mide y pinta.
 */

export interface Caja { left: number; top: number; width: number; height: number }
export interface Tamano { width: number; height: number }
export interface Punto { x: number; y: number }

export type LadoCapa = 'derecha' | 'izquierda' | 'abajo' | 'arriba'

export interface PosicionCapa {
  left: number
  top: number
  lado: LadoCapa
  /** Listo para `style.transformOrigin`, p. ej. «0px 24px». */
  origen: string
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

function acotar(v: number, min: number, max: number): number {
  return max < min ? min : Math.min(Math.max(v, min), max)
}

/** El lado que toca y la coordenada del eje principal. */
function elegirLado(ancla: Caja, capa: Tamano, ventana: Tamano): { lado: LadoCapa; valor: number } {
  const der = ancla.left + ancla.width + SEPARACION_CAPA
  if (der + capa.width <= ventana.width - MARGEN_VENTANA) return { lado: 'derecha', valor: der }
  const izq = ancla.left - SEPARACION_CAPA - capa.width
  if (izq >= MARGEN_VENTANA) return { lado: 'izquierda', valor: izq }
  const abajo = ancla.top + ancla.height + SEPARACION_CAPA
  if (abajo + capa.height <= ventana.height - MARGEN_VENTANA) return { lado: 'abajo', valor: abajo }
  return { lado: 'arriba', valor: ancla.top - SEPARACION_CAPA - capa.height }
}

/** La posición de la capa. `punto`: dónde se pulsó, si se sabe. */
export function posicionCapa(ancla: Caja, capa: Tamano, ventana: Tamano, punto?: Punto): PosicionCapa {
  const { lado, valor } = elegirLado(ancla, capa, ventana)
  const ref = punto ?? { x: ancla.left + ancla.width / 2, y: ancla.top + ancla.height / 2 }
  const maxLeft = ventana.width - MARGEN_VENTANA - capa.width
  const maxTop = ventana.height - MARGEN_VENTANA - capa.height
  const horizontal = lado === 'derecha' || lado === 'izquierda'
  const left = acotar(horizontal ? valor : ref.x - capa.width / 2, MARGEN_VENTANA, maxLeft)
  const alto = punto ? punto.y - SUBIDA_CAPA : ancla.top
  const top = acotar(horizontal ? alto : valor, MARGEN_VENTANA, maxTop)
  const ox = acotar(ref.x - left, 0, capa.width)
  const oy = acotar(ref.y - top, 0, capa.height)
  return { left: Math.round(left), top: Math.round(top), lado, origen: `${Math.round(ox)}px ${Math.round(oy)}px` }
}
