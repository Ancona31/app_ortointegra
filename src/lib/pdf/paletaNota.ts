/**
 * paletaNota.ts — deriva la paleta de NotaEvolucionPdf desde el color primario
 * (y secundario) del perfil del médico, manteniendo la jerarquía visual del
 * mockup original.
 *
 * Módulo PURO y neutro (sin dependencias de cliente/servidor, sin react-pdf):
 * recibe hex por parámetro y devuelve una {@link PaletaNota} de 8 roles. Los
 * neutros (texto de cuerpo, etiquetas grises, separadores) y la familia
 * addendum (rojo semántico) NO se derivan aquí — viven como literales en la
 * plantilla.
 *
 * Contraste: guardas WCAG con linearización sRGB. textStrong se oscurece hasta
 * AA (≥4.5) sobre blanco; los textos claros de la cabecera de vitales se ajustan
 * sobre `structure` (≥4.5 el título, ≥3.0 la sub-etiqueta decorativa).
 */

export interface PaletaNota {
  /** Títulos y nombres — shade oscuro del primario, AA sobre blanco. */
  textStrong: string
  /** Reglas, acentos de borde, fondo de cabecera de vitales, línea de firma. */
  structure: string
  /** Especialidad, eyebrow, kickers, números de sección, tag de expediente. */
  accent: string
  /** Barra de acento vertical de las secciones. */
  accentSoft: string
  /** Fondo muy claro de las cards. */
  bgSoft: string
  /** Borde suave (chip del logo, chip de fecha). */
  borderSoft: string
  /** Texto principal de la cabecera de vitales (sobre `structure`). */
  vitalsTitle: string
  /** Sub-etiqueta decorativa de la cabecera de vitales (sobre `structure`). */
  vitalsSub: string
}

/**
 * Paleta azul EXACTA del mockup. Es el fallback total cuando no hay color de
 * perfil (o es inválido) y la referencia contra la que se testea la derivación.
 */
export const PALETA_FALLBACK: PaletaNota = {
  textStrong: '#0b2540',
  structure: '#102f50',
  accent: '#1f5f9e',
  accentSoft: '#2b74bd',
  bgSoft: '#eef4fa',
  borderSoft: '#dbe8f4',
  vitalsTitle: '#dce8f4',
  vitalsSub: '#9db8d3',
}

/* ------------------------------------------------------------------ */
/*  Utilidades de color                                                */
/* ------------------------------------------------------------------ */

type RGB = { r: number; g: number; b: number }

/** Acepta '#rgb' o '#rrggbb' (con o sin '#'). Devuelve null si no es hex válido. */
function parseHex(hex: string | undefined | null): RGB | null {
  if (typeof hex !== 'string') return null
  const clean = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return { r, g, b }
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    }
  }
  return null
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/**
 * Mezcla RGB real: `ratio` es la proporción de `hexB` (0 = todo A, 1 = todo B).
 * Si `hexA` es inválido devuelve `hexB` normalizado (guard defensivo).
 */
export function mix(hexA: string, hexB: string, ratio: number): string {
  const a = parseHex(hexA)
  const b = parseHex(hexB)
  if (!a || !b) return toHex(b ?? a ?? { r: 0, g: 0, b: 0 })
  const r = Math.max(0, Math.min(1, ratio))
  return toHex({
    r: a.r + (b.r - a.r) * r,
    g: a.g + (b.g - a.g) * r,
    b: a.b + (b.b - a.b) * r,
  })
}

/** Luminancia relativa WCAG (linearización sRGB). Rango 0..1. */
export function luminanciaRelativa(hex: string): number {
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 }
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b)
}

/** Ratio de contraste WCAG entre dos colores (1..21). */
export function ratioContraste(hexA: string, hexB: string): number {
  const la = luminanciaRelativa(hexA)
  const lb = luminanciaRelativa(hexB)
  const claro = Math.max(la, lb)
  const oscuro = Math.min(la, lb)
  return (claro + 0.05) / (oscuro + 0.05)
}

/**
 * Empuja `color` en pasos de 5% hacia `hacia` ('#000' oscurece, '#fff' aclara)
 * hasta alcanzar `objetivo` de contraste contra `fondo`, o agotar los pasos.
 */
function ajustarHastaContraste(color: string, fondo: string, objetivo: number, hacia: string): string {
  let actual = color
  for (let i = 0; i < 40 && ratioContraste(actual, fondo) < objetivo; i++) {
    actual = mix(actual, hacia, 0.05)
  }
  return actual
}

/* ------------------------------------------------------------------ */
/*  Derivación                                                         */
/* ------------------------------------------------------------------ */

/**
 * Deriva la paleta de la nota desde el primario `cp` (y secundario `cs`).
 * Sin `cp` válido → {@link PALETA_FALLBACK} exacto (fallback total).
 *
 * - textStrong: shade ~75% negro, oscurecido hasta AA (≥4.5) sobre blanco.
 * - structure: shade ~65% negro (fondo oscuro de la cabecera de vitales y color
 *   de reglas/bordes/firma). El contraste con los textos claros se garantiza
 *   ajustando esos textos (vitalsTitle/vitalsSub), no `structure`, para evitar
 *   una dependencia circular entre ambos.
 * - accent = cp; accentSoft = cs (fallback tint leve del primario).
 * - bgSoft/borderSoft: tints muy claros del primario.
 * - vitalsTitle: tint claro ajustado a ≥4.5 sobre structure.
 * - vitalsSub: tint medio ajustado a ≥3.0 sobre structure (sub-etiqueta pequeña
 *   decorativa; si no alcanza 4.5 con estética razonable se acepta ≥3.0).
 */
export function derivarPaletaNota(cp?: string, cs?: string): PaletaNota {
  if (!parseHex(cp)) return { ...PALETA_FALLBACK }
  const primario = cp as string

  const textStrong = ajustarHastaContraste(mix(primario, '#000', 0.75), '#ffffff', 4.5, '#000')
  const structure = mix(primario, '#000', 0.65)

  const accent = primario
  const accentSoft = parseHex(cs) ? (cs as string) : mix(primario, '#fff', 0.15)

  const bgSoft = mix(primario, '#fff', 0.93)
  const borderSoft = mix(primario, '#fff', 0.85)

  const vitalsTitle = ajustarHastaContraste(mix(primario, '#fff', 0.87), structure, 4.5, '#fff')
  const vitalsSub = ajustarHastaContraste(mix(primario, '#fff', 0.62), structure, 3.0, '#fff')

  return { textStrong, structure, accent, accentSoft, bgSoft, borderSoft, vitalsTitle, vitalsSub }
}
