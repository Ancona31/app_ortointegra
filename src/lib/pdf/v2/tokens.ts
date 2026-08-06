/**
 * Sistema de documentos v2 — capa de tokens.
 *
 * ANDAMIAJE INERTE (Pasos 0.a y 1). Este módulo todavía no tiene consumidores.
 * Nada de aquí afecta a los 8 formatos vivos, que siguen generándose con
 * `src/lib/pdf/` (v1) sin cambio alguno.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` §I.1, subsecciones I.1.1 a I.1.9.
 * Este archivo es una TRANSCRIPCIÓN de esa sección, no un diseño. Ningún valor
 * de aquí se inventó y ninguno se «mejoró»: si un número parece mal, se corrige
 * primero en el spec y después aquí.
 *
 * CONVENCIÓN DE NOMBRES (§0 del spec). Los tokens se nombran `grupo.token`. La
 * traducción a TypeScript es mecánica y la correspondencia es literal:
 *
 *   `papel.ancho`      → `PAPEL.ancho`
 *   `riel.celda`       → `RIEL_CELDA`        (grupo de un solo miembro)
 *   `espacio.16`       → `ESPACIO[16]`
 *   `filete.fino`      → `FILETE.fino`
 *   `tinta.negra`      → `TINTA.negra`
 *   `texto.corrido`    → `TIPOGRAFIA['texto.corrido']`  (clave literal del spec)
 *   `umbral.firma`     → `umbralFirma()`      (token derivado → función)
 *
 * TOKENS DERIVADOS. §0 exige que un token derivado se implemente como FÓRMULA y
 * no como su resultado. Los tres derivados de esta capa son funciones:
 * `darkenToContrast()`, `altoBloqueFirma()` y `umbralFirma()`. Si alguien los
 * congela en constantes, el token deja de estar implementado.
 *
 * Unidad: puntos PostScript (pt), la unidad nativa de @react-pdf/renderer.
 * El tracking va en em, tal como lo declara el spec.
 */

/** Hoja Carta en pt (8.5 × 11 in). */
export const PAPEL = {
  ancho: 612,
  alto: 792,
} as const

/** Caja de contenido: el área viva dentro de los márgenes. */
export const CAJA = {
  ancho: 486,
  alto: 670,
} as const

/**
 * Zona segura: banda perimetral que ninguna impresora de escritorio garantiza.
 * Nada imprimible debe entrar aquí.
 */
export const ZONA_SEGURA = 36

/** Márgenes de la hoja. Asimétricos: el izquierdo aloja el riel. */
export const MARGEN = {
  superior: 54,
  izquierdo: 72,
  derecho: 54,
  inferior: 68,
} as const

/** Retícula de 12 columnas sobre la caja de contenido. */
export const RETICULA = {
  columnas: 12,
  /** Ancho de una columna. */
  columna: 32.25,
  /** Separación entre columnas. */
  medianil: 9,
  /** Ancho del riel (columna de etiquetas a la izquierda del contenido). */
  riel: 23.25,
  /** Interlínea base: toda altura vertical es múltiplo de este valor. */
  lineaBase: 16,
} as const

/** Alto de una celda del riel. */
export const RIEL_CELDA = 40.5

// ───────────────────────────────────────────────────────────────────────────────
// I.1.4 · Tipografía
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Las dos familias del sistema.
 *
 * PROHIBIDAS por I.1.4: Roboto, Arial, Helvetica, cualquier fuente de sistema,
 * cualquier serif, e IBM Plex Mono. La mono solo existe en el marco de
 * documentación de las láminas de diseño; en documento impreso se sustituye por
 * la neo-grotesca (`CONCILIA D13, D20, D30`).
 */
export const FUENTE = {
  /** Identidad, títulos, datos, tablas, etiquetas, cifras. */
  neogrotesca: 'Archivo',
  /** Texto corrido largo, subtítulos, notas de firma. */
  humanista: 'IBM Plex Sans',
} as const

export type Familia = (typeof FUENTE)[keyof typeof FUENTE]

/** Pesos cargados por familia. Ningún rol puede pedir un peso fuera de aquí. */
export const FUENTE_PESOS = {
  neogrotesca: [400, 500, 600],
  humanista: [400, 500],
} as const

export type Peso = 400 | 500 | 600

/**
 * Color de un rol tipográfico, por NOMBRE de token, no por hex.
 *
 * Dos de estos valores no se pueden resolver a un hex fijo en esta capa:
 * `acento.tinta` depende del acento configurado por el médico (I.1.8), y
 * `contorno` no es un relleno sino un trazo (única ocurrencia: `marca.estado`).
 * Por eso el rol guarda el nombre del token y la resolución a hex vive en el
 * componente que lo pinta.
 */
export type ColorDeTexto =
  | 'tinta.negra'
  | 'tinta.secundaria'
  | 'tinta.etiqueta'
  | 'tinta.papel'
  | 'acento.tinta'
  | 'contorno'

/** Un miembro de la escala tipográfica de I.1.4. */
export interface RolTipografico {
  readonly familia: Familia
  /** Cuerpo en pt. */
  readonly cuerpo: number
  /**
   * Interlineado en pt. `null` cuando I.1.4 no lo declara, que ocurre en un
   * solo rol: `marca.estado`, que el spec fija solo en cuerpo (22 pt).
   */
  readonly interlineado: number | null
  readonly peso: Peso
  /** Tracking en em. Negativo = apretado. */
  readonly tracking: number
  readonly color: ColorDeTexto
}

/**
 * Escala tipográfica: los 23 roles de la tabla de I.1.4, con las claves
 * literales del spec para que la correspondencia sea inmediata.
 *
 * Seis de estos roles son conciliaciones de valores que divergían entre rondas
 * de diseño: `medico.nombre` (D7), `entrada.numero` (D11), `firma.nombre`
 * (D29), `etiqueta` (D-folio), `texto.corrido` (D8, D19, D28, D33) y
 * `marca.estado` (D18). Los valores de aquí son los que ganaron. No se
 * «restauran» los otros.
 *
 * VERSALITAS. `etiqueta` y `firma.rol` son versalitas, y no son versalitas
 * reales de la fuente: son mayúsculas con tracking. El motor transforma la
 * cadena a mayúsculas y aplica el tracking de esta tabla. Sustituirlas por
 * versalitas reales invalidaría todos los trackings de este archivo.
 */
export const TIPOGRAFIA = {
  'medico.nombre': { familia: FUENTE.neogrotesca, cuerpo: 26, interlineado: 28, peso: 600, tracking: -0.012, color: 'tinta.negra' },
  'medico.especialidad': { familia: FUENTE.neogrotesca, cuerpo: 7.5, interlineado: 12, peso: 500, tracking: 0.34, color: 'tinta.secundaria' },
  'medico.credencial': { familia: FUENTE.neogrotesca, cuerpo: 7.5, interlineado: 11, peso: 400, tracking: 0.06, color: 'tinta.secundaria' },
  'titulo.documento': { familia: FUENTE.neogrotesca, cuerpo: 17, interlineado: 20, peso: 600, tracking: 0.02, color: 'tinta.negra' },
  'titulo.subtitulo': { familia: FUENTE.humanista, cuerpo: 10.5, interlineado: 15, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  'titulo.seccion': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 14, peso: 600, tracking: 0.14, color: 'tinta.negra' },
  'seccion.numero': { familia: FUENTE.neogrotesca, cuerpo: 15, interlineado: 15, peso: 600, tracking: 0, color: 'acento.tinta' },
  etiqueta: { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 11, peso: 600, tracking: 0.22, color: 'tinta.etiqueta' },
  dato: { familia: FUENTE.neogrotesca, cuerpo: 12, interlineado: 16, peso: 400, tracking: 0, color: 'tinta.negra' },
  'texto.corrido': { familia: FUENTE.humanista, cuerpo: 11.5, interlineado: 18, peso: 400, tracking: 0, color: 'tinta.negra' },
  'tabla.celda': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  'entrada.ancla': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 15, peso: 600, tracking: 0, color: 'tinta.negra' },
  'entrada.secundario': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  'entrada.numero': { familia: FUENTE.neogrotesca, cuerpo: 13, interlineado: 17, peso: 600, tracking: 0, color: 'acento.tinta' },
  'firma.nombre': { familia: FUENTE.neogrotesca, cuerpo: 11.5, interlineado: 16, peso: 600, tracking: -0.012, color: 'tinta.negra' },
  'firma.rol': { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 11, peso: 600, tracking: 0.22, color: 'tinta.etiqueta' },
  'firma.credencial': { familia: FUENTE.neogrotesca, cuerpo: 7.5, interlineado: 11, peso: 400, tracking: 0.06, color: 'tinta.secundaria' },
  pie: { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 11, peso: 400, tracking: 0.1, color: 'tinta.papel' },
  'pie.leyenda': { familia: FUENTE.neogrotesca, cuerpo: 6, interlineado: 11, peso: 400, tracking: 0.05, color: 'tinta.papel' },
  folio: { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 14, peso: 500, tracking: 0.03, color: 'acento.tinta' },
  'alarma.cuerpo': { familia: FUENTE.humanista, cuerpo: 12, interlineado: 18, peso: 500, tracking: 0, color: 'tinta.negra' },
  'fecha.encabezado': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 11, peso: 400, tracking: 0, color: 'tinta.etiqueta' },
  'marca.estado': { familia: FUENTE.neogrotesca, cuerpo: 22, interlineado: null, peso: 600, tracking: 0.05, color: 'contorno' },
} as const satisfies Record<string, RolTipografico>

export type RolTipograficoNombre = keyof typeof TIPOGRAFIA

/** Roles que llevan cifras tabulares (I.1.4, párrafo bajo la escala). */
export const CIFRAS_TABULARES = [
  'dato',
  'tabla.celda',
  'entrada.numero',
  'folio',
  'medico.credencial',
  'firma.credencial',
  'pie',
] as const satisfies readonly RolTipograficoNombre[]

// ───────────────────────────────────────────────────────────────────────────────
// I.1.6 · Filetes
//
// Declarado antes de I.1.5 porque `manuscrito.grosor` ES `filete.fino` y aquí
// se deriva de él en vez de repetir el 0.8.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * La escala de seis grosores del sistema.
 *
 * `CONCILIA D-filetes` — el diseño usa nueve grosores. Tres NO son miembros de
 * esta escala sino geometría interna de un componente y se declaran en su ficha
 * de I.2, nunca aquí: el 2.5 pt del segmento grueso del filete principal (2.O),
 * y el 1.5 pt y el 0.5 pt de los anillos del panel circular (2.A). El contorno
 * de la marca de estado se unifica a `filete.regla` (había 0.7 y 0.5).
 *
 * «Quién usa cada grosor» se declara en la Sección II, no aquí: la columna
 * «reservado a» de una versión anterior del spec era falsa.
 */
export const FILETE = {
  /** Apertura de sección. */
  transicion: 4,
  /** Bloque de alarma. */
  alarma: 3,
  /** Cabecera de tabla · marco parcial de dos lados · marco del QR. */
  acento: 2,
  /** Bloque de cita · filete corto sobre el folio. */
  cita: 1.6,
  /** Escritura, firma, cierre de membrete, apertura y cierre de riel. */
  fino: 0.8,
  /** Regla entre entradas, entre celdas de riel, contorno de marca de estado. */
  regla: 0.5,
} as const

// ───────────────────────────────────────────────────────────────────────────────
// I.1.5 · Escritura manuscrita
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Espacio destinado a llenarse con pluma: líneas de campo vacío requerido,
 * bloques rayados, líneas de firma manuscrita.
 *
 * `CONCILIA D12, D27` — había tres altos (20, 16 y 11 pt). Gana el 20 pt, que
 * es el único medido contra una referencia física —pautado de cuaderno
 * profesional, 7.1 mm— en vez de contra el hueco disponible.
 */
export const MANUSCRITO = {
  /** 20 pt = 7.06 mm. */
  alto: 20,
  /** Presentación más larga del catálogo × 1.8. */
  ancho: 246,
  /** El spec lo declara como identidad, no como valor propio: es `filete.fino`. */
  grosor: FILETE.fino,
} as const

// ───────────────────────────────────────────────────────────────────────────────
// I.1.7 · Espaciado
// ───────────────────────────────────────────────────────────────────────────────

/** `espacio.base` = 4 pt. */
export const ESPACIO_BASE = 4

/**
 * La escala de 8 miembros. `espacio.16` → `ESPACIO[16]`.
 *
 * ALCANCE. La escala gobierna la separación vertical entre BLOQUES DE PRIMER
 * NIVEL. La geometría interna de un componente —aire entre panel y nombre,
 * padding de celda de riel, medianil de la zona de QR— se declara en la ficha
 * del componente con el valor extraído del diseño, aunque no sea múltiplo de 4.
 * El espécimen aprobado usa 14, 18, 10, 7, 6, 5 y 3 pt dentro de sus
 * componentes: forzarlos a esta escala sería rediseñar hojas ya aprobadas.
 */
export const ESPACIO = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  24: 24,
  32: 32,
  48: 48,
  64: 64,
} as const

// ───────────────────────────────────────────────────────────────────────────────
// I.1.8 · Color
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Los siete neutros.
 *
 * `hairline`, `reglaFila` y `reglaSuave` NO son colores de texto: son colores de
 * regla. Ningún texto del sistema los usa (I.1.8). El tipo `ColorDeTexto` los
 * excluye a propósito.
 */
export const TINTA = {
  /** Texto principal, filetes negros, fondo del bloque en negativo. */
  negra: '#101010',
  /** Subtítulos, cédulas, indicaciones de tabla. */
  secundaria: '#454545',
  /** Etiquetas en versalita, notas de firma. */
  etiqueta: '#737373',
  /** Reglas verticales del riel, cierre de fila. */
  hairline: '#D9D6D0',
  /** Separación entre filas de tabla larga. */
  reglaFila: '#EDEAE4',
  /** Filete fino secundario, anillo interior del panel. */
  reglaSuave: '#C9C5BD',
  /** Texto sobre banda de pie y sobre bloque en negativo. */
  papel: '#FFFFFF',
} as const

/** `acento.base` por defecto. Configurable por médico. */
export const ACENTO_BASE_POR_DEFECTO = '#1C3A5E'

/**
 * Parámetros de derivación del acento (tabla de I.1.8).
 *
 * Los dos tonos derivados NO son un porcentaje fijo del acento: se calculan
 * mezclándolo contra `tinta.negra` hasta alcanzar un contraste mínimo sobre
 * blanco. Eso es lo que permite aceptar cualquier acento sin romper la
 * legibilidad.
 */
export const ACENTO_DERIVACION = {
  /** Números de sección y de entrada, cifras de tabla, folio, monograma. */
  tinta: { objetivo: 4.5, tMax: 0.82 },
  /** Relleno de la banda de pie, con texto `tinta.papel` encima. */
  banda: { objetivo: 7, tMax: 0.65 },
  /**
   * `acento.velo` — `acento.base` al 6 % sobre blanco. Disco del panel y fondos
   * tenues. `CONCILIA D25`: había 6 % y 8 %, gana el 6 % del chasis. El máximo
   * admitido para cualquier fondo tenue es 12 %.
   */
  velo: { proporcion: 0.06, maximo: 0.12 },
} as const

/** Un color en canales enteros 0–255. */
export type Rgb = readonly [number, number, number]

/** `tinta.negra` en canales, que es el extremo de mezcla de la derivación. */
const NEGRO: Rgb = [16, 16, 16]

const BLANCO: Rgb = [255, 255, 255]

/**
 * Lee un hex a canales. Acepta `#RGB`, `#RRGGBB` y las dos formas sin `#`.
 * Devuelve `null` si el hex es inválido: quien llama decide el respaldo, esta
 * función no adivina.
 */
export function leerHex(hex: string): Rgb | null {
  const limpio = hex.trim().replace(/^#/, '')
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(limpio)) return null
  const largo = limpio.length === 3
  const par = (i: number): number =>
    largo
      ? parseInt(limpio[i]! + limpio[i]!, 16)
      : parseInt(limpio.slice(i * 2, i * 2 + 2), 16)
  return [par(0), par(1), par(2)]
}

/** Escribe canales a `#RRGGBB` en mayúsculas. */
export function escribirHex(rgb: Rgb): string {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Mezcla OPACA de `color` con `contra`, con `t` = proporción de `color`.
 * `round(c · t + contra · (1 − t))` por canal, tal como I.1.8.
 *
 * Es mezcla, no alfa. Un alfa en PDF depende del visor y del driver de
 * impresión; una mezcla opaca imprime igual en todas partes.
 */
export function mezclar(color: Rgb, contra: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) =>
    Math.round(color[i]! * t + contra[i]! * (1 - t)),
  ) as unknown as Rgb
}

/** Luminancia relativa WCAG. */
export function luminanciaRelativa(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste WCAG contra papel blanco: `1.05 / (L + 0.05)`. */
export function contrasteSobreBlanco(rgb: Rgb): number {
  return 1.05 / (luminanciaRelativa(rgb) + 0.05)
}

/**
 * Oscurece `hex` mezclándolo contra `tinta.negra` hasta que su contraste sobre
 * blanco alcance `objetivo`, empezando en `tMax` y bajando de centésima en
 * centésima mientras `t > 0.02`.
 *
 * Determinista y pura: mismo hex de entrada, mismo resultado. Si el hex es
 * inválido devuelve `tinta.negra`, que es el peor caso legible, nunca un valor
 * que rompa el render.
 *
 * `t` se lleva en centésimas enteras a propósito: restar 0.01 en punto flotante
 * acumula error y haría que el resultado dependa del recorrido.
 */
export function darkenToContrast(hex: string, objetivo: number, tMax: number): string {
  const base = leerHex(hex)
  if (base === null) return TINTA.negra
  let centesimas = Math.round(tMax * 100)
  while (centesimas > 2 && contrasteSobreBlanco(mezclar(base, NEGRO, centesimas / 100)) < objetivo) {
    centesimas -= 1
  }
  return escribirHex(mezclar(base, NEGRO, centesimas / 100))
}

/** El acento del médico, resuelto a los cuatro valores que consume el chasis. */
export interface AcentoResuelto {
  /** El hex configurado, normalizado. `tinta.negra` si el de entrada era inválido. */
  readonly base: string
  /** Derivado a 4.5 : 1 sobre blanco. Único acento admitido como color de texto. */
  readonly tinta: string
  /** Derivado a 7 : 1 sobre blanco. Relleno de la banda de pie. */
  readonly banda: string
  /** `base` al 6 % sobre blanco, por mezcla opaca. */
  readonly velo: string
  /**
   * `false` cuando el hex de entrada no era un hex válido. El documento se
   * emite igual, en tinta negra y sin acento (I.3.7: la validación bloquea en
   * el formulario, el render nunca colapsa).
   */
  readonly valido: boolean
}

/**
 * Deriva los tres tonos del acento a partir del hex configurado por el médico.
 *
 * REGLA DURA de I.1.8: el acento nunca es color de texto en su forma pura. Solo
 * aparece como filete, cuadro sólido, fondo tenue, o como `acento.tinta`
 * derivado. Por eso `base` no está en `ColorDeTexto`.
 *
 * Acepta cualquier hex válido, incluidos blanco, negro y amarillo puro: el
 * algoritmo los oscurece hasta cumplir el objetivo de contraste.
 */
export function resolverAcento(hex: string = ACENTO_BASE_POR_DEFECTO): AcentoResuelto {
  const leido = leerHex(hex)
  const valido = leido !== null
  const base = leido === null ? TINTA.negra : escribirHex(leido)
  return {
    base,
    valido,
    tinta: darkenToContrast(base, ACENTO_DERIVACION.tinta.objetivo, ACENTO_DERIVACION.tinta.tMax),
    banda: darkenToContrast(base, ACENTO_DERIVACION.banda.objetivo, ACENTO_DERIVACION.banda.tMax),
    velo: escribirHex(mezclar(leerHex(base)!, BLANCO, ACENTO_DERIVACION.velo.proporcion)),
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// I.1.9 · Firmas y umbral de flujo
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Espacio de escritura de la firma manuscrita.
 *
 * `CONCILIA D37, D35, A.17 #4` — token ÚNICO para toda firma del sistema. Se
 * retiró el tramo de 28 pt: ningún archivo del sistema lo instanciaba, y un
 * miembro de escala sin consumidores es deuda, no escala. El alto de la firma no
 * depende de la hoja ni del hueco sobrante (2.L, regla 1): si no caben todas en
 * una hoja se reparten en dos, nunca se comprimen.
 */
export const FIRMA = {
  espacio: 77,
} as const

/** Umbrales de párrafo (I.1.9). */
export const FLUJO = {
  orphans: 2,
  widows: 2,
  /** Líneas que bajan con la firma cuando no cabe el umbral (2.N, regla 1). */
  arrastre: 3,
} as const

/**
 * Rol del firmante. Determina cuántos renglones de identificación van bajo la
 * línea, y por tanto el alto del bloque.
 *
 * `firmante` cubre la tercera fila de la tabla de I.1.9 —paciente, familiar,
 * representante y testigo—, que comparten inventario de renglones.
 */
export type RolFirmante = 'medicoTratante' | 'anestesiologo' | 'firmante'

/**
 * Renglones de identificación bajo la línea, por rol (I.1.9 y 2.L).
 * Cada miembro es el nombre del rol tipográfico que compone ese renglón: el
 * alto del renglón es su interlineado, no un valor aparte.
 */
export const FIRMA_RENGLONES = {
  /** Nombre + céd. profesional + céd. de especialidad. */
  medicoTratante: ['firma.nombre', 'firma.credencial', 'firma.credencial'],
  /** Nombre + céd. profesional. */
  anestesiologo: ['firma.nombre', 'firma.credencial'],
  /** Nombre + rol o parentesco. */
  firmante: ['firma.nombre', 'firma.credencial'],
} as const satisfies Record<RolFirmante, readonly RolTipograficoNombre[]>

/**
 * Redondea a centésimas de punto. La escala de filetes introduce 0.8 y 1.6, que
 * no son exactos en binario; sin esto los altos salen como 130.80000000000001 y
 * dejan de ser comparables. No cambia ningún valor del spec, solo el ruido de
 * punto flotante.
 */
function redondearPt(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * `firma.bloque.alto(renglones)` de I.1.9, como fórmula:
 *
 *     firma.rol + firma.espacio + filete.fino + espacio.4
 *               + Σ(renglones de identificación)
 *
 * El rol va ENCIMA de la línea, en versalita; el nombre y las credenciales van
 * debajo. Ese renglón del rol es lo que le faltaba a la composición de 119.8 pt
 * de una versión anterior del spec.
 *
 * Valor de referencia del spec para `medicoTratante`: 131.8 pt.
 * ⚠️ Esta fórmula devuelve 130.8 pt. La diferencia de 1 pt está EN EL SPEC, que
 * en I.1.9 escribe su propia suma como `11 + 77 + 0.8 + 4 + 16 + 11 + 11 =
 * 130.8` y a continuación la declara «131.8 incluyendo el filete», contando el
 * filete dos veces. Los tres roles de la tabla salen 1 pt por debajo del valor
 * declarado, con el mismo desfase. Aquí manda la fórmula, que es lo que §0
 * exige implementar; el número declarado se corrige en el spec, no aquí.
 */
export function altoBloqueFirma(rol: RolFirmante): number {
  const renglones = FIRMA_RENGLONES[rol].reduce(
    (suma, nombre) => suma + (TIPOGRAFIA[nombre].interlineado ?? 0),
    0,
  )
  return redondearPt(
    (TIPOGRAFIA['firma.rol'].interlineado ?? 0) +
      FIRMA.espacio +
      FILETE.fino +
      ESPACIO[4] +
      renglones,
  )
}

/**
 * `umbral.firma` de I.1.9, como fórmula:
 *
 *     firma.bloque.alto(rol) + espacio.16 + 3 × texto.corrido.interlineado
 *
 * Regla 1 del motor de flujo (2.N): si en la hoja no cabe este umbral, las
 * últimas tres líneas del contenido bajan con la firma. El «3» de la fórmula y
 * `flujo.arrastre` son el mismo 3 por la misma razón —son esas tres líneas—, así
 * que aquí se deriva de `FLUJO.arrastre` en vez de repetirse.
 *
 * `El renglón es 18 pt y no hay debate.` Los umbrales de 185 pt y 189.8 pt son
 * de generaciones muertas: el primero se calculó con renglón de 17 pt, el
 * segundo con una composición de firma sin el renglón del rol (`CONCILIA D43`).
 *
 * Valor de referencia del spec: 201.8 pt. Esta fórmula devuelve 200.8 pt, por
 * el mismo desfase de 1 pt de `altoBloqueFirma` documentado arriba.
 */
export function umbralFirma(rol: RolFirmante = 'medicoTratante'): number {
  return redondearPt(
    altoBloqueFirma(rol) +
      ESPACIO[16] +
      FLUJO.arrastre * (TIPOGRAFIA['texto.corrido'].interlineado ?? 0),
  )
}
