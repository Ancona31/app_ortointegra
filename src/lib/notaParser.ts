/**
 * notaParser.ts — parser neutro de la nota clínica a datos estructurados.
 *
 * Módulo sin dependencias de cliente ni de servidor: convierte el texto plano
 * de una nota (con encabezados de sección y **negritas**) en un árbol de datos
 * ({@link NotaParseada}). NO produce HTML en ningún punto — solo estructura que
 * cualquier render (PDF, visor, HTML) consume a su manera.
 *
 * Reconoce dos familias de encabezado:
 *  - G3-G6 (actual): `**[SUBJETIVO]:**`, `*[PLAN]*`, `**[AUXILIARES DX]:**`, …
 *  - G2 (legacy SOAP): `**S (Subjetivo):**`, `**O (Objetivo):**`, `**Pronóstico:**`, …
 */

export type TipoSeccion =
  | 'subjetivo'
  | 'objetivo'
  | 'auxiliares_dx'
  | 'analisis'
  | 'diagnostico'
  | 'plan'
  | 'pronostico'
  | 'desconocida'

export interface SpanTexto {
  texto: string
  bold: boolean
}

export interface BloqueNota {
  tipo: 'parrafo' | 'item'
  spans: SpanTexto[]
}

export interface SeccionNota {
  tipo: TipoSeccion
  titulo: string
  bloques: BloqueNota[]
}

export interface NotaParseada {
  secciones: SeccionNota[]
}

/** Normaliza para comparar nombres de encabezado: trim + lowercase + sin acentos. */
function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Mapea el nombre capturado de un encabezado G3-G6 a su tipo de sección. */
function clasificarG36(nombre: string): TipoSeccion {
  switch (normalizar(nombre)) {
    case 'subjetivo':
      return 'subjetivo'
    case 'objetivo':
      return 'objetivo'
    case 'auxiliares diagnosticos':
    case 'auxiliares dx':
      return 'auxiliares_dx'
    case 'analisis':
      return 'analisis'
    case 'diagnostico':
      return 'diagnostico'
    case 'plan':
      return 'plan'
    case 'pronostico':
      return 'pronostico'
    default:
      return 'desconocida'
  }
}

/**
 * Clasifica el texto interno de un encabezado bold como sección G2 legacy.
 * Misma semántica tolerante que SOAP_HEADERS (printStyles.ts): letra + paréntesis
 * ( o （ U+FF08) para S/O/A/P, o la palabra Pronóstico (con o sin acento).
 * Devuelve null si no es un encabezado G2 (→ el llamador lo trata como cuerpo).
 */
function clasificarG2(inner: string): TipoSeccion | null {
  const n = normalizar(inner)
  const letra = n.match(/^([soap])\s*[(（]/)
  if (letra) {
    const mapa = { s: 'subjetivo', o: 'objetivo', a: 'analisis', p: 'plan' } as const
    return mapa[letra[1] as 's' | 'o' | 'a' | 'p']
  }
  if (/^pronostico\b/.test(n)) return 'pronostico'
  return null
}

/** Parte una línea en spans, marcando **negrita** como bold:true. */
function parseSpans(texto: string): SpanTexto[] {
  const spans: SpanTexto[] = []
  const regex = /\*\*(.+?)\*\*/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) spans.push({ texto: texto.slice(ultimo, m.index), bold: false })
    spans.push({ texto: m[1], bold: true })
    ultimo = regex.lastIndex
  }
  if (ultimo < texto.length) spans.push({ texto: texto.slice(ultimo), bold: false })
  if (spans.length === 0) spans.push({ texto, bold: false })
  return spans
}

/**
 * Parsea el texto plano de una nota clínica a {@link NotaParseada}.
 * Entrada falsy o en blanco → { secciones: [] }. Nunca lanza.
 */
export function parseNota(texto: string | null | undefined): NotaParseada {
  if (!texto || !texto.trim()) return { secciones: [] }

  const secciones: SeccionNota[] = []
  let actual: SeccionNota | null = null

  function nuevaSeccion(tipo: TipoSeccion, titulo: string): void {
    actual = { tipo, titulo, bloques: [] }
    secciones.push(actual)
  }

  function agregarBloque(linea: string): void {
    const esItem = /^-\s+/.test(linea)
    const contenido = esItem ? linea.replace(/^-\s+/, '') : linea
    if (!contenido.trim()) return
    if (!actual) nuevaSeccion('desconocida', '')
    actual!.bloques.push({ tipo: esItem ? 'item' : 'parrafo', spans: parseSpans(contenido) })
  }

  for (const raw of texto.split('\n')) {
    const linea = raw.trim()
    if (!linea) continue

    const g36 = linea.match(/^\*{1,2}\[([^\]]+)\]:?\*{0,2}\s*(.*)$/)
    if (g36) {
      const nombre = g36[1].trim()
      nuevaSeccion(clasificarG36(nombre), nombre)
      if (g36[2].trim()) agregarBloque(g36[2].trim())
      continue
    }

    const g2 = linea.match(/^\*\*(.+?)\*\*\s*(.*)$/)
    if (g2) {
      const tipoG2 = clasificarG2(g2[1].trim())
      if (tipoG2) {
        nuevaSeccion(tipoG2, g2[1].trim())
        if (g2[2].trim()) agregarBloque(g2[2].trim())
        continue
      }
    }

    agregarBloque(linea)
  }

  return { secciones }
}
