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
 * (`incumplimientosDeMovimiento`): sólo `opacity` y `transform` (más los colores
 * de hover y foco), y nada por encima de 240 ms. Es pura para poder probarla con Vitest; la extracción de
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

/* ── El fundido de navegación (F2.3) ───────────────────────────────────── */

/** Lo que identifica lo pintado para decidir el fundido: el tipo de vista y el inicio del periodo. */
export interface MarcaDeVista { tipo: string; inicio: number }

/**
 * ¿El `datesSet` que llega es un cambio de FECHA dentro de la misma vista?
 * Sólo entonces hay fundido. No en el primero (la vista entera ya entra con
 * `ag-vista`), no al cambiar de tipo (ídem: `.fc-view` se vuelve a montar) y
 * no si el periodo no cambió —«Compactar» pliega días y reemite `datesSet`
 * con el mismo `currentStart`, y su plegado no se anima (CONTRASTE §2.8)—.
 */
export function esCambioDeFecha(previa: MarcaDeVista | null, actual: MarcaDeVista): boolean {
  return previa !== null && previa.tipo === actual.tipo && previa.inicio !== actual.inicio
}

/** De .7 a 1, SIN traslación (CONTRASTE §2.3: «ninguna traslación al cambiar de fecha»). */
export const FOTOGRAMAS_NAVEGACION: Keyframe[] = [{ opacity: 0.7 }, { opacity: 1 }]

/** Lo mínimo del armazón (`.fc-view-harness`) que hace falta; un `HTMLElement` lo cumple. */
export interface NodoFundido {
  animate(fotogramas: Keyframe[], opciones: KeyframeAnimationOptions): unknown
  closest(selector: string): object | null
  getAnimations(): ReadonlyArray<{ id: string; cancel(): void }>
}

/** El `id` de la animación del fundido, para encontrar la anterior y cortarla. */
export const ID_FUNDIDO_NAVEGACION = 'ag-fundido-navegacion'

/**
 * El fundido del armazón al cambiar de fecha, con WAAPI, en `--ag-dur-micro`
 * y `--ag-ease-out`. Devuelve si animó.
 *
 * ⚠️ NO PELEA CON LA ATENUACIÓN DE CARGA, y por dos razones: dura 120 ms y la
 * atenuación no aparece antes de 150 (`UMBRAL_CARGA_MS`), y si la rejilla YA
 * está atenuada —carga visible (`ag-cargando`) o lectura rota
 * (`ag-desactualizada`)— no se funde: subir a 1 encima de un .55 y volver de
 * golpe sería un destello. La atenuación es un estado y manda.
 * ⚠️ Con movimiento reducido no anima: el bloque CSS no alcanza a WAAPI.
 */
export function fundirNavegacion(armazon: NodoFundido | null): boolean {
  if (!armazon || prefiereMenosMovimiento()) return false
  /* Dos navegaciones seguidas: la anterior se corta, para que nunca corran dos
     fundidos a la vez sobre el armazón. Queda un borde aceptado: si la
     segunda llega antes de que la primera encienda la atenuación (150 ms), el
     fundido nuevo puede tapar hasta ~20 ms el arranque de la rampa a .55. */
  for (const a of armazon.getAnimations()) if (a.id === ID_FUNDIDO_NAVEGACION) a.cancel()
  if (armazon.closest('.ag-cargando, .ag-desactualizada')) return false
  armazon.animate(FOTOGRAMAS_NAVEGACION, {
    id: ID_FUNDIDO_NAVEGACION, duration: duracionToken('--ag-dur-micro'), easing: curvaToken('--ag-ease-out'),
  })
  return true
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
  /** `false` si el elemento no es de la agenda (la barra lateral, los avisos
      de toda la app): la regla es de la agenda y no lo mira. Sin el campo, cuenta. */
  deLaAgenda?: boolean
}

export interface ReglaMovimiento {
  /** Nombres que la regla no mira (p. ej. el bucle `ag-barra-carga`). */
  excepciones: readonly string[]
  topeMs: number
}

export const REGLA_AGENDA: ReglaMovimiento = {
  /* El rastro de la barra de carga es un BUCLE de 1.1 s documentado junto a su
     regla en `globals.css`: no es una transición de la escala. `spin` es el
     mismo papel: el giro del indicador de «guardando» de un botón (Tailwind
     `animate-spin`), un estado y no un movimiento de la escala. */
  excepciones: ['ag-barra-carga', 'spin'],
  topeMs: TOPE_MOVIMIENTO_MS,
}

/* `opacity` y `transform` es la regla de lo que SE MUEVE (no recalcula la
   rejilla). Los colores entran por CONTRASTE §5 y el diseño de F («Hover y
   foco: fondo y borde en `--ag-dur-micro`»): son el cambio de fondo, borde y
   tinta de hover y foco, que sólo repintan y que el diseño PIDE. Siguen fuera
   `width`, `height`, `top`, `left`, `box-shadow`, `outline-*`… y el tope de
   240 ms vale para todo. */
const PROPIEDADES_PERMITIDAS = new Set([
  'opacity', 'transform',
  'background-color', 'color', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
])

/** Qué incumple una animación, en texto; `null` si cumple. */
export function motivoDeIncumplimiento(a: AnimacionObservada, regla: ReglaMovimiento): string | null {
  if (regla.excepciones.includes(a.nombre) || a.deLaAgenda === false) return null
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
