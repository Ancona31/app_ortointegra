/**
 * Geometría y reducción de la foto de identificación — GUIA_FORMULARIOS_05 §6.
 *
 * Módulo NEUTRO: sin `'use client'` y sin ningún import, igual que
 * `firmaTrazo.ts` y por la misma razón — los números tienen una procedencia que
 * hay que poder leer sin abrir la interfaz de captura.
 *
 * ── DE DÓNDE SALE LA PROPORCIÓN ─────────────────────────────────────────────
 * De la caja del anexo del PDF: **228 × 144 pt**, que es la que replica el v1 de
 * `ConsentimientoInformadoPdf.tsx` desde la del formato v2
 * (`src/lib/pdf/v2/formatos/ConsentimientoInformado.tsx`, constante `ANEXO`).
 * El marco guía de la cámara y el recorte del selector de archivo usan ESTA
 * proporción y ninguna otra: lo encuadrado es lo impreso, sin recortes
 * posteriores. Si la caja del anexo cambia, este archivo cambia con ella.
 *
 * ── Y POR QUÉ SE REDUCE ANTES DE SUBIR ──────────────────────────────────────
 * Una foto de móvil son varios megabytes y casi todo es ruido del sensor. El
 * bucket topa en 5 MB (`20260813_firmas_documento.sql`, bloque D), así que el
 * original entraría — pero viaja por una red de consultorio, se guarda para
 * siempre y después hay que traerlo de vuelta al navegador para incrustarlo en
 * el PDF. Un documento legible cabe en unos cientos de kilobytes.
 */

/** Ancho de la caja del anexo, en puntos. */
export const CAJA_ANCHO_PT = 228
/** Alto de la caja del anexo, en puntos. */
export const CAJA_ALTO_PT = 144
/** 1,583 — la proporción del marco guía y del recorte. */
export const PROPORCION = CAJA_ANCHO_PT / CAJA_ALTO_PT

/**
 * Ancho de la imagen reducida. 1400 px sobre 228 pt son 442 dpi a lo ancho de
 * la caja impresa: de sobra para leer un número de credencial, y muy por debajo
 * de los 3000-4000 px que entrega una cámara de teléfono.
 */
export const ANCHO_SALIDA = 1400

/** Calidad del JPEG. Por encima de .85 el peso sube sin que la credencial se lea mejor. */
const CALIDAD = 0.82

/**
 * Los dos que el generador de PDF sabe incrustar, y los dos únicos que admite
 * `allowed_mime_types` del bucket. Una foto en webp subiría sin problema desde
 * el navegador y rompería el documento al incrustarla.
 */
export const TIPOS_ADMITIDOS = ['image/jpeg', 'image/png'] as const

/** El recorte centrado que deja la fuente en la proporción de la caja del anexo. */
export interface Recorte {
  x: number
  y: number
  ancho: number
  alto: number
}

/**
 * Recorte CENTRADO a la proporción del anexo. Se queda con la banda que cabe:
 * si la fuente es más apaisada que la caja, sobra ancho; si es más alta, sobra
 * alto. Es el mismo encuadre que el marco guía enseñaba al disparar.
 */
export function recorteCentrado(ancho: number, alto: number): Recorte {
  if (ancho <= 0 || alto <= 0) return { x: 0, y: 0, ancho: 1, alto: 1 }
  if (ancho / alto > PROPORCION) {
    const nuevoAncho = Math.round(alto * PROPORCION)
    return { x: Math.round((ancho - nuevoAncho) / 2), y: 0, ancho: nuevoAncho, alto }
  }
  const nuevoAlto = Math.round(ancho / PROPORCION)
  return { x: 0, y: Math.round((alto - nuevoAlto) / 2), ancho, alto: nuevoAlto }
}

/** Lo que se dibuja: un `<video>` en marcha o una imagen ya cargada. */
export type FuenteFoto = HTMLVideoElement | HTMLImageElement

/** Las medidas reales de la fuente, que no son las de su caja en pantalla. */
function medidasDe(fuente: FuenteFoto): { ancho: number; alto: number } {
  return fuente instanceof HTMLVideoElement
    ? { ancho: fuente.videoWidth, alto: fuente.videoHeight }
    : { ancho: fuente.naturalWidth, alto: fuente.naturalHeight }
}

/**
 * Recorta a la proporción del anexo, reduce a `ANCHO_SALIDA` y codifica a JPEG.
 *
 * JPEG y no PNG: una fotografía en PNG pesa varias veces más sin ganar nada
 * —no hay transparencia que preservar, al revés que en el trazo de la firma—.
 * Devuelve `null` si la fuente todavía no tiene medidas o el canvas no da
 * contexto; quien llama lo trata como «sin foto», que nunca bloquea.
 */
export async function prepararFoto(fuente: FuenteFoto): Promise<Blob | null> {
  const { ancho, alto } = medidasDe(fuente)
  if (ancho <= 0 || alto <= 0) return null

  const r = recorteCentrado(ancho, alto)
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.min(ANCHO_SALIDA, r.ancho)
  lienzo.height = Math.round(lienzo.width / PROPORCION)
  const ctx = lienzo.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(fuente, r.x, r.y, r.ancho, r.alto, 0, 0, lienzo.width, lienzo.height)
  return new Promise(resolve => {
    lienzo.toBlob(blob => resolve(blob), 'image/jpeg', CALIDAD)
  })
}

/**
 * Carga un archivo elegido en un `<img>` para poder recortarlo. Rechaza si el
 * navegador no lo sabe decodificar, que es lo que pasa con un archivo que dice
 * ser una imagen y no lo es.
 */
export function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMAGEN_ILEGIBLE')) }
    img.src = url
  })
}
