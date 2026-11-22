/**
 * Lógica pura de las líneas del recibo de honorarios y la cotización (maqueta
 * `honorarios.html`, aprobada por el dueño): un cobro por línea, con el teclado
 * como en una hoja. Sin React y sin red: la usa también el búnker.
 *
 * Lo guardado NO cambia: cada línea sigue siendo `{concepto, origen, precio}`.
 * Lo único nuevo es `heredado`, que vive sólo en pantalla: una línea nueva de
 * la cotización nace con el origen de la anterior (casi siempre se cotizan
 * seguidos los cobros del mismo), y mientras siga EN BLANCO ese origen no es
 * algo que el médico escribiera — no cuenta para «formulario vacío» ni entra en
 * la plantilla. En cuanto se escribe el concepto o el precio, o se toca el
 * origen, la línea es del médico como cualquier otra.
 */

export interface LineaConcepto {
  id: number
  concepto: string
  /** Solo cotización. Texto libre: los subtotales agrupan por lo escrito. */
  origen: string
  precio: number
  /** El origen vino de la línea anterior y la línea sigue en blanco. */
  heredado?: boolean
}

/** Sin concepto y sin precio: la línea que Enter o «Agregar» no repiten. */
export function enBlanco(l: LineaConcepto): boolean {
  return l.concepto.trim() === '' && l.precio <= 0
}

/**
 * Una línea cuenta como escrita cuando tiene concepto, origen o precio. El
 * origen heredado de una línea en blanco no cuenta (ver la cabecera).
 */
export function conTexto(l: LineaConcepto): boolean {
  return !enBlanco(l) || (l.origen.trim() !== '' && !l.heredado)
}

/** Lo que llega al documento: concepto con precio. Precio 0 es «sin escribir». */
export function esEmitible(l: LineaConcepto): boolean {
  return l.concepto.trim() !== '' && l.precio > 0
}

/** Una línea en blanco; en la cotización, con el origen de `de` si lo tiene. */
function nuevaLinea(id: number, de: LineaConcepto | undefined, cotizacion: boolean): LineaConcepto {
  const origen = cotizacion ? (de?.origen.trim() ?? '') : ''
  return origen !== ''
    ? { id, concepto: '', origen, precio: 0, heredado: true }
    : { id, concepto: '', origen: '', precio: 0 }
}

export interface Alta { lineas: LineaConcepto[]; foco: number; creada: boolean }

/**
 * Enter en el precio: abre la línea siguiente DEBAJO de `id`, con el foco en su
 * concepto. Sólo si la actual tiene algo; si no, el foco se queda.
 */
export function abrirTras(
  lineas: readonly LineaConcepto[], id: number, nextId: number, cotizacion: boolean,
): Alta {
  const i = lineas.findIndex(l => l.id === id)
  if (i < 0 || enBlanco(lineas[i])) return { lineas: [...lineas], foco: id, creada: false }
  const nueva = nuevaLinea(nextId, lineas[i], cotizacion)
  return { lineas: [...lineas.slice(0, i + 1), nueva, ...lineas.slice(i + 1)], foco: nextId, creada: true }
}

/** «＋ Agregar concepto»: al final, salvo que la última ya esté en blanco (entonces se va a ella). */
export function agregarAlFinal(lineas: readonly LineaConcepto[], nextId: number, cotizacion: boolean): Alta {
  const ultima = lineas[lineas.length - 1]
  if (ultima && enBlanco(ultima)) return { lineas: [...lineas], foco: ultima.id, creada: false }
  return { lineas: [...lineas, nuevaLinea(nextId, ultima, cotizacion)], foco: nextId, creada: true }
}

/**
 * Retroceso en un concepto vacío de una línea sin precio: la quita y el foco
 * sube al precio de la anterior (o baja a la siguiente si era la primera).
 * Nunca deja la lista sin líneas. `null` = no se hace nada.
 */
export function quitarConRetroceso(
  lineas: readonly LineaConcepto[], id: number,
): { lineas: LineaConcepto[]; foco: number; campo: 'precio' | 'concepto' } | null {
  const i = lineas.findIndex(l => l.id === id)
  if (i < 0 || lineas.length < 2 || !enBlanco(lineas[i])) return null
  const quedan = lineas.filter(l => l.id !== id)
  return i > 0
    ? { lineas: quedan, foco: lineas[i - 1].id, campo: 'precio' }
    : { lineas: quedan, foco: quedan[0].id, campo: 'concepto' }
}

/** Cambia un campo de texto; tocar el origen lo hace del médico. */
export function conCampo(
  l: LineaConcepto, campo: 'concepto' | 'origen', valor: string,
): LineaConcepto {
  if (campo === 'origen') return { id: l.id, concepto: l.concepto, origen: valor, precio: l.precio }
  return { ...l, concepto: valor }
}

/** Sugerencias que contienen lo escrito, sin mayúsculas ni acentos. */
export function filtrarSugerencias(sugerencias: readonly string[], texto: string, max = 8): string[] {
  const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(texto.trim())
  return sugerencias.filter(s => norm(s).includes(q)).slice(0, max)
}
