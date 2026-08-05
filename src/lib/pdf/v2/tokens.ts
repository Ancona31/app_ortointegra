/**
 * Sistema de documentos v2 — tokens de geometría.
 *
 * ANDAMIAJE INERTE (Paso 0.a). Este módulo no tiene consumidores todavía y no
 * debe tenerlos hasta el Paso 1. Nada de aquí afecta a los 8 formatos vivos,
 * que siguen generándose con `src/lib/pdf/` (v1) sin cambio alguno.
 *
 * Alcance deliberado: SOLO geometría. Tipografía, color y filetes son el
 * Paso 1 y tienen su propia fuente de verdad en `DOCUMENTOS_SPEC.md` §I.1.
 * No agregues esos tokens aquí sin haber leído esa sección.
 *
 * Unidad: puntos PostScript (pt), la unidad nativa de @react-pdf/renderer.
 */

/** Hoja Carta en pt (8.5 × 11 in). */
export const PAPEL = {
  ancho: 612,
  alto: 792,
} as const

/** Caja de contenido: el área viva dentro de los márgenes. */
export const CAJA = {
  ancho: 486,
  alto: 670,
} as const

/**
 * Zona segura: banda perimetral que ninguna impresora de escritorio garantiza.
 * Nada imprimible debe entrar aquí.
 */
export const ZONA_SEGURA = 36

/** Márgenes de la hoja. Asimétricos: el izquierdo aloja el riel. */
export const MARGEN = {
  superior: 54,
  izquierdo: 72,
  derecho: 54,
  inferior: 68,
} as const

/** Retícula de 12 columnas sobre la caja de contenido. */
export const RETICULA = {
  columnas: 12,
  /** Ancho de una columna. */
  columna: 32.25,
  /** Separación entre columnas. */
  medianil: 9,
  /** Ancho del riel (columna de etiquetas a la izquierda del contenido). */
  riel: 23.25,
  /** Interlínea base: toda altura vertical es múltiplo de este valor. */
  lineaBase: 16,
} as const

/** Alto de una celda del riel. */
export const RIEL_CELDA = 40.5
