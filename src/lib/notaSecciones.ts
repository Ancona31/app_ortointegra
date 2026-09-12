/**
 * notaSecciones.ts — metadatos y presentación de las secciones de una nota.
 *
 * Módulo neutro, sin dependencias de cliente ni de servidor y sin producir
 * marcado: recibe el árbol de `notaParser` y decide QUÉ secciones se pintan, en
 * QUÉ orden, con qué número, título y subtítulo. Cómo se pintan es cosa de cada
 * render.
 *
 * ⚠️ ES LA FUENTE ÚNICA DE ESOS METADATOS, Y ESA ES SU RAZÓN DE EXISTIR. Vivían
 * dentro de `pdf/NotaEvolucionPdf.tsx`, donde el impreso era su único
 * consumidor; desde que el visor de pantalla pinta las mismas secciones, dos
 * copias serían dos numeraciones. Y la numeración es POSICIONAL: basta con que
 * una de las dos listas reordene distinto para que la misma nota diga «03 PLAN»
 * en pantalla y «04 PLAN» en el papel. El papel es el documento del expediente,
 * así que esa divergencia no es cosmética.
 *
 * Si añades una sección, se añade AQUÍ y las dos vistas se enteran.
 */

import type { SeccionNota, BloqueNota, SpanTexto, TipoSeccion } from '@/lib/notaParser'

/** Orden en que se presentan las secciones conocidas, venga como venga el texto. */
export const ORDEN_CANONICO: TipoSeccion[] = [
  'subjetivo', 'objetivo', 'auxiliares_dx', 'analisis', 'diagnostico', 'plan', 'pronostico',
]

export const TITULO_SECCION: Record<TipoSeccion, string> = {
  subjetivo: 'SUBJETIVO',
  objetivo: 'OBJETIVO',
  auxiliares_dx: 'AUXILIARES DX',
  analisis: 'ANÁLISIS',
  diagnostico: 'DIAGNÓSTICO',
  plan: 'PLAN',
  pronostico: 'PRONÓSTICO',
  desconocida: 'NOTA',
}

export const SUBTITULO_SECCION: Record<TipoSeccion, string> = {
  subjetivo: 'Motivo y síntomas',
  objetivo: 'Exploración física',
  auxiliares_dx: 'Estudios',
  analisis: 'Impresión dx',
  diagnostico: 'Diagnóstico',
  plan: 'Tratamiento',
  pronostico: 'Evolución esperada',
  desconocida: '',
}

/**
 * Las frases con que el formulario rellena un campo que el médico dejó vacío.
 *
 * ⚠️ LISTA CERRADA Y COMPARACIÓN EXACTA, NO UNA HEURÍSTICA. La tentación es
 * detectar «lo que acabe en pendiente.» o «lo que empiece por Sin …», y sería
 * un error: un plan real puede decir «Biopsia pendiente.» y atenuarlo lo
 * escondería como si no hubiera plan. Un falso positivo aquí oculta contenido
 * clínico; un falso negativo sólo pinta una frase de relleno en tinta normal.
 * Salen literalmente de `nueva-nota/page.tsx`; si allí se añade otra, se añade
 * aquí.
 */
const FRASES_DE_RELLENO: readonly string[] = [
  'Sin exploración física registrada.',
  'Estudios de gabinete y laboratorio pendientes.',
  'Análisis clínico pendiente.',
  'Plan de tratamiento pendiente.',
  'Diagnóstico pendiente.',
] as const

/** Texto plano de un bloque, concatenando sus spans. */
function textoDe(bloque: BloqueNota): string {
  return bloque.spans.map(s => s.texto).join('').trim()
}

/**
 * La sección existe pero no aporta información: un único párrafo que es
 * exactamente una de las frases de relleno. El spec la quiere ATENUADA y en la
 * misma línea del encabezado — nunca oculta: que un campo se dejara vacío es
 * un dato del expediente.
 */
export function fraseDeRelleno(seccion: SeccionNota): string | null {
  if (seccion.bloques.length !== 1) return null
  const unico = seccion.bloques[0]
  if (unico.tipo !== 'parrafo') return null
  const texto = textoDe(unico)
  return FRASES_DE_RELLENO.includes(texto) ? texto : null
}

/** Ordena las secciones renderizables: conocidas en orden canónico, luego desconocidas. */
export function ordenarSecciones(secciones: SeccionNota[]): SeccionNota[] {
  const conBloques = secciones.filter((sec) => sec.bloques.length > 0)
  const conocidas = ORDEN_CANONICO.flatMap((tipo) => conBloques.filter((sec) => sec.tipo === tipo))
  const desconocidas = conBloques.filter((sec) => sec.tipo === 'desconocida')
  return [...conocidas, ...desconocidas]
}

/** Título de una sección desconocida: usa su título original en mayúsculas o "NOTA". */
export function tituloDe(sec: SeccionNota): string {
  if (sec.tipo !== 'desconocida') return TITULO_SECCION[sec.tipo]
  return sec.titulo.trim() ? sec.titulo.trim().toUpperCase() : 'NOTA'
}

/**
 * Número correlativo de dos cifras por POSICIÓN, no por sección: si la nota no
 * trae «AUXILIARES DX», la siguiente ocupa el 03 en vez de saltárselo. Los
 * números cuentan, no identifican.
 */
export function numeroDe(indice: number): string {
  return String(indice + 1).padStart(2, '0')
}

/** Un span vacío/de espacio termina en ":". Detecta sub-encabezados tipo "Farmacológico:". */
function terminaEnDosPuntos(bloque: BloqueNota): boolean {
  const ultimo = bloque.spans[bloque.spans.length - 1]
  return bloque.tipo === 'parrafo' && !!ultimo && ultimo.texto.trimEnd().endsWith(':')
}

/**
 * Presentación (no altera parseNota): un párrafo que termina en ":" seguido de
 * EXACTAMENTE UN item (antes del siguiente párrafo/fin) se fusiona en un solo
 * párrafo — spans del encabezado + espacio + spans del item, sin guion. Con 2+
 * items consecutivos se conserva la lista.
 */
export function fusionarEncabezadoItem(bloques: BloqueNota[]): BloqueNota[] {
  const out: BloqueNota[] = []
  for (let i = 0; i < bloques.length; i++) {
    const actual = bloques[i]
    const sig = bloques[i + 1]
    const sigSig = bloques[i + 2]
    if (terminaEnDosPuntos(actual) && sig?.tipo === 'item' && sigSig?.tipo !== 'item') {
      const espacio: SpanTexto = { texto: ' ', bold: false }
      out.push({ tipo: 'parrafo', spans: [...actual.spans, espacio, ...sig.spans] })
      i++ // consume el item fusionado
      continue
    }
    out.push(actual)
  }
  return out
}
