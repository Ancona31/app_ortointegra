/**
 * src/lib/agenda/movimientoAgenda.ts
 *
 * La escala de movimiento de la agenda vista desde JS (bloque F, F0). La
 * verdad son los tokens de `globals.css` —`--ag-dur-micro/base/lento` y
 * `--ag-ease-out/in/ease`—: este módulo los LEE, no los copia, para que lo
 * que se anima con WAAPI (FLIP, fundido de navegación, temporizador de
 * salida, vuelta del deslizamiento) no pueda divergir de lo que se anima con
 * CSS.
 *
 * ⚠️ LOS RESPALDOS NO SON UNA SEGUNDA ESCALA. Valen sólo cuando no hay
 * `document` (render de servidor, Vitest en `node`) o el token no se pudo leer.
 * Si cambias un token en la hoja, cambia aquí su respaldo en el mismo commit.
 *
 * ⚠️ `prefers-reduced-motion` TAMBIÉN SE MIRA AQUÍ, y no es redundante con el
 * bloque de movimiento reducido de `globals.css`: aquel neutraliza
 * `animation-duration`/`transition-duration` de las reglas CSS, pero no puede
 * tocar un `element.animate()`. Todo lo que se anime desde JS pregunta antes a
 * `prefiereMenosMovimiento()`.
 *
 * También vive aquí la REGLA que se comprueba en las e2e
 * (`incumplimientosDeMovimiento`): sólo `opacity` y `transform`, y nada por
 * encima de 240 ms. Es pura para poder probarla con Vitest; la extracción de
 * `document.getAnimations()` la hace `e2e/movimientoAyudas.ts`.
 */

export type TokenDuracion = '--ag-dur-micro' | '--ag-dur-base' | '--ag-dur-lento'
export type TokenCurva = '--ag-ease-out' | '--ag-ease-in' | '--ag-ease'

const RESPALDO_DURACION: Record<TokenDuracion, number> = {
  '--ag-dur-micro': 120,
  '--ag-dur-base': 180,
  '--ag-dur-lento': 240,
}

const RESPALDO_CURVA: Record<TokenCurva, string> = {
  '--ag-ease-out': 'cubic-bezier(0, 0, .2, 1)',
  '--ag-ease-in': 'cubic-bezier(.4, 0, 1, 1)',
  '--ag-ease': 'cubic-bezier(.4, 0, .2, 1)',
}

/** El tope de la escala. Nada de la agenda dura más (CONTRASTE §2.1). */
export const TOPE_MOVIMIENTO_MS = 240

/**
 * Lee una duración CSS («120ms», «.18s», «0.01ms») y la devuelve en
 * milisegundos. `null` si no es una duración: así el llamador cae al respaldo
 * en vez de animar con `NaN`.
 */
export function interpretarDuracion(valor: string): number | null {
  const m = /^\s*(\d*\.?\d+)\s*(ms|s)\s*$/i.exec(valor)
  if (!m) return null
  const n = Number(m[1])
  return m[2].toLowerCase() === 's' ? n * 1000 : n
}

function leerToken(token: string, el?: Element): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return ''
  const objetivo = el ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!objetivo) return ''
  try { return getComputedStyle(objetivo).getPropertyValue(token).trim() } catch { return '' }
}

/**
 * La duración de un token en ms, leída del nodo (o de la raíz). NO mira el
 * movimiento reducido: para eso está `duracionMovimiento`.
 */
export function duracionToken(token: TokenDuracion, el?: Element): number {
  return interpretarDuracion(leerToken(token, el)) ?? RESPALDO_DURACION[token]
}

/** La curva de un token, lista para `element.animate({ easing })`. */
export function curvaToken(token: TokenCurva, el?: Element): string {
  return leerToken(token, el) || RESPALDO_CURVA[token]
}

/**
 * `true` si el sistema pide menos movimiento. Sin `window` o sin `matchMedia`
 * contesta `false`: en servidor no se anima nada de todos modos.
 */
export function prefiereMenosMovimiento(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * La duración que de verdad hay que esperar o animar: la del token, o 0 con
 * movimiento reducido. Es la que usan los temporizadores de salida, para que
 * con `reduce` la cita se quite al instante y no 120 ms después.
 */
export function duracionMovimiento(token: TokenDuracion, el?: Element): number {
  return prefiereMenosMovimiento() ? 0 : duracionToken(token, el)
}

/* ── La regla, en puro ─────────────────────────────────────────────────── */

/** Una animación tal como la extrae `e2e/movimientoAyudas.ts` del navegador. */
export interface AnimacionObservada {
  /** `animationName` (CSS), `transitionProperty` (transición) o `id` (WAAPI). */
  nombre: string
  propiedades: string[]
  duracionMs: number
  /** Selector corto del elemento, sólo para el mensaje. */
  elemento: string
}

export interface ReglaMovimiento {
  /** Nombres que la regla no mira (p. ej. el bucle `ag-barra-carga`). */
  excepciones: readonly string[]
  topeMs: number
}

export const REGLA_AGENDA: ReglaMovimiento = {
  /* El rastro de la barra de carga es un BUCLE de 1.1 s documentado junto a su
     regla en `globals.css`: no es una transición de la escala. */
  excepciones: ['ag-barra-carga'],
  topeMs: TOPE_MOVIMIENTO_MS,
}

const PROPIEDADES_PERMITIDAS = new Set(['opacity', 'transform'])

/** Qué incumple una animación, en texto; `null` si cumple. */
export function motivoDeIncumplimiento(a: AnimacionObservada, regla: ReglaMovimiento): string | null {
  if (regla.excepciones.includes(a.nombre)) return null
  const malas = a.propiedades.filter(p => !PROPIEDADES_PERMITIDAS.has(p))
  const motivos: string[] = []
  if (malas.length) motivos.push(`anima ${malas.join(', ')}`)
  if (!Number.isFinite(a.duracionMs) || a.duracionMs > regla.topeMs) {
    motivos.push(`dura ${a.duracionMs} ms (tope ${regla.topeMs})`)
  }
  return motivos.length ? `${a.nombre} en ${a.elemento}: ${motivos.join('; ')}` : null
}

/** Todas las animaciones que incumplen, con su motivo. Vacío = la regla se cumple. */
export function incumplimientosDeMovimiento(
  animaciones: readonly AnimacionObservada[],
  regla: ReglaMovimiento = REGLA_AGENDA,
): string[] {
  return animaciones
    .map(a => motivoDeIncumplimiento(a, regla))
    .filter((m): m is string => m !== null)
}
