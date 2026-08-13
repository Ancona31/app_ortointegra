/**
 * El cuerpo del Escrito Médico, traducido a lo que compone II.8.
 *
 * ══ POR QUÉ ESTE ARCHIVO EXISTE ═════════════════════════════════════════════
 *
 * `formatos/EscritoMedico.tsx` compone `NodoEscrito[]`, que es una estructura de
 * seis constructores. Lo que el formulario GUARDA es otra cosa, y son dos cosas
 * distintas a la vez (`EscritoMedicoForm.tsx:263-270`):
 *
 *   `doc`     `{ schema: 'tiptap-doc-v1', content: <JSON de ProseMirror> }`
 *   `cuerpo`  el mismo documento aplanado a HTML, para el parser regex de v1
 *
 * Entre esas dos formas y `NodoEscrito[]` no había nada. Es el desajuste que
 * apareció al medir los nueve formatos contra lo que los formularios persisten,
 * y sin este archivo el escrito médico se enciende con el cuerpo vacío.
 *
 * ══ CUÁL DE LAS DOS SE LEE, Y POR QUÉ EN ESE ORDEN ══════════════════════════
 *
 * **Manda `doc` siempre que exista.** `cuerpo` no es una segunda fuente
 * equivalente: es una DEGRADACIÓN deliberada del mismo documento, aplanada por
 * `postProcesarParaParserLegacy` para que el parser de v1 no se atragantara. En
 * esa versión las listas ya se convirtieron en párrafos con `• ` o `1. ` delante
 * y los `<h1>` ya se demotearon a `<h2>`. Leer `cuerpo` habiendo `doc` sería
 * elegir a propósito la copia con menos información.
 *
 * `cuerpo` solo se lee cuando NO hay `doc`, que es el caso de los escritos
 * anteriores al editor TipTap. Esos existen en producción y son la razón por la
 * que Phase 4 —la migración batch— se canceló conscientemente (ver `CLAUDE.md`).
 *
 * ══ LO QUE NO TIENE EQUIVALENTE, Y NO SE PIERDE EN SILENCIO ═════════════════
 *
 * `descartes` es la mitad importante de lo que devuelve este módulo. Un marcado
 * que el formato no sabe componer **se cuenta y se nombra** en vez de caer sin
 * dejar rastro: quien cablee esto tiene que poder ver que un documento traía
 * cosas que su papel no dice. Ver `Descarte`.
 *
 * Módulo NEUTRO: sin `'use client'`, sin DOM y sin imports fuera de los tipos de
 * su formato. El camino legacy se analiza con un tokenizador propio y no con
 * `DOMParser` a propósito — el handler de correo lo llama desde el servidor.
 */

import type {
  AlineacionEscrito,
  NodoEscrito,
  TramoTexto,
} from './formatos/EscritoMedico'

// ─── Lo que se devuelve ──────────────────────────────────────────────────────

/**
 * Un marcado que venía en el documento y que el formato no compone.
 *
 * No es un error: es información que el papel no va a decir, y decirlo es lo que
 * distingue una degradación declarada de una pérdida silenciosa.
 */
export interface Descarte {
  /** Qué se descartó, con el nombre que usa el editor: `tachado`, `código`… */
  readonly que: string
  /** Cuántas veces apareció. Una sola cursiva perdida y treinta no son lo mismo. */
  readonly veces: number
}

export interface CuerpoEscrito {
  readonly cuerpo: readonly NodoEscrito[]
  /** Vacío cuando el documento entero tiene equivalente. Ver `Descarte`. */
  readonly descartes: readonly Descarte[]
}

/** Acumulador de descartes. Se pasa hacia abajo y se lee al final. */
type Registro = Map<string, number>

function anotar(registro: Registro, que: string): void {
  registro.set(que, (registro.get(que) ?? 0) + 1)
}

function descartesDe(registro: Registro): readonly Descarte[] {
  return [...registro.entries()].map(([que, veces]) => ({ que, veces }))
}

// ─── Lectura defensiva del JSON ──────────────────────────────────────────────

/*
 * El JSON viene de `jsonb` y pudo escribirlo otra versión del formulario, así que
 * nada de lo que trae está garantizado. Se lee con guardas y sin `as`: un
 * documento malformado produce un cuerpo más corto, nunca una excepción en mitad
 * de la generación de un PDF.
 */

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function hijos(nodo: Record<string, unknown>): readonly unknown[] {
  return Array.isArray(nodo.content) ? nodo.content : []
}

function atributos(nodo: Record<string, unknown>): Record<string, unknown> {
  return esObjeto(nodo.attrs) ? nodo.attrs : {}
}

// ─── Alineación ──────────────────────────────────────────────────────────────

const ALINEACIONES: readonly string[] = ['center', 'right', 'justify']

/**
 * `left` devuelve `undefined` a propósito: es la bandera izquierda del chasis, y
 * no escribirla deja el caso normal sin propiedad de alineación. Ver
 * `AlineacionEscrito`, donde está declarada la excepción a I.3.2.
 */
function alineacionDe(nodo: Record<string, unknown>): AlineacionEscrito | undefined {
  const valor = atributos(nodo).textAlign
  if (typeof valor !== 'string') return undefined
  return ALINEACIONES.includes(valor) ? (valor as AlineacionEscrito) : undefined
}

// ─── Marcas de un tramo ──────────────────────────────────────────────────────

/**
 * Las tres marcas que el formato compone, y el nombre con que se descarta el resto.
 *
 * `bold`, `italic` y `underline` son los tres que la barra del editor ofrece
 * (`EditorEscrito.tsx:121-125`). Los demás llegan aquí porque `StarterKit` los
 * deja alcanzables por atajo de teclado aunque no tengan botón.
 */
const MARCAS_DESCARTADAS: Readonly<Record<string, string>> = {
  strike: 'tachado',
  code: 'código en línea',
  link: 'enlace',
  highlight: 'resaltado',
  subscript: 'subíndice',
  superscript: 'superíndice',
}

function marcasDe(valor: unknown, registro: Registro): Omit<TramoTexto, 'texto'> {
  if (!Array.isArray(valor)) return {}
  const marcas: Record<string, boolean> = {}
  for (const marca of valor) {
    if (!esObjeto(marca)) continue
    const tipo = texto(marca.type)
    if (tipo === 'bold') marcas.negrita = true
    else if (tipo === 'italic') marcas.cursiva = true
    else if (tipo === 'underline') marcas.subrayado = true
    else anotar(registro, MARCAS_DESCARTADAS[tipo] ?? tipo)
  }
  return marcas
}

// ─── Tramos ──────────────────────────────────────────────────────────────────

/**
 * Los tramos de un bloque de texto.
 *
 * `hardBreak` —el Shift+Enter del editor— se compone como salto DENTRO del tramo
 * anterior y no como párrafo nuevo: son dos cosas distintas en el editor y tienen
 * que seguir siéndolo en el papel. Sin esto, dos renglones separados a mano
 * saldrían pegados.
 */
function tramosDe(contenido: readonly unknown[], registro: Registro): TramoTexto[] {
  const tramos: TramoTexto[] = []
  for (const hijo of contenido) {
    if (!esObjeto(hijo)) continue
    const tipo = texto(hijo.type)

    if (tipo === 'hardBreak') {
      const ultimo = tramos[tramos.length - 1]
      if (ultimo === undefined) tramos.push({ texto: '\n' })
      else tramos[tramos.length - 1] = { ...ultimo, texto: `${ultimo.texto}\n` }
      continue
    }

    if (tipo !== 'text') {
      // Una imagen o un nodo desconocido dentro de un párrafo. El formato no
      // compone medios en el cuerpo (I.3.2 prohíbe el ornamento).
      if (tipo !== '') anotar(registro, tipo)
      continue
    }

    const contenidoTexto = texto(hijo.text)
    if (contenidoTexto === '') continue
    tramos.push({ texto: contenidoTexto, ...marcasDe(hijo.marks, registro) })
  }
  return tramos
}

// ─── Encabezados ─────────────────────────────────────────────────────────────

/**
 * EL MAPEO DE NIVELES, Y ES EL SITIO DONDE MÁS FÁCIL ES EQUIVOCARSE.
 *
 * ⚠ **LA BARRA DEL EDITOR OFRECE h2 Y h3, NO h1 Y h2.** `EditorEscrito.tsx:41-42`
 * rotula `h2` como «Título» y `h3` como «Subtítulo»; no hay botón de `h1`. Un
 * mapeo ingenuo `heading.level → encabezado${level}` mandaría el «Título» del
 * médico a `encabezado2` —el nivel menor— y dejaría el «Subtítulo» sin destino.
 *
 * Por eso:
 *
 *     h1  →  encabezado1     solo llega por el camino legacy
 *     h2  →  encabezado1     el «Título» de la barra
 *     h3+ →  encabezado2     el «Subtítulo» de la barra
 *
 * Coste aceptado: un documento legacy que use h1 Y h2 pierde la distinción entre
 * los dos, porque el formato tiene dos niveles y ahí había tres. Es la misma
 * degradación que ya hacía v1 —`postProcesarParaParserLegacy` reescribía `<h1>`
 * como `<h2>`— así que ningún papel cambia por esto.
 */
function nivelEncabezado(nivel: unknown): 'encabezado1' | 'encabezado2' {
  return typeof nivel === 'number' && nivel >= 3 ? 'encabezado2' : 'encabezado1'
}

// ─── Listas ──────────────────────────────────────────────────────────────────

/**
 * Los ítems de una lista, aplanados.
 *
 * ⚠ **LAS LISTAS ANIDADAS SE APLANAN AL PRIMER NIVEL Y SE ANOTAN.** `NodoEscrito`
 * declara `items` como una secuencia plana, así que una sublista no tiene dónde
 * componerse. Aplanarla conserva el texto —que es lo que el médico escribió— y
 * pierde la jerarquía. Es la misma decisión que tomó v1 y por el mismo motivo, y
 * aquí además queda contada en `descartes`.
 */
function itemsDeLista(
  contenido: readonly unknown[],
  registro: Registro,
): TramoTexto[][] {
  const items: TramoTexto[][] = []
  for (const item of contenido) {
    if (!esObjeto(item)) continue
    for (const bloque of hijos(item)) {
      if (!esObjeto(bloque)) continue
      const tipo = texto(bloque.type)
      if (tipo === 'bulletList' || tipo === 'orderedList') {
        anotar(registro, 'lista anidada')
        items.push(...itemsDeLista(hijos(bloque), registro))
        continue
      }
      const tramos = tramosDe(hijos(bloque), registro)
      if (tramos.length > 0) items.push(tramos)
    }
  }
  return items
}

// ─── Un nodo de bloque ───────────────────────────────────────────────────────

/**
 * Un bloque del documento → cero o un nodo del formato.
 *
 * Devuelve `null` cuando no hay nada que componer. El párrafo VACÍO es la
 * excepción y devuelve un nodo: en el editor una línea en blanco es un gesto
 * deliberado —separar los párrafos de una carta— y suprimirla cambiaría el
 * aspecto del papel. Se compone con un espacio para que la caja de línea exista;
 * un `Text` sin contenido mide cero. Las de los extremos sí se recortan, en
 * `limpiarExtremos`.
 */
function nodoDe(bloque: unknown, registro: Registro): NodoEscrito | null {
  if (!esObjeto(bloque)) return null
  const tipo = texto(bloque.type)
  const alineacion = alineacionDe(bloque)

  if (tipo === 'horizontalRule') return { tipo: 'separador' }

  if (tipo === 'heading') {
    const contenido = tramosDe(hijos(bloque), registro)
    const plano = contenido.map((t) => t.texto).join('')
    if (plano.trim() === '') return null
    return { tipo: nivelEncabezado(atributos(bloque).level), texto: plano, alineacion }
  }

  if (tipo === 'bulletList' || tipo === 'orderedList') {
    const items = itemsDeLista(hijos(bloque), registro)
    if (items.length === 0) return null
    return { tipo: 'lista', marca: tipo === 'orderedList' ? 'numero' : 'vineta', items }
  }

  if (tipo === 'blockquote') {
    // El blockquote CONTIENE párrafos, así que su texto y su alineación viven un
    // nivel más abajo. Se aplanan en una sola cita: el formato compone una.
    const dentro = hijos(bloque).filter(esObjeto)
    const tramos = dentro.flatMap((p) => tramosDe(hijos(p), registro))
    if (tramos.length === 0) return null
    const primero = dentro[0]
    return {
      tipo: 'cita',
      tramos,
      alineacion: primero === undefined ? alineacion : alineacionDe(primero),
    }
  }

  if (tipo === 'codeBlock') {
    anotar(registro, 'bloque de código')
    const tramos = tramosDe(hijos(bloque), registro)
    return tramos.length === 0 ? null : { tipo: 'parrafo', tramos, alineacion }
  }

  if (tipo !== 'paragraph') {
    if (tipo !== '') anotar(registro, tipo)
    return null
  }

  const tramos = tramosDe(hijos(bloque), registro)
  return tramos.length === 0
    ? { tipo: 'parrafo', tramos: [{ texto: ' ' }] }
    : { tipo: 'parrafo', tramos, alineacion }
}

/**
 * Quita los párrafos en blanco del principio y del final.
 *
 * El editor deja casi siempre uno al final —es donde queda el cursor— y ese no es
 * un gesto del médico: es un residuo de la interfaz. Los de EN MEDIO se conservan,
 * que es donde sí significan algo.
 */
function limpiarExtremos(nodos: readonly NodoEscrito[]): NodoEscrito[] {
  const vacio = (n: NodoEscrito): boolean =>
    n.tipo === 'parrafo' && n.tramos.every((t) => t.texto.trim() === '')
  let inicio = 0
  let fin = nodos.length
  while (inicio < fin && vacio(nodos[inicio])) inicio++
  while (fin > inicio && vacio(nodos[fin - 1])) fin--
  return nodos.slice(inicio, fin)
}

// ─── Camino 1 · el JSON del editor ───────────────────────────────────────────

/**
 * El documento de TipTap → el cuerpo del formato. Es el camino BUENO: conserva la
 * estructura entera, incluidas las listas y las alineaciones que `cuerpo` aplana.
 */
export function cuerpoDesdeDoc(doc: unknown): CuerpoEscrito {
  const registro: Registro = new Map()
  const raiz = esObjeto(doc) ? doc : {}
  const nodos: NodoEscrito[] = []
  for (const bloque of hijos(raiz)) {
    const nodo = nodoDe(bloque, registro)
    if (nodo !== null) nodos.push(nodo)
  }
  return { cuerpo: limpiarExtremos(nodos), descartes: descartesDe(registro) }
}

// ─── Camino 2 · el HTML de los escritos antiguos ─────────────────────────────

/*
 * Tokenizador propio, y no `DOMParser`, porque este módulo es neutro y el handler
 * de correo lo llama desde el servidor. Es el mismo enfoque que el parser de v1
 * (`EscritoMedicoPdf.tsx:134`) con dos diferencias que importan: aquí las marcas
 * ANIDAN —`<strong><em>x</em></strong>` conserva las dos, que v1 perdía— y las
 * listas se reconocen como listas en vez de aplanarse a párrafos con viñeta.
 */

const ENTIDADES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í',
  '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ',
}

function decodificar(html: string): string {
  return html.replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e)
}

/** Las marcas en línea que el HTML legacy puede traer, y qué son en el formato. */
const MARCA_POR_ETIQUETA: Readonly<Record<string, keyof Omit<TramoTexto, 'texto'>>> = {
  b: 'negrita', strong: 'negrita',
  i: 'cursiva', em: 'cursiva',
  u: 'subrayado',
}

/**
 * El texto en línea de un bloque, con sus marcas, respetando el anidamiento.
 *
 * Recorre la cadena con una PILA de marcas abiertas en vez de con una expresión
 * regular por pareja de etiquetas: es lo que permite que `<strong><em>` conserve
 * las dos. Las etiquetas sin equivalente —`<s>`, `<code>`— se anotan y su
 * contenido se conserva como texto plano.
 */
function tramosDeHtml(html: string, registro: Registro): TramoTexto[] {
  const tramos: TramoTexto[] = []
  const pila: string[] = []
  let resto = html

  const empujar = (crudo: string): void => {
    const limpio = decodificar(crudo)
    if (limpio === '') return
    const marcas: Record<string, boolean> = {}
    for (const etiqueta of pila) {
      const marca = MARCA_POR_ETIQUETA[etiqueta]
      if (marca !== undefined) marcas[marca] = true
    }
    tramos.push({ texto: limpio, ...marcas })
  }

  while (resto.length > 0) {
    const abre = resto.indexOf('<')
    if (abre === -1) { empujar(resto); break }
    if (abre > 0) empujar(resto.slice(0, abre))
    const cierra = resto.indexOf('>', abre)
    if (cierra === -1) { empujar(resto.slice(abre)); break }

    const etiqueta = resto.slice(abre + 1, cierra).trim()
    const nombre = etiqueta.replace(/^\//, '').split(/[\s/]/)[0].toLowerCase()
    if (etiqueta.startsWith('/')) {
      const i = pila.lastIndexOf(nombre)
      if (i !== -1) pila.splice(i, 1)
    } else if (!etiqueta.endsWith('/') && nombre !== 'br') {
      if (MARCA_POR_ETIQUETA[nombre] === undefined && nombre !== 'span') {
        anotar(registro, nombre === 's' || nombre === 'strike' ? 'tachado' : nombre)
      }
      pila.push(nombre)
    } else if (nombre === 'br') {
      empujar('\n')
    }
    resto = resto.slice(cierra + 1)
  }

  return tramos.filter((t) => t.texto !== '')
}

/** Los `<li>` de una lista, cada uno con sus marcas. */
function itemsDeHtml(interior: string, registro: Registro): TramoTexto[][] {
  if (/<(ul|ol)[\s>]/i.test(interior)) anotar(registro, 'lista anidada')
  const crudos = interior.match(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi) ?? []
  return crudos
    .map((li) =>
      tramosDeHtml(li.replace(/^<li(?:\s[^>]*)?>/i, '').replace(/<\/li>$/i, ''), registro),
    )
    .filter((tramos) => tramos.length > 0)
}

/** La alineación que el HTML legacy escribe como `style="text-align:…"`. */
function alineacionDeHtml(apertura: string): AlineacionEscrito | undefined {
  const m = /text-align:\s*(center|right|justify)/i.exec(apertura)
  return m === null ? undefined : (m[1].toLowerCase() as AlineacionEscrito)
}

const BLOQUE = /<(h[1-6]|p|ul|ol|blockquote)(\s[^>]*)?>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi

function bloqueDeHtml(
  etiqueta: string,
  apertura: string,
  interior: string,
  registro: Registro,
): NodoEscrito | null {
  const alineacion = alineacionDeHtml(apertura)

  if (etiqueta.startsWith('h')) {
    const tramos = tramosDeHtml(interior, registro)
    const plano = tramos.map((t) => t.texto).join('').trim()
    const nivel = Number.parseInt(etiqueta.slice(1), 10)
    return plano === '' ? null : { tipo: nivelEncabezado(nivel), texto: plano, alineacion }
  }

  if (etiqueta === 'ul' || etiqueta === 'ol') {
    const items = itemsDeHtml(interior, registro)
    return items.length === 0
      ? null
      : { tipo: 'lista', marca: etiqueta === 'ol' ? 'numero' : 'vineta', items }
  }

  if (etiqueta === 'blockquote') {
    const tramos = tramosDeHtml(interior, registro)
    return tramos.length === 0 ? null : { tipo: 'cita', tramos, alineacion }
  }

  const tramos = tramosDeHtml(interior, registro)
  return tramos.length === 0
    ? { tipo: 'parrafo', tramos: [{ texto: ' ' }] }
    : { tipo: 'parrafo', tramos, alineacion }
}

/**
 * El HTML de un escrito antiguo → el cuerpo del formato.
 *
 * Solo se llama cuando NO hay `doc`. Ver la cabecera del archivo.
 */
export function cuerpoDesdeHtml(html: string): CuerpoEscrito {
  const registro: Registro = new Map()
  const nodos: NodoEscrito[] = []
  const regex = new RegExp(BLOQUE.source, 'gi')
  let ultimo = 0
  let m: RegExpExecArray | null

  while ((m = regex.exec(html)) !== null) {
    // Texto suelto entre bloques: en el HTML viejo hay párrafos sin `<p>`.
    const suelto = html.slice(ultimo, m.index).trim()
    if (suelto !== '') {
      const tramos = tramosDeHtml(suelto, registro)
      if (tramos.length > 0) nodos.push({ tipo: 'parrafo', tramos })
    }
    if (m[1] === undefined) nodos.push({ tipo: 'separador' })
    else {
      const nodo = bloqueDeHtml(m[1].toLowerCase(), m[2] ?? '', m[3] ?? '', registro)
      if (nodo !== null) nodos.push(nodo)
    }
    ultimo = m.index + m[0].length
  }

  const cola = html.slice(ultimo).trim()
  if (cola !== '') {
    const tramos = tramosDeHtml(cola, registro)
    if (tramos.length > 0) nodos.push({ tipo: 'parrafo', tramos })
  }

  return { cuerpo: limpiarExtremos(nodos), descartes: descartesDe(registro) }
}

// ─── La puerta ───────────────────────────────────────────────────────────────

/**
 * El cuerpo del formato a partir de lo que la fila guarda.
 *
 * Es la función que el cableado llama, y la que decide entre los dos caminos con
 * el criterio de la cabecera: `doc` si lo hay, `cuerpo` si no.
 *
 * El `schema` se comprueba y no se supone: `documentos.contenido` es `jsonb` y
 * puede traer un `doc` escrito por una versión anterior del formulario. Sin la
 * comprobación, un esquema desconocido produciría un cuerpo vacío en silencio;
 * con ella cae al HTML, que es la copia degradada pero legible.
 */
export function cuerpoEscritoDesde(contenido: unknown): CuerpoEscrito {
  const fila = esObjeto(contenido) ? contenido : {}
  const doc = fila.doc

  if (esObjeto(doc) && texto(doc.schema) === 'tiptap-doc-v1') {
    const resultado = cuerpoDesdeDoc(doc.content)
    if (resultado.cuerpo.length > 0) return resultado
  }

  const html = texto(fila.cuerpo)
  return html === '' ? { cuerpo: [], descartes: [] } : cuerpoDesdeHtml(html)
}
