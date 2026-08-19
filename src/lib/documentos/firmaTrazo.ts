/**
 * Geometría del trazo de firma — GUIA_FORMULARIOS_05 §5.5.
 *
 * Módulo NEUTRO: sin `'use client'` y sin ningún import. Vive fuera del
 * componente porque los números tienen una procedencia que hay que poder leer
 * sin abrir 700 líneas de interfaz.
 *
 * ══ HAY DOS ESPACIOS Y DOS GROSORES. NO LOS CONFUNDAS ══════════════════════
 *
 * Es la distinción que ordena este archivo entero, y confundirlos fue el
 * defecto que corrige esta versión:
 *
 *   CAPTURA    `ANCHO_BITMAP` 1024 px de ancho, alto según la caja CSS, trazo
 *              `GROSOR_TRAZO` 7 px. Es lo que el paciente ve mientras firma, y
 *              NO ES LO QUE SE IMPRIME. Solo gobierna la pantalla.
 *
 *   CANÓNICO   `CANONICO_ANCHO` × `CANONICO_ALTO` = 592 × 321 px, trazo
 *              `GROSOR_CANONICO` 6 px. Es la caja de rúbrica impresa a 300 dpi,
 *              y es lo único que sale en el papel: la exportación REDIBUJA ahí
 *              las muestras del puntero.
 *
 * ── POR QUÉ EL CANÓNICO EXISTE ──────────────────────────────────────────────
 * La caja de rúbrica coloca la firma con `objectFit: contain`, y el recorte a la
 * tinta (§5.5.4) hace que la colocación la limite un eje o el otro según la forma
 * del trazo. Con el grosor declarado en el espacio de CAPTURA, el grosor impreso
 * pasaba a depender de cuántos píxeles ocupara cada firma. Medido sobre PDF
 * reales: 1,264 mm en un iPad y 0,262 mm en un Samsung —4,8× de dispersión— y
 * ni siquiera constante entre dos personas firmando en el mismo aparato.
 *
 * Redibujar en el canónico fija las dos dimensiones, y como el canónico tiene
 * **exactamente la proporción de la caja impresa**, `contain` no deja holgura en
 * ningún eje: los dpi salen 300 lo limite el ancho o lo limite el alto, y el
 * grosor deja de depender de nada: 6 ÷ 300 × 25,4 = **0,508 mm, siempre**.
 *
 * ── DE DÓNDE SALEN LOS NÚMEROS ──────────────────────────────────────────────
 *   Caja impresa    142 × 77 pt      (`GEOMETRIA.rubrica` de `v2/BloqueFirmas.tsx`)
 *   Ancho canónico  142 ÷ 72 × 300 dpi = 591,67 → 592 px
 *   Alto canónico    77 ÷ 72 × 300 dpi = 320,83 → 321 px
 *   Proporción      592 / 321 = 1,8442  ·  142 / 77 = 1,8442   ← el invariante
 *
 * ⚠ **LA CAJA IMPRESA ENCOGIÓ UN 20 % Y EL INVARIANTE SIGUE EN PIE.** Hoy mide
 * **113,6 × 61,6 pt** —Angel: ese hueco no es papel en blanco, es donde se imprime esta
 * rúbrica, así que se compone más pequeña—. Los DOS ejes bajaron el mismo 20 %, que es
 * lo único que importa aquí: 113,6 / 61,6 = **1,8442**, la misma proporción, así que
 * `contain` sigue dando los mismos dpi lo limite el ancho o lo limite el alto y el
 * grosor sigue sin depender de la forma de cada firma.
 *
 * Lo que sí cambia es la CIFRA: los dpi pasan de 300 a **375** —592 ÷ (113,6 ÷ 72)— y
 * con ellos el grosor impreso, de 0,508 a **0,406 mm**. Sigue siendo el mismo para
 * todas las firmas y para las ya capturadas, que es la garantía que este archivo
 * existe para dar. Donde abajo se lea «300 dpi» y «0,508 mm», léase 375 y 0,406.
 *
 * ⚠ **`GROSOR_CANONICO` NO SE SUBIÓ PARA COMPENSAR, Y ES DELIBERADO.** Subirlo de 6 a
 * 7,5 px devolvería el grosor impreso a 0,508 mm exactos, pero solo para las capturas
 * NUEVAS: las rúbricas ya guardadas se generaron con el 6 y no se regeneran. Habría dos
 * poblaciones de médicos imprimiendo con grosores distintos, que es peor que el décimo
 * de milímetro que se pierde — y 0,406 mm sigue siendo el grosor de una pluma fina.
 *   Grosor          6 px, medidos sobre la rúbrica del médico (ver `GROSOR_CANONICO`)
 *
 * ⚠ **ESTE ARCHIVO ESTUVO CALIBRADO CONTRA `FirmaBox`, QUE ES v1** (245,76 × 48 pt,
 * proporción 5,12). Al encender v2 la firma pasa a componerla `BloqueFirmas`, cuya
 * celda mide 231, 228 o 142 pt según el formato: sin recalibrar, los mismos 6 px
 * imprimían entre 0,293 y 0,815 mm según el formato y la forma de la firma. La
 * recalibración es a la CAJA de v2, no a su celda, justamente para que el ancho de
 * celda deje de entrar en la cuenta.
 *
 * ⚠ SI `GEOMETRIA.rubrica` CAMBIA DE TAMAÑO, ESTE ARCHIVO ENTERO HAY QUE REHACERLO.
 */

/* ── El espacio de CAPTURA: lo que el paciente ve ──────────────────────────── */

/**
 * Ancho del mapa de bits de captura, FIJO y explícitamente NO `devicePixelRatio`.
 *
 * El teléfono suele traer dpr 3 y el iPad dpr 2, así que atar el mapa de bits al
 * dispositivo produciría dos archivos distintos, con distinto detalle y distinto
 * peso, del mismo gesto.
 */
export const ANCHO_BITMAP = 1024

/**
 * Grosor del trazo EN PANTALLA, en píxeles del mapa de bits de captura.
 *
 * ⚠ NO ES EL GROSOR IMPRESO. Lo fue, y ahí estaba el defecto: en el papel se
 * traducía a un grosor que dependía del alto de cada firma. El impreso es
 * `GROSOR_CANONICO`, y esta constante ya solo decide cómo se ve el trazo
 * mientras se firma.
 *
 * Consecuencia aceptada: el trazo en pantalla no pesa exactamente lo que pesará
 * en el papel, y la diferencia cambia con el aparato. Es preferible a la
 * alternativa —adaptar el grosor en vivo al alto que lleve la firma—, que haría
 * que el trazo cambiara de grueso mientras el paciente lo está dibujando.
 */
export const GROSOR_TRAZO = 7

/** Alto del mapa de bits de captura que corresponde a una caja CSS de `ancho × alto`. */
export function altoBitmap(anchoCss: number, altoCss: number): number {
  if (anchoCss <= 0 || altoCss <= 0) return ANCHO_BITMAP
  return Math.round((ANCHO_BITMAP * altoCss) / anchoCss)
}

/* ── El espacio CANÓNICO: lo que se imprime ────────────────────────────────── */

/** `142 pt ÷ 72 × 300 dpi = 591,67 → 592 px` — la caja de rúbrica a lo ancho. */
export const CANONICO_ANCHO = 592

/**
 * `77 pt ÷ 72 × 300 dpi = 320,83 → 321 px` — el alto de la caja de rúbrica a 300 dpi.
 *
 * **Ningún eje manda sobre el otro, y ESA es la propiedad que se busca**: como los
 * dos salen de la misma caja a los mismos dpi, la proporción canónica y la de la
 * caja impresa coinciden —1,8442 las dos— y `contain` acaba dando 300 dpi lo limite
 * el ancho o lo limite el alto. La versión anterior lo conseguía por otro camino
 * —dos cifras que casualmente daban 300 en los dos ejes contra la celda de v1— y
 * ese camino se rompía en cuanto la celda cambiaba de proporción.
 *
 * ⚠ **EL REDONDEO ES A ENTERO Y NO ES GRATIS.** 591,67 → 592 y 320,83 → 321
 * desplazan los dpi efectivos a 300,17 y 300,16: 0,06 % de error, o sea 0,0003 mm
 * sobre los 0,508. Invisible, y el redondeo es obligatorio porque un canvas no
 * admite dimensiones fraccionarias. Lo que importa es que los dos se redondeen
 * HACIA ARRIBA, para que las dos derivas vayan en el mismo sentido y la proporción
 * no se separe.
 */
export const CANONICO_ALTO = 321

/**
 * Grosor impreso: **6 px canónicos = 6 ÷ 300 × 25,4 = 0,508 mm**.
 *
 * Sale de medir la rúbrica del médico, que es el patrón que el lector tiene al
 * lado en la misma hoja: 6,08 px en su espacio de 200 px de alto, o sea
 * 0,515 mm impresos. La diferencia con estos 6 px es del 1,4 %, invisible.
 *
 * No sale de los «0,6 mm» que declaraba la versión anterior de §5.5.3: aquel
 * número se calculó suponiendo que la firma cruzaba los 86,7 mm de la celda, y
 * el recorte garantiza que no los cruce nunca —las firmas reales imprimen entre
 * 13 y 54 mm de ancho—.
 *
 * ⚠ **LA CIFRA NO CAMBIA AL PASAR A LA CAJA DE v2, Y ESO NO ES CASUALIDAD.** El
 * grosor impreso es `px ÷ dpi`, y la recalibración se hizo eligiendo el canónico
 * para que los dpi sigan siendo 300. Es decir: lo que se recalibró fue el TAMAÑO
 * del espacio canónico, no este número. Si algún día se elige un canónico con
 * otros dpi, es este 6 el que hay que mover, y en la misma proporción.
 */
export const GROSOR_CANONICO = 6

/**
 * Aire entre la tinta y el borde de la imagen exportada, en píxeles canónicos.
 *
 * Los remates redondos ya asoman `GROSOR_CANONICO / 2` más allá del recorrido
 * del puntero; estos 2 px son para que el borde suavizado del trazo no quede
 * cortado contra el filo de la imagen.
 */
export const MARGEN_CANONICO = 2

/**
 * Distancia mínima entre muestras consecutivas, en píxeles canónicos.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────
 * El lápiz del iPad muestrea unas 240 veces por segundo y el navegador entrega
 * todas esas muestras en `getCoalescedEvents`. Firmando despacio, dos muestras
 * consecutivas caen a menos de un píxel, y cada una dibuja un segmento con sus
 * remates redondos sobre el anterior. La tinta es opaca, así que el interior no
 * engorda —pero el BORDE SUAVIZADO sí: se compone contra sí mismo hasta
 * saturar—. Medido componiendo trazos uno a uno: 7,64 px con muestras a 6,5 px
 * de paso, 8,00 px con muestras a 0,25 px. Un +4,7 % que aparece solo en el
 * aparato que más muestrea, y que se lleva por delante el borde limpio.
 *
 * 0,6 px es la décima parte del trazo: por debajo, una muestra no aporta forma,
 * solo tinta superpuesta. La curva más fina de una firma mide en torno al 2 %
 * del alto —4 px canónicos—, muy por encima de este umbral.
 */
export const UMBRAL_MUESTRA = 0.6

/**
 * La tinta: NEGRO, y como literal.
 *
 * ── POR QUÉ NEGRO Y NO EL AZUL DE ACENTO ────────────────────────────────────
 * Una firma no es parte del formato: es lo único del papel que escribió una
 * persona. Con el azul de la marca salía del mismo color que los filetes y las
 * cabeceras, así que se leía como impresión y no como rúbrica.
 *
 * Y sobre todo: **la rúbrica del médico ya es negra**. Es un archivo del bucket
 * `firmas-medicos`, y `FirmaCaptura.tsx` la umbraliza a negro puro y opaco
 * —`d[i] = 0` en los tres canales— antes de subirla. Con la captura en azul, la
 * hoja de firmas del mismo consentimiento acababa con la del paciente de un
 * color y la del médico de otro. `#000000` no es un negro aproximado: es
 * exactamente el mismo valor que ya lleva el archivo del médico.
 *
 * ── ⚠ Y POR QUÉ LITERAL Y NO TOKEN ──────────────────────────────────────────
 * `--sp-ink-900` vale `rgba(255,255,255,.87)` en modo oscuro, y este mapa de
 * bits ES el que se imprime: leerlo de un token daría una firma capturada de
 * noche BLANCA SOBRE PAPEL BLANCO. Nada de `getComputedStyle` ni de `var(--sp-*)`
 * en la ruta de captura ni en la de exportación. Por lo mismo el lienzo lleva
 * fondo claro literal en el CSS: lo que se ve al firmar es lo que sale en el
 * papel, en los dos temas.
 */
export const TINTA_FIRMA = '#000000'

/* ── El presupuesto que impone la base ─────────────────────────────────────── */

/**
 * Tope del data-URL, en CARACTERES —que es lo que mide `length()` en Postgres,
 * no bytes de imagen—. Lo impone `firmas_documento_trazo_check`.
 *
 * Con el canónico acotado en 592 × 321 es **inalcanzable**: medido sobre PNG con
 * trazo real, una firma normal ocupa unos 7 100 caracteres y una densísima
 * 16 600 — el 2 % y el 6 % de este tope—. El canónico nuevo tiene además MENOS
 * área que el anterior (190 032 px contra 204 800), así que el margen se ensancha,
 * no se estrecha. Se conserva como guardia de fallo
 * ruidoso, no como camino: si alguna vez se rebasara, algo estaría muy mal y
 * degradar la firma en silencio no lo arreglaría.
 *
 * Aquí vivía `ANCHO_REDUCIDO` (768 px), que reexportaba más pequeño al pasarse
 * del presupuesto. Se retiró: con el canónico no puede dispararse, y un camino
 * muerto que nadie recorre solo sugiere un riesgo que ya no existe.
 */
export const LIMITE_DATAURL = 300000

/** Suelo del mismo CHECK: menos de 100 caracteres no es un trazo, es un lienzo en blanco. */
export const MINIMO_DATAURL = 100

/* ── El trazo ──────────────────────────────────────────────────────────────── */

/** Un punto YA en coordenadas del mapa de bits de captura, nunca de pantalla. */
export interface Punto { x: number; y: number }

/** Un trazo: las muestras de un gesto, del contacto al levantamiento. */
export type Trazo = readonly Punto[]

/**
 * Un segmento, y SOLO ese segmento. Devuelve el nuevo punto medio.
 *
 * ⚠ EL `beginPath()` NO SOBRA. Sin él, cada `stroke()` vuelve a rasterizar TODO
 * lo acumulado desde que empezó el gesto, así que el trabajo crece con el
 * cuadrado del número de puntos y la firma se frena dentro del propio trazo.
 *
 * ── POR QUÉ NO SE VEN LAS UNIONES ───────────────────────────────────────────
 * Cada segmento va del punto MEDIO anterior al medio nuevo, con el punto real
 * como control de la cuadrática. Eso hace la tangente continua en las uniones:
 * al llegar al medio de `anterior`→`p` la tangente lleva la dirección
 * `anterior`→`p`, y el segmento siguiente arranca en ese mismo medio con `p` de
 * control, o sea con esa misma dirección. Sin los medios —uniendo punto con
 * punto— la tangente daría un salto en cada muestra y se verían los vértices.
 *
 * ⚠ VIVE AQUÍ PORQUE TIENE DOS LLAMADORES Y NO PUEDEN DIVERGIR: el lienzo en
 * vivo la llama muestra a muestra mientras el paciente firma, y `exportarFirma`
 * la llama en lote al redibujar en el canónico. Si cada uno tuviera su copia,
 * lo que el paciente ve y lo que se imprime podrían dejar de ser la misma curva.
 */
export function segmentoSuavizado(
  ctx: CanvasRenderingContext2D,
  anterior: Punto,
  medioAnterior: Punto,
  p: Punto,
): Punto {
  const nuevoMedio = { x: (anterior.x + p.x) / 2, y: (anterior.y + p.y) / 2 }
  ctx.beginPath()
  ctx.moveTo(medioAnterior.x, medioAnterior.y)
  ctx.quadraticCurveTo(anterior.x, anterior.y, nuevoMedio.x, nuevoMedio.y)
  ctx.stroke()
  return nuevoMedio
}

/** Por qué no se pudo exportar. `vacio` es el caso normal —nadie firmó todavía—. */
export type FalloTrazo = 'vacio' | 'contexto' | 'presupuesto'

export type ResultadoTrazo =
  | { ok: true; trazo: string }
  | { ok: false; motivo: FalloTrazo }

/** La caja envolvente del RECORRIDO del puntero. `null` si no hay ninguna muestra. */
function cajaDeTrazos(trazos: readonly Trazo[]): {
  x: number; y: number; ancho: number; alto: number
} | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const trazo of trazos) {
    for (const p of trazo) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, ancho: maxX - minX, alto: maxY - minY }
}

/**
 * Las muestras que aportan forma, ya en canónico. Ver `UMBRAL_MUESTRA`.
 *
 * La última entra SIEMPRE aunque caiga por debajo del umbral: es donde se
 * levantó el lápiz, y descartarla acortaría el trazo.
 */
function muestrasUtiles(trazo: Trazo, aCanonico: (p: Punto) => Punto): Punto[] {
  const salida: Punto[] = []
  for (const p of trazo) {
    const c = aCanonico(p)
    const previo = salida[salida.length - 1]
    if (previo === undefined) { salida.push(c); continue }
    const dx = c.x - previo.x
    const dy = c.y - previo.y
    if (dx * dx + dy * dy >= UMBRAL_MUESTRA * UMBRAL_MUESTRA) salida.push(c)
  }
  const fin = trazo[trazo.length - 1]
  if (fin !== undefined && salida.length > 1) {
    const c = aCanonico(fin)
    const ultimo = salida[salida.length - 1]
    if (c.x !== ultimo.x || c.y !== ultimo.y) salida.push(c)
  }
  return salida
}

/**
 * Un trazo entero. Reproduce exactamente lo que el lienzo en vivo dibuja:
 * el punto de contacto, los segmentos suavizados y la cola hasta el último
 * punto real.
 */
function dibujarTrazo(ctx: CanvasRenderingContext2D, puntos: readonly Punto[]): void {
  const primero = puntos[0]
  if (primero === undefined) return
  // Un toque sin arrastre también deja tinta: sin esto, un punto sobre la i no
  // se dibujaría.
  ctx.beginPath()
  ctx.moveTo(primero.x, primero.y)
  ctx.lineTo(primero.x, primero.y)
  ctx.stroke()

  let ultimo = primero
  let medio = primero
  for (let i = 1; i < puntos.length; i++) {
    medio = segmentoSuavizado(ctx, ultimo, medio, puntos[i])
    ultimo = puntos[i]
  }
  // La cola: del último medio al último punto real. Sin esto la firma termina
  // media muestra antes de donde se levantó el dedo.
  if (ultimo !== medio) {
    ctx.beginPath()
    ctx.moveTo(medio.x, medio.y)
    ctx.lineTo(ultimo.x, ultimo.y)
    ctx.stroke()
  }
}

/**
 * La geometría del canónico: a qué escala entra la tinta y qué tamaño tiene la
 * imagen resultante.
 *
 * ⚠ ES EL INVARIANTE DEL QUE DEPENDE TODO. La imagen sale **o exactamente 592
 * de ancho o exactamente 321 de alto**, y en los dos casos la caja de rúbrica la
 * coloca a 300 dpi: limitada por el alto, `321 px ÷ (77 pt ÷ 72) = 300,2`;
 * limitada por el ancho, `592 px ÷ (142 pt ÷ 72) = 300,2`. Con el grosor fijo en
 * 6 px, eso da 0,508 mm impresos sin depender de nada.
 *
 * Pura y exportada para poder comprobarlo sin un canvas: ver `firmaTrazo.test.ts`.
 */
export function geometriaCanonica(
  anchoTinta: number,
  altoTinta: number,
): { escala: number; ancho: number; alto: number; borde: number } {
  const borde = GROSOR_CANONICO / 2 + MARGEN_CANONICO
  const escalas: number[] = []
  if (anchoTinta > 0) escalas.push((CANONICO_ANCHO - 2 * borde) / anchoTinta)
  if (altoTinta > 0) escalas.push((CANONICO_ALTO - 2 * borde) / altoTinta)
  // Un punto suelto no tiene extensión en ningún eje: no hay nada que escalar.
  const escala = escalas.length > 0 ? Math.min(...escalas) : 1
  return {
    escala,
    ancho: Math.max(1, Math.round(anchoTinta * escala + 2 * borde)),
    alto: Math.max(1, Math.round(altoTinta * escala + 2 * borde)),
    borde,
  }
}

/**
 * Exporta la firma REDIBUJÁNDOLA en el espacio canónico.
 *
 * ⚠ REDIBUJA, NO REESCALA, Y ESA ES LA DIFERENCIA QUE HACE QUE ESTO FUNCIONE.
 * Reescalar el mapa de bits de captura no arreglaría nada: mueve el trazo y la
 * firma en la misma proporción, así que el grosor relativo —lo único que
 * falla— queda igual, y además interpolar no crea detalle. Redibujando desde
 * las muestras, el trazo se rasteriza de nuevo a 300 dpi con un grosor fijo:
 * ni se interpola ni el grosor depende de cuánto ocupara la firma.
 *
 * La escala es un `contain` de la tinta en 592 × 321, que cubre los dos extremos
 * sin ramas: una firma muy plana la limita el ancho —592 px sobre 50,1 mm siguen
 * siendo 300 dpi— y una muy alta, el alto. En los dos casos el grosor impreso
 * sale el mismo.
 */
export function exportarFirma(trazos: readonly Trazo[]): ResultadoTrazo {
  const caja = cajaDeTrazos(trazos)
  // Sin trazo no hay firma, y quien no firmó no tiene fila.
  if (caja === null) return { ok: false, motivo: 'vacio' }

  const { escala, ancho, alto, borde } = geometriaCanonica(caja.ancho, caja.alto)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (ctx === null) return { ok: false, motivo: 'contexto' }

  ctx.lineWidth = GROSOR_CANONICO
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = TINTA_FIRMA

  const aCanonico = (p: Punto): Punto => ({
    x: (p.x - caja.x) * escala + borde,
    y: (p.y - caja.y) * escala + borde,
  })
  for (const trazo of trazos) dibujarTrazo(ctx, muestrasUtiles(trazo, aCanonico))

  // PNG con alfa y NO jpeg: la firma se apoya sobre la línea impresa. Y ni webp
  // ni svg entran en el patrón del CHECK: entrarían en la fila y el documento
  // fallaría al renderizar.
  const trazo = lienzo.toDataURL('image/png')
  if (trazo.length < MINIMO_DATAURL) return { ok: false, motivo: 'vacio' }
  if (trazo.length > LIMITE_DATAURL) return { ok: false, motivo: 'presupuesto' }
  return { ok: true, trazo }
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
  // está, abriendo el servidor de desarrollo por IP de red local —que es como
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
