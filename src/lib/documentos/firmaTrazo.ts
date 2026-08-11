/**
 * Geometría del trazo de firma — GUIA_FORMULARIOS_05 §5.5.
 *
 * Módulo NEUTRO: sin `'use client'` y sin ningún import. Todo lo de aquí son
 * números derivados de la celda impresa y dos funciones que solo tocan un
 * canvas que le entregan. Vive fuera del componente porque los números tienen
 * una procedencia que hay que poder leer sin abrir 600 líneas de interfaz.
 *
 * ── DE DÓNDE SALEN LOS NÚMEROS ──────────────────────────────────────────────
 * De `ConsentimientoInformadoPdf.tsx`: página LETTER (612 pt) con
 * `paddingHorizontal: 50` → 512 pt de contenido, y `FirmaBox` al 48 % →
 * 245,76 pt de ancho con 48 pt de alto libre sobre la línea de firma.
 *
 *   Celda impresa      245,76 × 48 pt = 86,7 × 16,9 mm
 *   Ancho del bitmap   245,76 pt ÷ 72 × 300 dpi = 1024,0 px — exacto
 *   Milímetro por px   86,7 ÷ 1024 = 0,0847 mm
 *   Grosor             0,6 mm ÷ 0,0847 = 7,08 → 7 px de bitmap
 *
 * ⚠ SI `FirmaBox` CAMBIA DE ANCHO, ESTE ARCHIVO ENTERO HAY QUE REHACERLO. Los
 * 1024 y el 7 se derivan de esos 245,76 pt y de nada más.
 */

/**
 * Ancho del mapa de bits, FIJO y explícitamente NO `devicePixelRatio`.
 *
 * Ahí está lo que hace que la firma sea la misma desde el móvil y desde el
 * iPad: el teléfono suele traer dpr 3 y el iPad dpr 2, así que atar el mapa de
 * bits al dispositivo es justo lo que produce dos archivos distintos, con
 * distinto detalle y distinto peso, del mismo gesto.
 */
export const ANCHO_BITMAP = 1024

/**
 * El ancho al que se REEXPORTA si el data-URL se pasa del presupuesto. Siguen
 * siendo 225 dpi a lo ancho de la celda impresa: una firma capturada no se
 * pierde por un presupuesto.
 */
export const ANCHO_REDUCIDO = 768

/**
 * Grosor en píxeles DEL MAPA DE BITS, no de pantalla. Es la única forma de que
 * el milímetro impreso sea constante. Consecuencia aceptada: en pantalla el
 * trazo mide 2,2 px CSS en XS y 5,2 px a 788. Varía en pantalla para no variar
 * en el papel, que es donde se coteja.
 */
export const GROSOR_TRAZO = 7

/**
 * Tope del data-URL, en CARACTERES —que es lo que mide `length()` en Postgres,
 * no bytes de imagen—. `(300 000 − 22) × ¾ = 224 983 bytes ≈ 219 KiB` de PNG.
 * Lo impone `firmas_documento_trazo_check`.
 */
export const LIMITE_DATAURL = 300000

/** Suelo del mismo CHECK: menos de 100 caracteres no es un trazo, es un lienzo en blanco. */
export const MINIMO_DATAURL = 100

/** Margen del recorte: 2 % del lado mayor de la caja de tinta. */
const MARGEN_RECORTE = 0.02

/** Alto del mapa de bits que corresponde a una caja CSS de `anchoCss × altoCss`. */
export function altoBitmap(anchoCss: number, altoCss: number): number {
  if (anchoCss <= 0 || altoCss <= 0) return ANCHO_BITMAP
  return Math.round((ANCHO_BITMAP * altoCss) / anchoCss)
}

/** La caja envolvente de todos los trazos. `null` si el lienzo está vacío. */
function cajaDeTinta(
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number,
): { x: number; y: number; ancho: number; alto: number } | null {
  const px = ctx.getImageData(0, 0, ancho, alto).data
  let minX = ancho
  let minY = alto
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      // El lienzo es transparente y el trazo opaco: el canal alfa es el único
      // que hace falta mirar.
      if (px[(y * ancho + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) return null
  return { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 }
}

/** Recorta un trozo del lienzo a un PNG con alfa, opcionalmente reescalado. */
function recortar(
  origen: HTMLCanvasElement,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  escala: number,
): string {
  const destino = document.createElement('canvas')
  destino.width = Math.max(1, Math.round(ancho * escala))
  destino.height = Math.max(1, Math.round(alto * escala))
  const ctx = destino.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(origen, x, y, ancho, alto, 0, 0, destino.width, destino.height)
  // PNG con alfa y NO jpeg: la firma se apoya sobre la línea impresa. Y ni
  // webp ni svg entran en el patrón del CHECK: entrarían en la fila y el
  // documento fallaría al renderizar.
  return destino.toDataURL('image/png')
}

/** Por qué no se pudo exportar. `vacio` es el caso normal —nadie firmó todavía—. */
export type FalloTrazo = 'vacio' | 'contexto' | 'presupuesto'

export type ResultadoTrazo =
  | { ok: true; trazo: string }
  | { ok: false; motivo: FalloTrazo }

/**
 * Exporta el trazo RECORTADO a la caja de la tinta más un margen.
 *
 * Sin el recorte los milímetros de arriba serían falsos: el lienzo en pantalla
 * va de 1,33:1 a 2,7:1 y la celda impresa es 5,12:1, así que la imagen entera
 * aterrizaría por el alto —48 pt— y ocuparía entre el 26 y el 53 % del ancho de
 * la celda, encogiendo el grosor en la misma proporción. Además es lo natural:
 * en papel una firma ocupa lo que ocupa, no lo que medía el lienzo.
 */
export function exportarTrazo(lienzo: HTMLCanvasElement): ResultadoTrazo {
  const ctx = lienzo.getContext('2d')
  if (!ctx) return { ok: false, motivo: 'contexto' }

  const caja = cajaDeTinta(ctx, lienzo.width, lienzo.height)
  // Un lienzo sin tinta no se exporta: sin trazo no hay firma, y quien no firmó
  // no tiene fila.
  if (!caja) return { ok: false, motivo: 'vacio' }

  const margen = Math.round(Math.max(caja.ancho, caja.alto) * MARGEN_RECORTE)
  const x = Math.max(0, caja.x - margen)
  const y = Math.max(0, caja.y - margen)
  const ancho = Math.min(lienzo.width, caja.x + caja.ancho + margen) - x
  const alto = Math.min(lienzo.height, caja.y + caja.alto + margen) - y

  const entero = recortar(lienzo, x, y, ancho, alto, 1)
  if (entero.length >= MINIMO_DATAURL && entero.length <= LIMITE_DATAURL) {
    return { ok: true, trazo: entero }
  }
  if (entero.length < MINIMO_DATAURL) return { ok: false, motivo: 'vacio' }

  const reducido = recortar(lienzo, x, y, ancho, alto, ANCHO_REDUCIDO / ANCHO_BITMAP)
  if (reducido.length >= MINIMO_DATAURL && reducido.length <= LIMITE_DATAURL) {
    return { ok: true, trazo: reducido }
  }
  return { ok: false, motivo: 'presupuesto' }
}

/**
 * La huella del documento en el momento de firmar, en hexadecimal.
 *
 * Es lo que convierte un dibujo en una firma: sin ella no se puede demostrar
 * que lo que se firmó es lo que hoy está guardado. Se calcula sobre el MISMO
 * objeto que se acaba de escribir en `documentos.contenido`, y a partir de ahí
 * el contenido no se vuelve a tocar —el sellado solo mueve `estado`—.
 */
export async function huellaDocumento(contenido: unknown): Promise<string> {
  // ⚠ `crypto.subtle` SOLO EXISTE EN CONTEXTO SEGURO. En https y en localhost
  // está; abriendo el servidor de desarrollo por IP de red local —que es como
  // se prueba en el iPad— NO, y el fallo llegaría como un `undefined` sin
  // relación aparente con la firma. Se nombra aquí para que el formulario pueda
  // decir qué pasa en vez de culpar a la conexión.
  //
  // No hay respaldo sin `subtle`: un resumen que no sea SHA-256 no acredita
  // nada, y esta huella es lo único que demuestra que lo firmado es lo
  // guardado. Antes de no tener huella, no hay firma.
  if (typeof crypto === 'undefined' || crypto.subtle === undefined) {
    throw new Error('SIN_CRYPTO_SUBTLE')
  }
  const bytes = new TextEncoder().encode(JSON.stringify(contenido))
  const resumen = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(resumen))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
