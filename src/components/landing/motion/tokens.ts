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
} as const
