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
 * El recortador de `CapturaIdentificacion` usa ESTA proporción y ninguna otra:
 * lo que encierra su rectángulo es lo impreso, sin recortes posteriores. Si la
 * caja del anexo cambia, este archivo cambia con ella.
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
/** 1,583 — la proporción del rectángulo de recorte. */
export const PROPORCION = CAJA_ANCHO_PT / CAJA_ALTO_PT

/**
 * Ancho mínimo del recorte para que la caja impresa salga nítida:
 * `228 pt ÷ 72 × 300 dpi = 950 px`. Por debajo, la credencial se imprime pero
 * pierde definición — con mucho zoom sobre una fuente pequeña, el rectángulo
 * puede encerrar menos píxeles que los que la caja necesita.
 *
 * Es umbral de AVISO, no de bloqueo: `prepararFoto` no escala hacia arriba
 * —inventar píxeles no mejora una credencial— y la foto nunca bloquea.
 */
export const ANCHO_MINIMO_NITIDO = 950

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

/**
 * Un rectángulo de recorte, en píxeles de la fuente.
 *
 * ⚠ CON ROTACIÓN, LAS COORDENADAS SON DEL ESPACIO YA GIRADO. Es el contrato de
 * `croppedAreaPixels` de react-easy-crop: cuando la imagen se gira 90°, el
 * rectángulo llega medido sobre la imagen girada —ancho y alto intercambiados—
 * y `matrizDeRecorte` es quien lo traduce de vuelta a la imagen original.
 */
export interface Recorte {
  x: number
  y: number
  ancho: number
  alto: number
}

/**
 * Recorte CENTRADO a la proporción del anexo, sobre la fuente entera.
 *
 * Es el RESPALDO de `prepararFoto` cuando no le llega ningún recorte — hoy no
 * hay ruta normal que lo omita: el recortador de `CapturaIdentificacion`
 * entrega siempre el suyo. Se queda porque un llamador futuro sin recorte
 * produce una foto centrada válida en vez de una deformada o un fallo.
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

/**
 * La caja envolvente de la imagen tras girarla en pasos de 90°: a 90 y 270 los
 * lados se intercambian. Es el espacio en el que react-easy-crop mide su
 * recorte cuando hay rotación.
 */
export function medidasRotadas(
  ancho: number,
  alto: number,
  rotacion: number,
): { ancho: number; alto: number } {
  return rotacion % 180 === 0 ? { ancho, alto } : { ancho: alto, alto: ancho }
}

/**
 * El zoom por debajo del cual ya no se puede alejar más: aquel en que la imagen
 * ENTERA cabe dentro del rectángulo de recorte.
 *
 * En la escala de react-easy-crop con `objectFit: cover` y el contenedor con la
 * proporción del rectángulo: zoom 1 = la imagen CUBRE el rectángulo (no se ve
 * nada fuera de ella), y este valor (≤ 1) = la imagen entera DENTRO. Es el tope
 * que pide el defecto de la credencial cortada: permite alejar hasta meterla
 * completa —la credencial está dentro de la imagen, así que con la imagen entera
 * cabe seguro— y ni un paso más allá, donde ya solo se añade vacío.
 *
 * Entre este zoom y 1 la imagen cubre un eje del rectángulo y el otro no: las
 * bandas del eje descubierto son inevitables en cuanto las proporciones
 * difieren, y las rellena de blanco `prepararFoto`. Depende de la rotación
 * porque a 90° la imagen intercambia sus lados.
 */
export function zoomMinimoEntera(ancho: number, alto: number, rotacion: number): number {
  const r = medidasRotadas(ancho, alto, rotacion)
  if (r.ancho <= 0 || r.alto <= 0) return 1
  const proporcionImagen = r.ancho / r.alto
  return Math.min(proporcionImagen, PROPORCION) / Math.max(proporcionImagen, PROPORCION)
}

/** Coseno y seno EXACTOS por paso de 90°: `Math.cos(3π/2)` devuelve −1.8e−16, no 0. */
const GIROS: Record<number, readonly [number, number]> = {
  0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1],
}

/**
 * La matriz `setTransform(a, b, c, d, e, f)` que deja sobre el lienzo de salida
 * EXACTAMENTE el rectángulo `r` de la imagen girada, dibujando la imagen
 * original UNA vez en `drawImage(fuente, 0, 0)`.
 *
 * ── POR QUÉ UNA MATRIZ Y NO UN LIENZO INTERMEDIO GIRADO ─────────────────────
 * El camino de manual —pintar la imagen entera girada en un canvas auxiliar y
 * recortar de ahí— exige un canvas del tamaño del sensor: 24 megapíxeles en un
 * teléfono actual, que es donde iOS empieza a negar canvas por área. Componer
 * las cuatro transformaciones en una sola matriz dibuja directo sobre el lienzo
 * de salida (≤1400 px) y el límite deja de existir.
 *
 * La composición, de dentro hacia fuera: centrar la imagen original, girarla,
 * llevar el centro al del espacio girado, restar la esquina del recorte y
 * escalar al lienzo de salida. Rotación positiva = horaria, como la prop
 * `rotation` de react-easy-crop.
 *
 * Es pura y vive exportada para poder probarse sin canvas: si esta matriz está
 * mal, el médico ajusta una cosa y se imprime otra, así que sus cuatro giros
 * están verificados en `identificacionFoto.test.ts`.
 */
export function matrizDeRecorte(
  rotacion: number,
  anchoFuente: number,
  altoFuente: number,
  r: Recorte,
  salidaAncho: number,
  salidaAlto: number,
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  const paso = ((rotacion % 360) + 360) % 360
  const giro = GIROS[paso]
  if (!giro) throw new Error(`ROTACION_INVALIDA: ${rotacion}`)
  const [cos, sen] = giro

  const rotada = medidasRotadas(anchoFuente, altoFuente, paso)
  const escalaX = salidaAncho / r.ancho
  const escalaY = salidaAlto / r.alto

  return {
    a: escalaX * cos,
    b: escalaY * sen,
    c: -escalaX * sen,
    d: escalaY * cos,
    e: escalaX * (-cos * anchoFuente / 2 + sen * altoFuente / 2 + rotada.ancho / 2 - r.x),
    f: escalaY * (-sen * anchoFuente / 2 - cos * altoFuente / 2 + rotada.alto / 2 - r.y),
  }
}

/**
 * Lo que se dibuja. Fue `HTMLVideoElement | HTMLImageElement` mientras existió
 * el visor `getUserMedia`; con la captura nativa la única fuente es una imagen.
 */
export type FuenteFoto = HTMLImageElement

/** Las medidas reales de la fuente, que no son las de su caja en pantalla. */
function medidasDe(fuente: FuenteFoto): { ancho: number; alto: number } {
  return { ancho: fuente.naturalWidth, alto: fuente.naturalHeight }
}

/**
 * Recorta, reduce a `ANCHO_SALIDA` y codifica a JPEG.
 *
 * JPEG y no PNG: una fotografía en PNG pesa varias veces más sin ganar nada
 * —no hay transparencia que preservar, al revés que en el trazo de la firma—.
 * Devuelve `null` si la fuente todavía no tiene medidas o el canvas no da
 * contexto; quien llama lo trata como «sin foto», que nunca bloquea.
 */
export async function prepararFoto(
  fuente: FuenteFoto,
  recorte?: Recorte,
  rotacion = 0,
): Promise<Blob | null> {
  const { ancho, alto } = medidasDe(fuente)
  if (ancho <= 0 || alto <= 0) return null

  // El recorte —del médico o el respaldo centrado— se mide en el espacio
  // GIRADO, que con rotación intercambia los lados. Ver `Recorte`.
  const rotada = medidasRotadas(ancho, alto, rotacion)
  const r = recorte ?? recorteCentrado(rotada.ancho, rotada.alto)
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.min(ANCHO_SALIDA, Math.round(r.ancho))
  lienzo.height = Math.round(lienzo.width / PROPORCION)
  const ctx = lienzo.getContext('2d')
  if (!ctx) return null

  // ⚠ EL FONDO BLANCO NO SOBRA. Desde que el zoom mínimo permite alejar hasta
  // meter la imagen entera, el rectángulo puede cubrir bandas donde no hay
  // imagen — y esto se codifica a JPEG, que no tiene alfa: un píxel sin pintar
  // sale NEGRO, no transparente. Dos franjas negras impresas en el anexo
  // parecerían un defecto; en blanco, sobre una credencial en su lámina clara,
  // no se notan.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)

  // La rotación se aplica AL RECORTE FINAL, no solo a la vista previa: la
  // matriz gira la imagen original al espacio en que el médico ajustó su
  // rectángulo, así que lo que se guarda es lo que él vio.
  const m = matrizDeRecorte(rotacion, ancho, alto, r, lienzo.width, lienzo.height)
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f)
  ctx.drawImage(fuente, 0, 0)
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
