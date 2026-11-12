/**
 * src/lib/agenda/gestoDeslizar.ts
 *
 * El gesto de deslizar el dedo para cambiar de día o de semana en las listas
 * del teléfono (bloque F, F3.7, detrás del interruptor). Puro: recibe
 * coordenadas y tiempos y decide; `useDeslizarPeriodo` pone los eventos de
 * puntero y el `transform`.
 *
 * Reglas del diseño (F §3.7):
 *   · La DIRECCIÓN se decide a los 10 px de recorrido. Si gana el eje vertical,
 *     el gesto se suelta entero: es el desplazamiento nativo de la lista, y
 *     `touch-action: pan-y` lo deja en manos del navegador.
 *   · Se pasa de periodo con 64 px de recorrido O con 0.4 px/ms de velocidad
 *     (un golpe corto y rápido también vale).
 *   · Se IGNORA lo que empieza a 20 px o menos de un borde: ahí viven los gestos
 *     del sistema (atrás en Android e iOS), y robarlos es peor que no tener
 *     el nuestro.
 *   · Hacia la izquierda (dx < 0) = periodo SIGUIENTE, como pasar una página.
 *
 * Mientras se arrastra, la vista sigue al dedo con RESISTENCIA: el recorrido
 * visible crece cada vez menos, para que se lea como «tirar» y no como un
 * carrusel suelto. Es manipulación directa, no una animación añadida.
 */

export const DECIDIR_EJE_PX = 10
export const UMBRAL_PX = 64
export const UMBRAL_VELOCIDAD = 0.4 // px/ms
export const BORDE_IGNORADO_PX = 20

export type EjeGesto = 'horizontal' | 'vertical' | null

export interface EstadoGesto {
  x0: number
  y0: number
  t0: number
  eje: EjeGesto
  /** Empezó en el borde: no se hace nada con él. */
  ignorado: boolean
  dx: number
}

export type DesenlaceGesto = 'siguiente' | 'anterior' | null

/** Al apoyar el dedo. `ancho`: el de la vista, para saber dónde están los bordes. */
export function iniciarGesto(x: number, y: number, t: number, ancho: number): EstadoGesto {
  const ignorado = x <= BORDE_IGNORADO_PX || x >= ancho - BORDE_IGNORADO_PX
  return { x0: x, y0: y, t0: t, eje: null, ignorado, dx: 0 }
}

/**
 * Al mover el dedo. Devuelve el estado nuevo; `eje` se fija una sola vez, al
 * pasar de 10 px en cualquier dirección.
 */
export function moverGesto(e: EstadoGesto, x: number, y: number): EstadoGesto {
  if (e.ignorado || e.eje === 'vertical') return e
  const dx = x - e.x0
  const dy = y - e.y0
  if (e.eje === null) {
    if (Math.hypot(dx, dy) < DECIDIR_EJE_PX) return { ...e, dx: 0 }
    const eje: EjeGesto = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
    return { ...e, eje, dx: eje === 'horizontal' ? dx : 0 }
  }
  return { ...e, dx }
}

/** Cuánto se mueve la vista para un recorrido del dedo: lineal hasta el umbral y amortiguado después. */
export function resistencia(dx: number): number {
  const s = Math.sign(dx)
  const a = Math.abs(dx)
  if (a <= UMBRAL_PX) return dx * 0.6
  return s * (UMBRAL_PX * 0.6 + (a - UMBRAL_PX) * 0.2)
}

/** Al levantar el dedo: si pasa de periodo, en qué sentido. */
export function terminarGesto(e: EstadoGesto, t: number): DesenlaceGesto {
  if (e.ignorado || e.eje !== 'horizontal' || e.dx === 0) return null
  const dt = Math.max(1, t - e.t0)
  const pasa = Math.abs(e.dx) >= UMBRAL_PX || Math.abs(e.dx) / dt >= UMBRAL_VELOCIDAD
  if (!pasa) return null
  return e.dx < 0 ? 'siguiente' : 'anterior'
}
