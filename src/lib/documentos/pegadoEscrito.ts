/**
 * Lo que entra al editor del Escrito médico al PEGAR, sin dependencias y sin DOM
 * (funciones de cadena: se prueban con Vitest en Node).
 *
 * 1. `markdownAHtml`: un texto con estructura Markdown que llega como TEXTO PLANO
 *    (sin `text/html` en el portapapeles: notas, WhatsApp, el «Copiar» de algunos
 *    chats) se convierte en HTML del esquema del editor, que ProseMirror parsea
 *    como siempre. Sin estructura Markdown devuelve `null` y el pegado sigue
 *    siendo el de siempre. Ctrl/⌘+Mayús+V no pasa por aquí (lo decide el editor).
 * 2. `htmlPegadoAlEsquema`: el HTML que sí trae el portapapeles, con dos arreglos
 *    antes de parsearlo: las tablas se vuelven renglones («campo: valor» con dos
 *    columnas, celdas unidas con « · » con más) y `h4`–`h6` pasan a `h3`.
 *
 * ── EL MAPEO DE ENCABEZADOS ─────────────────────────────────────────────────
 * El editor ofrece «Título» (`h2`) y «Subtítulo» (`h3`); `h1` se ve como Título y
 * el PDF v2 lo compone como `encabezado1`, igual que `h2` (`cuerpoEscrito.ts`,
 * `nivelEncabezado`). Por eso `#` y `##` → `h2` (Título) y `###`…`######` →
 * `h3` (Subtítulo); y del HTML pegado, `h4`–`h6` → `h3`. Ningún nivel nuevo.
 */

/** Escapa el texto para meterlo en HTML. */
function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Marcas en línea: `**negrita**`/`__negrita__` y `*cursiva*`/`_cursiva_`. Lo
 * demás (tachado, código) se deja como texto: el PDF no los compone.
 */
export function enLinea(t: string): string {
  return escapar(t)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g, '$1<em>$2</em>')
}

const RE_TITULO = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RE_VINETA = /^(\s*)[-*+]\s+(.*)$/
const RE_NUMERO = /^(\s*)(\d{1,9})[.)]\s+(.*)$/
const RE_CITA = /^\s{0,3}>\s?(.*)$/
const RE_SEPARADOR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const RE_FILA_TABLA = /^\s*\|.*\|\s*$/
const RE_FILA_SEPARA = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const RE_VALLA = /^\s*(```|~~~)/

/** ¿Tiene el texto estructura Markdown que valga la pena convertir? */
export function pareceMarkdown(texto: string): boolean {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const bloque = lineas.some(l => RE_TITULO.test(l) || RE_VINETA.test(l) || RE_NUMERO.test(l)
    || RE_CITA.test(l) || (RE_SEPARADOR.test(l) && l.trim().length >= 3) || RE_FILA_TABLA.test(l) || RE_VALLA.test(l))
  return bloque || /\*\*\S.*?\S\*\*/.test(texto)
}

/** Las celdas de una fila de tabla Markdown (`| a | b |`). */
function celdasMd(linea: string): string[] {
  return linea.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

/** Una fila de tabla → un renglón: «a: b» con dos celdas; «a · b · c» con más. */
export function renglonDeCeldas(celdas: readonly string[]): string {
  const llenas = celdas.filter(c => c.replace(/<[^>]+>/g, '').trim() !== '')
  if (llenas.length === 0) return ''
  return llenas.length === 2 ? `${llenas[0]}: ${llenas[1]}` : llenas.join(' · ')
}

/** Nivel de sangría de un ítem: un tabulador o dos espacios por nivel. */
function nivelDe(sangria: string): number {
  const ancho = sangria.replace(/\t/g, '  ').length
  return Math.floor(ancho / 2)
}

interface Item { tipo: 'ul' | 'ol'; nivel: number; texto: string; inicio: number }

/** Una lista (con sublistas por sangría) → HTML anidado `<ul>/<ol><li><p>…`. */
export function listaAHtml(items: readonly Item[]): string {
  let html = ''
  const abiertas: Item[] = []
  for (const it of items) {
    const nivel = Math.min(it.nivel, abiertas.length)
    while (abiertas.length > nivel + 1) html += `</li></${abiertas.pop()?.tipo}>`
    if (abiertas.length === nivel + 1 && abiertas[nivel].tipo !== it.tipo) html += `</li></${abiertas.pop()?.tipo}>`
    if (abiertas.length === nivel + 1) html += '</li>'
    else {
      const inicio = it.tipo === 'ol' && it.inicio !== 1 ? ` start="${it.inicio}"` : ''
      html += `<${it.tipo}${inicio}>`
      abiertas.push(it)
    }
    html += `<li><p>${enLinea(it.texto)}</p>`
  }
  while (abiertas.length > 0) html += `</li></${abiertas.pop()?.tipo}>`
  return html
}

/**
 * Texto plano con Markdown → HTML del esquema del editor, o `null` si no hay
 * estructura que convertir. Tablas → renglones; bloques de código → párrafos de
 * texto llano (sin convertir nada de dentro); líneas en blanco separan bloques.
 */
export function markdownAHtml(texto: string): string | null {
  if (!pareceMarkdown(texto)) return null
  const lineas = texto.replace(/\r/g, '').split('\n')
  const salida: string[] = []
  let lista: Item[] = []
  let cita: string[] = []
  let parrafo: string[] = []
  const sinLista = (): void => { if (lista.length) { salida.push(listaAHtml(lista)); lista = [] } }
  const sinCita = (): void => {
    const ps = cita.filter(p => p !== '')
    if (ps.length) salida.push(`<blockquote>${ps.map(p => `<p>${enLinea(p)}</p>`).join('')}</blockquote>`)
    cita = []
  }
  const sinParrafo = (): void => { if (parrafo.length) { salida.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`); parrafo = [] } }
  const cerrar = (): void => { sinLista(); sinCita(); sinParrafo() }
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    if (RE_VALLA.test(l)) {
      cerrar()
      let j = i + 1
      for (; j < lineas.length && !RE_VALLA.test(lineas[j]); j++) salida.push(`<p>${escapar(lineas[j]) || ' '}</p>`)
      i = j
      continue
    }
    if (l.trim() === '') { cerrar(); continue }
    let m: RegExpMatchArray | null
    if ((m = l.match(RE_TITULO))) { cerrar(); const h = m[1].length <= 2 ? 'h2' : 'h3'; salida.push(`<${h}>${enLinea(m[2])}</${h}>`); continue }
    if (RE_SEPARADOR.test(l)) { cerrar(); salida.push('<hr>'); continue }
    if (RE_FILA_TABLA.test(l)) {
      cerrar()
      if (!RE_FILA_SEPARA.test(l)) { const r = renglonDeCeldas(celdasMd(l).map(enLinea)); if (r) salida.push(`<p>${r}</p>`) }
      continue
    }
    if ((m = l.match(RE_CITA))) {
      sinLista(); sinParrafo()
      const t = m[1].trim()
      const ultimo = cita.length - 1
      if (t === '') { if (ultimo >= 0 && cita[ultimo] !== '') cita.push('') }
      else if (ultimo >= 0 && cita[ultimo] !== '') cita[ultimo] += ` ${t}`
      else cita.push(t)
      continue
    }
    if ((m = l.match(RE_VINETA)) || (m = l.match(RE_NUMERO))) {
      sinCita(); sinParrafo()
      lista.push(m.length === 4
        ? { tipo: 'ol', nivel: nivelDe(m[1]), texto: m[3], inicio: Number(m[2]) }
        : { tipo: 'ul', nivel: nivelDe(m[1]), texto: m[2], inicio: 1 })
      continue
    }
    // Una línea con sangría tras un ítem continúa el ítem.
    if (lista.length && /^\s{2,}\S/.test(l)) { lista[lista.length - 1].texto += ` ${l.trim()}`; continue }
    sinLista(); sinCita()
    parrafo.push(l.trim())
  }
  cerrar()
  return salida.join('')
}

/** Quita etiquetas salvo las marcas que el editor conserva. */
function soloMarcas(html: string): string {
  return html.replace(/<(?!\/?(strong|b|em|i|u)\b)[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * El HTML del portapapeles, antes de que lo parsee el editor: tablas → renglones
 * y `h4`–`h6` → `h3` (Subtítulo). Lo demás, intacto.
 */
export function htmlPegadoAlEsquema(html: string): string {
  const sinTablas = html.replace(/<table\b[\s\S]*?<\/table>/gi, tabla => {
    const filas = tabla.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []
    return filas.map(fila => {
      const celdas = (fila.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [])
        .map(c => soloMarcas(c.replace(/^<t[dh]\b[^>]*>/i, '').replace(/<\/t[dh]>$/i, '')))
      const r = renglonDeCeldas(celdas)
      return r ? `<p>${r}</p>` : ''
    }).join('')
  })
  return sinTablas
    .replace(/<h[456](\s[^>]*)?>/gi, (_m, a: string | undefined) => `<h3${a ?? ''}>`)
    .replace(/<\/h[456]\s*>/gi, '</h3>')
}

/** Palabras del cuerpo, para el contador del pie de la hoja. */
export function contarPalabras(texto: string): number {
  return texto.split(/\s+/).filter(p => /[\p{L}\p{N}]/u.test(p)).length
}
