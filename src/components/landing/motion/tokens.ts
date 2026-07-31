/**
 * Tokens de movimiento de la landing pública.
 *
 * Espejo en TypeScript de los tokens CSS que ya existen — NO es una escala
 * paralela. Cada valor de aquí tiene su origen declarado al lado:
 *
 *   - `--sp-dur-*` y `--sp-ease-*` viven en `src/app/spinus-tokens.css`
 *   - `--lp-*` es la extensión de landing, en `src/app/globals.css` (:root)
 *
 * Existe porque `motion` recibe duraciones en **segundos** y easings como
 * tupla de bezier, no como string CSS: no puede leer `var(--sp-dur-base)`.
 * Si un token CSS cambia, este archivo se actualiza a mano.
 *
 * Regla permanente (CLAUDE.md §Landing, regla 1): ningún componente de la
 * landing usa una duración, easing o distancia que no salga de aquí.
 */

/** Tupla de cubic-bezier tal como la consume `motion` (equivale a su `BezierDefinition`). */
type Bezier = readonly [number, number, number, number]

/** Duraciones en SEGUNDOS (motion no acepta ms). */
export const DUR = {
  /** 120ms — hover, feedback. Origen: `--sp-dur-micro`. */
  micro: 0.12,
  /** 240ms — reveal de card. Origen: `--sp-dur-base`. */
  base: 0.24,
  /** 420ms — entrada de sección. Origen: `--lp-dur-section`. */
  section: 0.42,
  /** 900ms — escenario cinematográfico (los 4 momentos Apple). Origen: `--lp-dur-cine`. */
  cine: 0.9,
} as const

/** Easings como tupla de bezier. */
export const EASE = {
  /** Registro Linear: todo el tejido de la página. Origen: `--sp-ease-out`. */
  out: [0.2, 0, 0, 1] as Bezier,
  /** Registro Apple: SOLO los 4 escenarios. Origen: `--lp-ease-cine`. */
  cine: [0.65, 0, 0.35, 1] as Bezier,
} as const

/** Distancias de desplazamiento en px. Solo se aplican vía `transform`. */
export const DIST = {
  /** 24px — desplazamiento vertical de todo reveal. PLAN §2.3. */
  reveal: 24,
} as const

/** Retrasos incrementales en SEGUNDOS. */
export const STAGGER = {
  /** 70ms entre hermanos (grids, cards). PLAN §2.3. */
  siblings: 0.07,
  /** 80ms en listas secuenciales (pasos, timeline). PLAN §2.3. */
  list: 0.08,
  /**
   * 90ms — mazo abanicado de documentos (SeccionControl). Tercer peldaño de
   * la escalera 70/80/90: los 3 elementos se solapan en el espacio, así que
   * necesitan más separación en el tiempo que unos hermanos en retícula para
   * que se lea el orden de apilado.
   *
   * ⚠️ Es un valor NUEVO, no venía de §4.2 del maestro. Se declara aquí
   * porque la regla permanente 1 de CLAUDE.md prohíbe números sueltos en los
   * componentes, no porque el sistema pidiera un tercer escalón. Si en QA se
   * decide que 80ms basta, este token desaparece y `deck` pasa a `list`.
   */
  deck: 0.09,
} as const

/**
 * Springs. Espejo de §4.2 del maestro, que los declara pero que hasta ahora
 * no estaban en este archivo — `motion` los consume como objeto, no como
 * variable CSS, así que no tienen contrapartida en globals.css.
 */
export const SPRING = {
  /** Entradas de escenario: llega y asienta sin rebote visible. §4.2. */
  soft: { type: 'spring', stiffness: 120, damping: 20 },
  /** Respuesta inmediata de control. §4.2. Sin consumidores todavía. */
  snap: { type: 'spring', stiffness: 300, damping: 30 },
  /** Masa alta, para lo que debe sentirse pesado. §4.2. Sin consumidores. */
  heavy: { type: 'spring', stiffness: 60, damping: 18 },
} as const

/**
 * Tramos de scroll para `useScroll({ offset })`. Espejo de §4.2.
 * Sintaxis de motion: "<borde del target> <borde del contenedor>".
 */
export const OFFSETS = {
  /** Entrada: del 90% al 35% del viewport. §4.2 OFF_ENTRADA. */
  entrada: ['start 0.9', 'start 0.35'],
  /** Travesía completa del elemento por el viewport. §4.2 OFF_TRAVESIA. */
  travesia: ['start end', 'end start'],
  /** Anclado (escenarios sticky). §4.2 OFF_ANCLADO. */
  anclado: ['start start', 'end end'],
} as const
