/**
 * El folio: su forma canónica y cómo se lee lo que alguien te dicta.
 *
 * POR QUÉ ESTO ES UN MÓDULO Y NO UNA FUNCIÓN SUELTA DENTRO DEL BUSCADOR
 *
 * No es una abstracción: es el sitio donde queda escrito que **el cliente y la
 * base tienen que estar de acuerdo sobre la forma del folio**. `FOLIO_CANONICO`
 * es, carácter por carácter, el mismo patrón que el CHECK
 * `documentos_folio_formato_check` de `20260811_folio_03_denegacion.sql` —que
 * sustituye a folio_01 en los tres CHECK, ver su cabecera—, y los nueve
 * prefijos son los mismos nueve del `CASE` de
 * `public.generar_folio()`. Si los dos se separan, el buscador deja de encontrar
 * folios que la base sí emite — y lo hace en silencio, porque una búsqueda que
 * no encuentra nada se parece mucho a un folio que no existe. La prueba de
 * `src/lib/tests/folio.test.ts` es lo que convierte ese silencio en un fallo.
 *
 * LO QUE ESTE MÓDULO NO HACE: generar folios. El correlativo se resuelve en la
 * BASE y solo ahí (ver la cabecera del archivo SQL). Generarlo desde el reloj
 * del navegador es exactamente el defecto que produjo los 6 folios repetidos de
 * Honorarios que hay hoy en producción.
 */

/**
 * Los nueve prefijos, por clase de folio, en el orden del `CASE` del generador.
 *
 * La clave es la clase, no `documentos.tipo`, y los dos extremos de esa
 * distinción están aquí:
 *
 *   · Honorarios y Cotización comparten el mismo `tipo` en la tabla
 *     —`nota_honorarios`— y NO comparten serie: se separan por
 *     `contenido->>'tipo_doc'`.
 *   · La denegación va al revés: tipo propio —`denegacion_consentimiento`— y
 *     serie propia, sin discriminador. Un consentimiento y una denegación son
 *     actos opuestos, así que confundirlos en una lista sí hace daño.
 */
export const PREFIJO_POR_CLASE = {
  rx: 'RX',
  noh: 'NOH',
  cot: 'COT',
  ci: 'CI',
  lab: 'LAB',
  img: 'IMG',
  sup: 'SUP',
  int: 'INT',
  den: 'DEN',
} as const

export type ClaseFolio = keyof typeof PREFIJO_POR_CLASE

/**
 * QUÉ FORMATOS LLEVAN EL FOLIO DE LA SERIE IMPRESO EN EL PAPEL — y los tres que
 * no, cada uno por su motivo.
 *
 * ── POR QUÉ ESTO EXISTE, Y POR QUÉ AQUÍ ─────────────────────────────────────
 *
 * Tiene DOS consumidores que están obligados a coincidir: el formulario que
 * emite el documento y el botón que lo REGENERA meses después. Si el segundo
 * imprimiera el folio donde el primero no lo imprimió, el papel recuperado no
 * sería el papel entregado — que es justo lo que el guard de `formato_version`
 * existe para impedir por la otra vía, la del chasis.
 *
 * Escrito en dos sitios sería el «espejo manual» que ya lastra
 * `FORMATO_VERSION_GENERADOR`: dos listas que nadie recuerda mover a la vez.
 *
 * ── LOS TRES QUE NO ─────────────────────────────────────────────────────────
 *
 *   `receta`                  Lleva folio, pero **el suyo**: el `R-…` que el
 *                             formulario genera, que va dentro de `contenido` y
 *                             que resuelve el QR de verificación pública
 *                             (`/r/[folio]`). La serie `RX-…` de la columna
 *                             existe y no se imprime: dos números en la misma
 *                             ranura obligarían a decidir cuál se cita, y el que
 *                             está impreso hoy es el que verifica.
 *   `solicitud_internamiento` La fila lleva `INT-…` y el papel no lo dice, y las
 *                             dos cosas son ciertas a la vez: el expediente
 *                             numera todo lo que emite porque una serie con
 *                             huecos no se audita; nadie va a citar ese número
 *                             desde el hospital. Decisión reconfirmada — ver
 *                             `DOCUMENTOS_RANURAS_MUERTAS.md` §2.
 *   `escrito_medico`          **No tiene clase de folio.** El generador no lo
 *                             contempla y su columna queda NULL: no son
 *                             documentos seriados.
 */
const IMPRIME_FOLIO_DE_SERIE: ReadonlySet<string> = new Set([
  'solicitud_lab',
  'solicitud_imagen',
  'plan_suplementacion',
  'nota_honorarios',
  'consentimiento_informado',
  'denegacion_consentimiento',
])

/**
 * El folio que va al PDF, o `undefined` si ese formato no lo imprime.
 *
 * Lo llaman los formularios al emitir y el botón de regenerar al reproducir, y
 * por eso no admite un `tipo` tipado: el segundo lee `documentos.tipo` de una
 * fila, que es `string` y puede traer tipos que ningún formulario emite —subidas
 * clínicas, informes—. Los que no están en la lista no imprimen folio, que es la
 * respuesta correcta para todos ellos.
 */
export function folioImpreso(
  tipo: string,
  folioDeFila: string | null | undefined,
): string | undefined {
  if (folioDeFila === null || folioDeFila === undefined || folioDeFila === '') return undefined
  return IMPRIME_FOLIO_DE_SERIE.has(tipo) ? folioDeFila : undefined
}

/**
 * La forma canónica: `RX-2026-0042`. Cuatro dígitos de año, cuatro de
 * correlativo — o más, porque la serie 10 000 se ensancha, no se trunca.
 *
 * Gemelo exacto del CHECK de la columna. No lo cambies aquí sin cambiarlo allá.
 */
export const FOLIO_CANONICO = /^(?:RX|NOH|COT|CI|LAB|IMG|SUP|INT|DEN)-\d{4}-\d{4,}$/

/**
 * Lo que se acepta de quien lo teclea desde un papel: la clase en cualquier
 * caja, el separador que sea (o ninguno), y el correlativo sin los ceros de
 * relleno — `rx 2026 42` es `RX-2026-0042`.
 *
 * El separador se escribe como «ni dígito ni letra» y no como «guion o espacio»
 * a propósito: por teléfono salen guiones largos, puntos y barras, y ninguno
 * significa nada distinto.
 */
const DICTADO = /^(RX|NOH|COT|CI|LAB|IMG|SUP|INT|DEN)[^0-9A-Z]*(\d{4})[^0-9A-Z]*(\d+)$/

/**
 * Devuelve el folio canónico, o `null` si lo que entra no es un folio.
 *
 * **El `null` es la mitad importante.** Es lo que permite que el buscador
 * decida el modo por la forma de lo escrito, sin un conmutador que el médico
 * tenga que acordarse de pulsar: ningún nombre de paciente pasa por aquí, y
 * ninguna de las tres formas viejas tampoco —`R-a3f9b2c1d4e5` no tiene prefijo
 * válido y `NOH-20260416-53021` mete ocho dígitos donde van cuatro—. Que las
 * viejas se rechacen es deliberado: viven dentro de `contenido`, no en la
 * columna, y esta búsqueda mira la columna.
 */
export function normalizarFolio(entrada: string): string | null {
  const limpio = entrada.trim().toUpperCase().replace(/\s+/g, ' ')
  const m = DICTADO.exec(limpio)
  if (m === null) return null

  const [, prefijo, anio, correlativo] = m
  // Se quitan los ceros de relleno de lo dictado y se vuelve a rellenar a
  // cuatro: así `42`, `0042` y `00042` son el mismo folio, y `10000` sobrevive.
  const numero = correlativo.replace(/^0+(?=\d)/, '').padStart(4, '0')
  const folio = `${prefijo}-${anio}-${numero}`

  // Cinturón: lo que sale de aquí tiene que caber en la columna. Si el patrón
  // de dictado y el canónico se separaran, esto lo para en el cliente en vez de
  // mandar a la base una cadena que su CHECK va a rechazar.
  return FOLIO_CANONICO.test(folio) ? folio : null
}
