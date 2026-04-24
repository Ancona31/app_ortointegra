/**
 * Decodifica las entidades HTML más comunes a sus caracteres reales.
 *
 * Uso previsto: aplicar SOLO cuando el destino es texto plano (ej. render en
 * @react-pdf/renderer). NO aplicar a contenido HTML que se almacena o se
 * renderiza luego como HTML — decodificar `&amp;`, `&lt;`, `&gt;` rompería la
 * semántica del marcado.
 *
 * Incluye las entidades básicas + las que aparecen al pegar desde Word
 * (guiones largos/medios, elipsis, comillas tipográficas).
 */
export function decodificarEntidadesHTML(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Decodifica únicamente `&nbsp;` a espacio normal.
 *
 * Uso previsto: sanear contenido HTML antes de persistirlo en BD. Los
 * `&nbsp;` los inyecta `contentEditable` de forma automática y no aportan
 * semántica para expedientes médicos. El resto de entidades HTML se
 * preservan para no romper el marcado.
 */
export function decodificarNbsp(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.replace(/&nbsp;/g, ' ')
}
