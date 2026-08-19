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
 *   `papel.ancho`         → `PAPEL.ancho`
 *   `riel.celda`          → `RIEL_CELDA`     (grupo de un solo miembro)
 *   `espacio.16`          → `ESPACIO[16]`
 *   `filete.fino`         → `FILETE.fino`
 *   `tinta.negra`         → `TINTA.negra`
 *   `transicion.tituloRiel` → `TRANSICION.tituloRiel`
 *   `texto.corrido`       → `TIPOGRAFIA['texto.corrido']` (clave literal del spec)
 *   `umbral.firma`        → `umbralFirma()`  (token derivado → función)
 *
 * TOKENS DERIVADOS. §0 exige que un token derivado se implemente como FÓRMULA y
 * no como su resultado. En esta capa son cinco: `CAJA.alto` y `CIERRE.izquierda`
 * (expresiones) y las funciones `darkenToContrast()`, `altoBloqueFirma()` y
 * `umbralFirma()`. Si alguien los congela en literales, el token deja de estar
 * implementado.
 *
 * Unidad: puntos PostScript (pt), la unidad nativa de @react-pdf/renderer.
 * El tracking va en em, tal como lo declara el spec.
 */

/** Hoja Carta en pt (8.5 × 11 in). */
export const PAPEL = {
  ancho: 612,
  alto: 792,
} as const

/**
 * I.1.2 · Márgenes de la hoja. Asimétricos.
 *
 * DESGLOSE DEL MARGEN INFERIOR, que es la parte que hay que respetar al implementar:
 * 36 pt de papel intocable + 16 pt de banda de pie + 16 pt de aire. La banda de pie es
 * tinta, no sangre: vive DENTRO de la zona segura y FUERA de la caja de texto, así que
 * el margen inferior no se mide hasta la banda.
 *
 * ═══ SE AUTORIZÓ IGUALAR LOS CUATRO. SE MIDIÓ ENTERO Y NO SE APLICÓ ═══
 *
 * Angel autorizó bajar los cuatro al mismo valor, retirando la razón del izquierdo
 * ampliado —«no se perfora nada»— y respetando solo `ZONA_SEGURA`. **Se compuso, se
 * midió el sistema entero y se revirtió.** Queda escrito con las cifras para que
 * retomarlo sea una decisión y no una nueva investigación.
 *
 * A QUÉ VALORES LLEGAN, Y CUÁNTO GANA LA CAJA
 *
 *     superior    54 → 36     el suelo es `ZONA_SEGURA`
 *     izquierdo   72 → 36     sin la razón del perforado, iguala
 *     derecho     54 → 36
 *     inferior    68 → 63     ⚠ el único que NO llega a 36
 *
 *     caja        486 × 670  →  540 × 693      +54 de ancho, +23 de alto
 *
 * ⚠ **EL INFERIOR NO PUEDE BAJAR A 36 Y NO ES PRUDENCIA: ES QUE NO ESTÁ VACÍO.**
 * Contando desde el borde inferior, 0→36 es la zona segura; 36→52 la banda de pie de
 * 2.M, anclada a `bottom: ZONA_SEGURA`, que es TINTA; y 52→63 el aviso de continuación
 * de 2.N, anclado a `bottom: margen.inferior − pie.interlineado`, que también lo es.
 * Con el margen en 36 la caja pasaría por encima de las dos. Su suelo real son 63.
 *
 * POR QUÉ SE REVIRTIÓ — **compra CERO medicamentos, RE-MEDIDO TRAS EL CAMBIO DE LA VÍA**
 *
 * ⚠ **LA PRIMERA MEDICIÓN ERA ANTERIOR A QUE LA VÍA SUBIERA AL RENGLÓN DEL ANCLA**, así
 * que contaba una entrada de ~75 pt que ya no existe: hoy mide 58.5. Se volvió a medir
 * componiendo el PDF con la rama al día, y **el resultado no cambia**:
 *
 *     capacidad en UNA hoja, con recomendaciones, firma y código
 *
 *                              márgenes actuales   igualados 36/36/36/63
 *     entrada de 58.5 pt              4                    4
 *     entrada de 72.5 pt              3                    3
 *
 * El quinto medicamento cuesta **54 pt** de alto —umbral medido barriendo el margen
 * vertical hasta que entra— y los cuatro márgenes igualados dan **23** (18 arriba + 5
 * abajo). Faltan 31. Los 54 pt de ganancia HORIZONTAL no cuentan para esto: ensanchan
 * la caja, no añaden renglones.
 *
 * ⚠ **Y EL CUELLO DE BOTELLA NO ES LA LISTA.** La lista sola aguanta 5, 6 y 7 en la hoja
 * 1 (ver `recetaMedica.test.ts`); lo que no cabe detrás de ella es la fila de cierre. Por
 * eso el margen no es la palanca, y por eso tampoco lo es reducir la tipografía de la
 * entrada: se midió a −10 %, −15 % y −30 % proporcional sobre los cuatro roles de
 * `entradaMedicamento.*`, y **−10 y −15 compran CERO**; solo −30 compra uno, dejando la
 * indicación en 7 pt y más pequeña que las recomendaciones generales. No se aplicó.
 *
 * LO QUE COSTABA, MEDIDO SOBRE LAS 455 PRUEBAS
 *
 * Veinte cotas en ocho formatos. La mayoría son desplazamientos mecánicos, pero **no
 * todas**: al ensanchar la caja 54 pt el texto re-envuelve y hay cambios de forma —el
 * encabezado del Consentimiento encoge 20 pt de más, el catálogo de Internamiento deja
 * de repartir en tres columnas de 162, la credencial de la Denegación deja de romper a
 * dos renglones—. Esas cotas son la conciliación contra las láminas aprobadas, y **las
 * láminas `.dc.html` no están en el repo**: reescribirlas convierte ocho suites de
 * conciliación en fotos de lo que el código hace hoy, sin vuelta atrás.
 *
 * Además el defecto de compresión del chasis se reubica: sale de Imagenología con siete
 * estudios y entra en Laboratorio, al 1.6 %.
 *
 * **Lo que se conserva del intento:** `CAJA.ancho`, `RETICULA.columna`, `RIEL_CELDA` y
 * `ZONA.texto` pasaron a DERIVARSE de los márgenes en vez de llevar su cifra escrita.
 * Con los márgenes actuales dan exactamente lo de antes —486, 32.25, 40.5 y 321— y el
 * día que se muevan, se mueven solos. Ese trabajo ya está hecho.
 */
export const MARGEN = {
  superior: 54,
  izquierdo: 72,
  derecho: 54,
  inferior: 68,
} as const

/**
 * Caja de contenido: el área viva dentro de los márgenes.
 *
 * `alto` es un token DERIVADO y va como fórmula, no como su resultado (§0). El
 * valor de referencia es 670 pt; un 670 literal aquí significaría que el token
 * no está implementado.
 *
 * ⚠ **`ancho` PASA A SER DERIVADO, Y ERA UN VALOR PROPIO DE 486.** I.1.1 lo declaraba
 * «token único de texto corrido en todo el sistema» con cifra propia, y funcionaba
 * porque 612 − 72 − 54 daba exactamente 486. Al igualar los márgenes esa coincidencia
 * se rompe, y de las dos formas de arreglarla —mover la cifra a mano o derivarla— solo
 * una no se puede desincronizar. Un 486 literal en el código significa ahora que el
 * token no está implementado. Hoy vale **540**.
 *
 * El 453.75 pt que apareció en Plan de Suplementación queda eliminado — no existe un
 * segundo ancho de caja.
 */
export const CAJA = {
  ancho: PAPEL.ancho - MARGEN.izquierdo - MARGEN.derecho,
  alto: PAPEL.alto - MARGEN.superior - MARGEN.inferior,
} as const

/**
 * Zona segura: banda perimetral que ninguna impresora de escritorio garantiza,
 * por los cuatro lados. Cubre el área no imprimible de 4–5 mm de una impresora
 * de consultorio. Ningún elemento con tinta la cruza.
 */
export const ZONA_SEGURA = 36

const RETICULA_COLUMNAS = 12
const RETICULA_MEDIANIL = 9

/**
 * Retícula de 12 columnas sobre la caja de contenido.
 *
 * ⚠ **`columna` PASA A DERIVADO, Y ERA 32.25.** Como `CAJA.ancho`, su cifra propia
 * cuadraba con la caja de 486 por construcción —12 × 32.25 + 11 × 9 = 486— y al
 * ensanchar la caja deja de cuadrar. Derivada vale **36.75**. Un 32.25 literal
 * significa que el token no está implementado.
 *
 * `riel` NO se deriva y sigue en 23.25: es el ancho de la columna de etiquetas, y lo
 * fija el número de dos dígitos que vive dentro, no el ancho de la hoja. Que antes
 * midiera `columna − medianil` era coincidencia de la caja de 486.
 */
export const RETICULA = {
  columnas: RETICULA_COLUMNAS,
  /** Ancho de una columna. DERIVADO de la caja. */
  columna:
    (CAJA.ancho - RETICULA_MEDIANIL * (RETICULA_COLUMNAS - 1)) / RETICULA_COLUMNAS,
  /** Separación entre columnas. */
  medianil: RETICULA_MEDIANIL,
  /** Ancho del riel (columna de etiquetas a la izquierda del contenido). */
  riel: 23.25,
  /** Interlínea base: toda altura vertical es múltiplo de este valor. */
  lineaBase: 16,
} as const

/**
 * Alto de una celda del riel. **DERIVADO, y era 40.5.**
 *
 * Los 40.5 eran `CAJA.ancho / 12` con la caja de 486, y 2.D lo usa como unidad de
 * ANCHO para repartir el catálogo en columnas (`RielDatos`, `anchoCatalogo`): doce
 * celdas tienen que sumar la caja o el riel deja de llegar al borde. Con la caja en
 * 540 vale **45**.
 */
export const RIEL_CELDA = CAJA.ancho / RETICULA_COLUMNAS

/**
 * I.1.3 · La fila de cierre: la última fila de la hoja, la que reparte el pie del
 * contenido entre lo que se firma y lo que se cuenta. La misma en los ocho
 * formatos — la caja de firma (2.L) vive en su columna IZQUIERDA, y en el Recibo la
 * derecha es la que ocupa `RielImportes` (2.T).
 *
 * Es la TERCERA partición de la caja de 486 pt, y convive con las otras dos por la
 * misma razón que ellas conviven entre sí: cada una separa cosas distintas con
 * separadores distintos. No sale de `reticula.columna` y no tiene por qué —esta
 * fila es de dos columnas con medianil propio, medido en la hoja aprobada—, y ese
 * fue justamente el motivo de que H9 quedara abierto toda la conciliación: se
 * buscaba el 246 en la retícula de doce, que es la partición equivocada.
 *
 * ⚠ **LOS DOS NOMBRES ESTABAN CAMBIADOS Y QUEDAN CORREGIDOS.** La versión anterior
 * declaraba `cierre.derecha` = 246 y derivaba `cierre.izquierda` = 216, y I.1.3
 * decía «la caja de firma vive en su columna derecha». Las láminas dicen lo
 * contrario y lo dicen dos veces, con la cifra al lado: `SPEC_DISENO_PARTE_B.md`
 * B.3 §2 y B.4 componen la fila de cierre como «**firma a la izquierda (246 pt)** ·
 * QR y folio de verificación a la derecha». La columna ancha es la izquierda. El
 * valor propio pasa a `izquierda` y el DERIVADO a `derecha`: un 216 literal en el
 * código significa que el token no está implementado.
 *
 * `COINCIDENCIA` — `izquierda` mide lo mismo que `MANUSCRITO.ancho` (246 pt) y NO
 * son el mismo valor: uno es el ancho de una columna de maquetación, el otro el de
 * una línea destinada a llenarse con pluma, medida contra la presentación más
 * larga del catálogo. **No los fusiones.** Si cambia el ancho de la línea de
 * escritura, esta columna no se mueve.
 */
const CIERRE_IZQUIERDA = 246
const CIERRE_MEDIANIL = 24

export const CIERRE = {
  izquierda: CIERRE_IZQUIERDA,
  medianil: CIERRE_MEDIANIL,
  derecha: CAJA.ancho - CIERRE_IZQUIERDA - CIERRE_MEDIANIL,
} as const

/**
 * I.1.3 · Las dos zonas del bloque de título, declaradas por el diseño (A.2 y A.8):
 * el texto ocupa las columnas 1–8 y el riel de folio las 9–12.
 *
 * ⚠ **`texto` PASA A DERIVADO, Y ERA 321.** La partición cuadraba con la caja de 486
 * —321 + 9 + 156— y al ensancharla hay que decidir quién absorbe los 54 pt nuevos. Se
 * los queda el TEXTO: el riel de la derecha imprime el folio y la emisión, dos cadenas
 * de longitud fija que no ganan nada con más sitio, y el título sí. `texto` vale
 * ahora **375**.
 */
const ZONA_RIEL = 156

export const ZONA = {
  texto: CAJA.ancho - RETICULA_MEDIANIL - ZONA_RIEL,
  riel: ZONA_RIEL,
} as const

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
  // Interlineado 14, no 15: A.8 (espécimen) dice 15 y B.1 §1 mide 10.5 / 14 en la
  // lámina del formato, que es la que manda.
  'titulo.subtitulo': { familia: FUENTE.humanista, cuerpo: 10.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  'titulo.seccion': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 14, peso: 600, tracking: 0.14, color: 'tinta.negra' },
  'seccion.numero': { familia: FUENTE.neogrotesca, cuerpo: 15, interlineado: 15, peso: 600, tracking: 0, color: 'acento.tinta' },
  // ── LOS DOS ROLES QUE EL RIEL DESVÍA, Y QUE AQUÍ NO SE MUEVEN.
  //
  // La celda del riel de identificación mide 30 pt en la lámina —3 + 10 + 13 + 4— y
  // eso pide rótulo 7 / 10 y valor 11.5 / 13. **Esos dos valores son del RIEL, no de
  // la escala**, y viven declarados como desviación en la ficha de 2.F.
  //
  // Una generación anterior los bajó aquí y arrastró cinco elementos que la lámina
  // mide en 7 / 11: cabecera de tabla (2.G), etiqueta de folio (2.C), bloque en
  // negativo (2.H), encabezado de 2.J y rótulo de campo (2.E). **La escala no se
  // toca por un componente**: si un segundo componente pidiera 7 / 10, entonces sí
  // sería un rol y subiría aquí con nombre propio.
  etiqueta: { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 11, peso: 600, tracking: 0.22, color: 'tinta.etiqueta' },
  dato: { familia: FUENTE.neogrotesca, cuerpo: 12, interlineado: 16, peso: 400, tracking: 0, color: 'tinta.negra' },
  'texto.corrido': { familia: FUENTE.humanista, cuerpo: 11.5, interlineado: 18, peso: 400, tracking: 0, color: 'tinta.negra' },
  'tabla.celda': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  'entrada.ancla': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 15, peso: 600, tracking: 0, color: 'tinta.negra' },
  'entrada.secundario': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  'entrada.numero': { familia: FUENTE.neogrotesca, cuerpo: 13, interlineado: 17, peso: 600, tracking: 0, color: 'acento.tinta' },
  // ── Calibración COMPACTA de la entrada (2.G). Medida en la lámina de
  // Laboratorio, B.1 §3, fila «lista larga (18 / 19 filas)». Es la calibración que
  // hace que 18 estudios quepan en una hoja, y la que `D4` había eliminado. NO la
  // elige el número de ítems en tiempo de render: la declara el formato.
  //
  // ⚠ **LOS TRES PESOS SON 400, Y DOS DE ELLOS ERAN 600 POR MEZCLA DE FUENTES.**
  //
  // La primera versión de estos roles tomó el CUERPO de B.1 §3 y el PESO de los
  // roles `entrada.*` del chasis, que son 600. Es mezcla de dos fuentes, y produce
  // una hoja que se parece a la lámina sin serlo: los estudios salían en negrita.
  //
  // La lista de Laboratorio **no es una `EntradaNumerada`**: B.1 §3 y §6 la declaran
  // como la variante grid del componente `Tabla`, y sus celdas son el rol
  // `tabla.celda`, que A.4 fija en **Archivo 9.5 / 14 pt, peso 400**. A.11 lo dice
  // por contraste dentro de su propia ficha: declara «600» explícito para la
  // cabecera y para la fila de total, y NO declara peso para los cuerpos de celda,
  // que por tanto se quedan en el del rol. Los roles `entrada.ancla` y
  // `entrada.numero` de los que salió el 600 son de la Receta —A.4 los marca
  // `NO DEFINIDO en el chasis`, «nace en la Receta Médica»— y no gobiernan esta
  // tabla.
  //
  // `DERIVADO, NO MEDIDO` — el archivo de la lámina no está en el repo, así que esto
  // sale de A.4 + A.11 + B.1 §3, no de abrir el HTML. B.1 §3 no tiene columna de
  // peso para ninguna de las dos calibraciones, así que su silencio no distingue.
  // El número es el menos firme de los tres: es la única celda con color de acento,
  // y en los otros tres formatos el número de entrada sí va en 600 —pero esos son
  // entradas, no tablas.
  'entradaCompacta.numero': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 11.5, peso: 400, tracking: 0, color: 'acento.tinta' },
  'entradaCompacta.ancla': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 11.5, peso: 400, tracking: 0, color: 'tinta.negra' },
  // La indicación va en humanista y en `tinta.secundaria` (#454545), textual de B.1
  // §3. Su peso YA era el correcto: 400, el de `texto.corrido` y el único que la
  // humanista tiene cargado junto al 500. No se toca.
  'entradaCompacta.nota': { familia: FUENTE.humanista, cuerpo: 9, interlineado: 11.5, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  // ── Calibración `estudio` de la entrada (2.G). Medida en la lámina de
  // Imagenología: es la lista APILADA de cuatro datos, no la tabla de columnas de
  // Laboratorio. Cuatro roles y no dos porque la ranura `nota` de este formato
  // lleva rótulo colgado propio —`Indicación`—, que la calibración `compacta` no
  // tiene.
  //
  // ⚠ **LOS PESOS SON LOS DE LA LÁMINA Y NO LOS DEL ROL QUE HEREDARÍAN.** Es la
  // trampa que ya se pagó una vez en `entradaCompacta.*`, donde el cuerpo salió de
  // la lámina y el peso de `entrada.*`, y los estudios se compusieron en negrita.
  // Aquí el ancla SÍ va en 600 y el secundario en **500**, que no es ni el 400 de
  // `entrada.secundario` ni el 600 del ancla.
  //
  // La otra herencia que NO se toma: `entrada.secundario` va en `tinta.negra` por
  // la regla 5 de 2.G —en la Receta ese renglón es la denominación genérica—. En
  // esta lámina el secundario son las PROYECCIONES y va en `tinta.secundaria`. La
  // regla 5 protege un dato normativo de la Receta, no este renglón.
  //
  // El número no sube aquí: la lámina lo compone a 13 / 17 en 600 y acento, que es
  // exactamente `entrada.numero`. Un quinto rol idéntico a uno existente sería
  // deuda.
  'entradaEstudio.ancla': { familia: FUENTE.neogrotesca, cuerpo: 12.5, interlineado: 17, peso: 600, tracking: -0.005, color: 'tinta.negra' },
  'entradaEstudio.secundario': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 13, peso: 500, tracking: 0, color: 'tinta.secundaria' },
  'entradaEstudio.rotuloNota': { familia: FUENTE.neogrotesca, cuerpo: 6.5, interlineado: 16, peso: 600, tracking: 0.2, color: 'tinta.etiqueta' },
  'entradaEstudio.nota': { familia: FUENTE.humanista, cuerpo: 10.5, interlineado: 16, peso: 400, tracking: 0, color: 'tinta.negra' },
  // ── Calibración `medicamento` de la entrada (2.G). Medida en la lámina aprobada
  // de Receta, hoja `B · 7 medicamentos`. Es la lista APILADA de CINCO datos —el
  // número en el riel y cuatro en la caja—, y por eso son cinco roles y no cuatro:
  // ninguna de las otras dos calibraciones tiene una ranura de vía.
  //
  // ⚠ **NINGUNO DE LOS CINCO ES EL ROL `entrada.*` QUE HEREDARÍAN**, y esta es la
  // tercera vez que hay que decirlo en esta tabla. Aquí las diferencias son de un
  // punto y por eso se cuelan con más facilidad que las de `entradaCompacta.*`:
  //
  //     número      13 / **16**   `entrada.numero` va a 13 / 17
  //     ancla       **12** / 16   `entrada.ancla` va a 11 / 15 y sin tracking
  //     genérico    10 / 13 · **500**   `entrada.secundario` va a 9.5 / 14 en 400
  //
  // **EL TRACKING DEL ANCLA SALE DE UN PÍXEL Y MEDIO.** La lámina es HTML a 96 dpi
  // y mide `letter-spacing: -0.08px`; a cuerpo 12 pt —que son 16 px— eso es
  // **−0.005 em**, que es lo que `SPEC_DISENO_PARTE_B.md` B.3 §3 anota por su
  // cuenta. La conversión px → em es la misma que valida los trackings de la banda
  // de pie contra esta lámina: 0.933 px a 7 pt es `pie` (0.1 em) y 0.4 px a 6 pt es
  // `pie.leyenda` (0.05 em), los dos exactos.
  //
  // **EL GENÉRICO VA EN TINTA PLENA Y ESO NO ES UNA ELECCIÓN.** Es la regla 5 de
  // 2.G: la denominación genérica es el único campo obligatorio por normativa. La
  // lámina no declara `color` en ese renglón y por tanto hereda `#101010` del
  // contenedor, que es lo mismo que declarar `tinta.negra`. Es la diferencia con
  // `entradaEstudio.secundario`, que sí va en `tinta.secundaria` porque allí ese
  // renglón son las proyecciones de un estudio, no un dato normativo.
  'entradaMedicamento.numero': { familia: FUENTE.neogrotesca, cuerpo: 13, interlineado: 16, peso: 600, tracking: 0, color: 'acento.tinta' },
  'entradaMedicamento.ancla': { familia: FUENTE.neogrotesca, cuerpo: 12, interlineado: 16, peso: 600, tracking: -0.005, color: 'tinta.negra' },
  'entradaMedicamento.generico': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 13, peso: 500, tracking: 0, color: 'tinta.negra' },
  // ⚠ **NO HAY ROL DE VÍA, Y LO HUBO.** La lámina compone la vía ORAL como texto
  // plano —Archivo 7.5 / 13, 600, 0.2 em— y todas las demás como bloque en negativo,
  // y eso llegó a estar aquí como `entradaMedicamento.viaOral`. **Angel decidió que
  // las trece van en negativo**, contra lo medido, así que ese rol se queda sin
  // consumidor y un miembro de escala sin consumidores es deuda, no escala.
  //
  // La vía ya no la compone ningún rol de I.1.4: la compone 2.H, con su calibración
  // medida. Si la decisión se revierte, el rol vuelve tal cual —7.5 / 13, 600,
  // 0.2 em, `tinta.negra`, con «Vía» en `tinta.etiqueta`— y no hay que medirlo otra
  // vez.
  'entradaMedicamento.indicacion': { familia: FUENTE.humanista, cuerpo: 10, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  // ── LOS DOS ENCABEZADOS DE BLOQUE DESTACADO (2.I), medidos en la misma lámina.
  //
  // Suben aquí y no a la ficha de 2.I porque **no son desviaciones de ningún rol**:
  // 9 / 13 y 9.5 / 13 no salen de mover un sumando de `etiqueta` (7 / 11) ni de
  // `titulo.seccion` (10 / 14), que son los dos rótulos con los que el sistema
  // nombra lo que va debajo. Son escala nueva, y el criterio de I.1.7 para eso es
  // el contrario: lo que no es geometría interna de un componente es un rol.
  //
  // Se distinguen entre sí por el TRACKING y no por el cuerpo: 0.14 em es el de un
  // encabezado de sección y 0.22 el de la versalita del sistema. El de la alarma va
  // en la versalita porque es lo que la lámina compone —y porque la alarma es el
  // único bloque del sistema con ventaja declarada sobre el texto corrido, así que
  // su rótulo tampoco puede ser el más discreto de los dos.
  // ── LA CALIBRACIÓN `suplemento` DE LA ENTRADA (2.G) NO APARECE EN ESTA TABLA, Y
  // ESO ES EL RESULTADO DEL PASO 4.4.
  //
  // Sus tres ranuras se componen con roles que YA existen, hasta la centésima:
  //
  //     número          `entrada.numero`         13 / 17, 600, acento
  //     ancla           `entradaEstudio.ancla`   12.5 / 17, 600, −0.005 em
  //     justificación   `texto.corrido`          IBM Plex Sans 11.5 / 18, 400
  //
  // El tracking del ancla sale del mismo píxel que el de Receta: la lámina mide
  // `letter-spacing: -0.083px` y a cuerpo 12.5 pt —16.667 px— eso es −0.005 em, que es
  // exactamente lo que `entradaEstudio.ancla` ya declara. **Un cuarto rol idéntico a
  // uno existente sería deuda**, que es lo mismo que dice la nota del número en
  // `entradaEstudio`. Si algún día ves aquí `entradaSuplemento.*`, mídelo antes: casi
  // seguro es un rol duplicado.
  //
  // ── EL RÓTULO DE LA CABECERA DE LISTA (2.G `CabeceraLista`).
  //
  // ⚠ **LA LÁMINA LO COMPONE EN IBM PLEX MONO Y AQUÍ VA EN LA NEO-GROTESCA.** I.1.4
  // prohíbe la mono en documento impreso —solo existe en el marco de documentación de
  // las láminas— y este es el cuarto caso idéntico: `CONCILIA D13, D20, D30`. La
  // sustitución es la que esos tres ya fijaron y queda **reportada**.
  //
  // El tracking sí es el medido: 1 px a 7.5 pt —10 px— son 0.1 em, la misma conversión
  // con la que se validaron los dos trackings de la banda de pie contra la lámina de
  // Receta. `COINCIDENCIA` con el tracking de `pie`, que vale lo mismo y no es este.
  //
  // El interlineado de 14 NO está medido: lo fija la cabecera, que mide 14 pt en las
  // tres láminas con lista apilada y donde este rótulo comparte renglón con el
  // `titulo.seccion` del sustantivo. Con cualquier cifra mayor, el rótulo estiraría la
  // cabecera y dejaría de medir 14. `DERIVADO, NO MEDIDO`.
  'lista.rotulo': { familia: FUENTE.neogrotesca, cuerpo: 7.5, interlineado: 14, peso: 400, tracking: 0.1, color: 'tinta.etiqueta' },
  // ── LOS CUATRO TEXTOS DEL BLOQUE DE CITA DE CONTROL (2.I, variante `cita`).
  //
  // Suben aquí por el mismo criterio que los dos encabezados de bloque destacado de
  // abajo: no son desviaciones de ningún rol —7.5 / 11 en 600 no sale de mover un
  // sumando de `etiqueta`, ni 14 / 18 de mover uno de `dato`— y lo que no es geometría
  // interna de un componente es un rol (I.1.7).
  //
  // Y hay una segunda razón, que es de reparto de responsabilidades: estos cuatro los
  // compone el FORMATO, por la ranura `contenido` de 2.I, y un formato no escribe
  // tipografía. Sin estos roles, II.4 tendría cuatro cuerpos y cuatro colores dentro,
  // que es justo lo que la cabecera de II.3 promete que no ocurre.
  //
  // ⚠ **`cita.plazo` VA EN LA NEO-GROTESCA Y LA LÁMINA LO COMPONE EN MONO**, igual que
  // `lista.rotulo` de arriba y por lo mismo. Su interlineado tampoco está medido: se
  // toma el 11 de los otros dos roles de este cuerpo —`etiqueta` y `medico.credencial`,
  // los dos a 11— en vez de inventar una cifra. `DERIVADO, NO MEDIDO`.
  'cita.encabezado': { familia: FUENTE.neogrotesca, cuerpo: 7.5, interlineado: 11, peso: 600, tracking: 0, color: 'tinta.secundaria' },
  'cita.fecha': { familia: FUENTE.neogrotesca, cuerpo: 14, interlineado: 18, peso: 600, tracking: 0, color: 'tinta.negra' },
  'cita.plazo': { familia: FUENTE.neogrotesca, cuerpo: 8, interlineado: 11, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  'cita.nota': { familia: FUENTE.humanista, cuerpo: 9.5, interlineado: 13, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  // ── LOS CUATRO ROLES DE LA TABLA DE CONCEPTOS (II.5), medidos en la lámina de
  // Recibo y Cotización.
  //
  // Suben aquí y no a la ficha de un componente por la misma razón que los cuatro
  // `cita.*`: **los compone el FORMATO**. La lista de II.5 no es una
  // `EntradaNumerada` —su propia ficha lo dice, «no usa `EntradaNumerada`, usa
  // `Tabla` en modo grid»— y el chasis no tiene un componente `Tabla`, así que la
  // retícula de cuatro columnas la monta el formato. Sin estos roles, II.5 tendría
  // cinco cuerpos y tres colores escritos dentro, que es justo lo que la cabecera de
  // esta tabla promete que no ocurre.
  //
  // Ninguno sale de mover un sumando de un rol existente: `tabla.celda` va a 9.5 / 14
  // y `entradaCompacta.*` a 9 / 11.5, y esta lámina mide 9 / 13 y 10.5 / 13.
  //
  // **El precio no tiene rol propio: es `concepto.texto` alineado a la derecha.** La
  // alineación no es tipografía —no está en la tabla de I.1.4 para ningún rol— y un
  // quinto rol idéntico al segundo sería deuda, que es lo que ya dicen las notas de
  // `entradaEstudio.numero` y de la calibración `suplemento`.
  //
  // ⚠ **SON LOS CUERPOS DE LA CALIBRACIÓN DE COTIZACIÓN Y LA FILA COMPUESTA ES LA DEL
  // RECIBO DE 14.** `SPEC_DISENO_PARTE_B.md` B.5 §3 mide tres calibraciones de fila
  // —21.42, 17.21 y 22.47 pt— y las dos primeras difieren también en cuerpo: la de
  // volumen va a 9 / 12.5 y 10 / 12.5. El paso 4.5 entrega estos cuerpos y manda
  // componer la fila de 17.21; con estos interlineados la fila da 17.63. Los 0.42
  // quedan **reportados**, y las otras dos calibraciones no se componen: es lo que D4
  // prohíbe —un documento no cambia de métrica según cuántos ítems traiga— y aquí se
  // resuelve como en 2.G, declarando UNA y solo una.
  //
  // El tracking de las dos marcas de origen sale del píxel, como el del ancla de
  // Receta y el del calificador de la celda de peso: 1.68 px a 7 pt —9.333 px— son
  // **0.18 em**. `COINCIDENCIA` con el 0.18 de `GEOMETRIA.peso.base` en 2.D, que vale
  // lo mismo y no es este.
  //
  // Las dos se distinguen por PESO Y TINTA y no por caja, y eso es I.3.3 aplicado: la
  // lámina lo razona por su cuenta —en fotocopia la diferencia entre 600 negro y 400
  // gris se conserva; la de un cuadro relleno frente a uno hueco, no—.
  'concepto.numero': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 13, peso: 400, tracking: 0, color: 'acento.tinta' },
  'concepto.texto': { familia: FUENTE.neogrotesca, cuerpo: 10.5, interlineado: 13, peso: 400, tracking: 0, color: 'tinta.negra' },
  'concepto.origenPropio': { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 13, peso: 600, tracking: 0.18, color: 'tinta.negra' },
  'concepto.origenTercero': { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 13, peso: 400, tracking: 0.18, color: 'tinta.etiqueta' },
  // ── EL TEXTO CORRIDO DE LA COLUMNA DE 246 pt (II.5), medido en la misma lámina.
  //
  // ⚠ **ES `texto.corrido` REDUCIDO Y ENTRA COMO ROL PORQUE LO COMPONE 2.J.** La lista
  // de roles de cuerpo del parser está cerrada a dos a propósito —«una prop abierta a
  // los 23 roles sería una puerta para componer el cuerpo con cualquier cosa»—, así que
  // un tercero tiene que existir aquí con nombre propio o no existe.
  //
  // Lo que lo justifica es la MEDIDA DE LÍNEA: las notas de este formato no viven en la
  // caja de 486 pt sino en la columna derecha de la fila de cierre, que mide 246. El
  // texto corrido del sistema a 11.5 / 18 en esa columna compone ocho renglones donde la
  // lámina mide cinco, y con ellos la cotización deja de caber en su hoja única.
  //
  // ⚠ **`D28` QUEDA COMPUESTO A MEDIAS Y ES DELIBERADO.** Esa divergencia tiene dos
  // ejes: el cuerpo —9.5 / 14 contra 11.5 / 18— y la justificación con partición. **El
  // cuerpo se compone y la justificación NO**: I.3.2 la prohíbe sin excepción y II.5 §5
  // lo repite con nombre —«las notas van en bandera izquierda»—. Reportado.
  'texto.reducido': { familia: FUENTE.humanista, cuerpo: 9.5, interlineado: 14, peso: 400, tracking: 0, color: 'tinta.negra' },
  // ── LOS SIETE ROLES DE LOS TRES BLOQUES ENMARCADOS Y DE LA FORMA DE PAGO (II.5).
  //
  // Suben aquí por el mismo par de razones que los cuatro `cita.*` y los cuatro
  // `concepto.*`: **no son desviaciones de ningún rol** —6.5 / 10 en 600 no sale de
  // mover un sumando de `etiqueta`, ni 9.5 / 13.5 de mover uno de `tabla.celda`— y **los
  // compone el FORMATO**, porque lo que los envuelve es 2.U, que enmarca sin componer
  // (regla 3 de su ficha). Sin ellos, II.5 tendría siete cuerpos y tres colores escritos
  // dentro, que es lo que la cabecera de la Sección II promete que no ocurre.
  //
  // ⚠ **DOCE ROLES NUEVOS EN UN SOLO FORMATO ES MUCHO Y QUEDA REPORTADO.** La escala
  // pasa de 23 a 35 miembros, y la causa está medida: esta lámina no reutiliza casi nada
  // —«el más divergente de los cinco»—. Ninguno coincide con uno existente; los tres que
  // más se acercan son `entrada.ancla` (11 / 15 en **600**, no 500), `entradaEstudio.
  // secundario` (10 / 13 en **500** y `tinta.secundaria`) y `entradaEstudio.rotuloNota`
  // (6.5 / **16** en 0.2 em). Si al construir II.6 o II.7 alguno reaparece, deja de ser
  // de este formato y se le quita el prefijo.
  //
  // Los dos trackings salen del píxel, con la conversión de siempre: 1.907 px a 6.5 pt
  // —8.667 px— son **0.22 em**, que es la versalita del sistema, y el 0.02 em del título
  // de la leyenda es el mismo de `titulo.documento`. Ninguno es una cifra nueva.
  //
  // `aseguradora.rotulo` y `formaPago.rotulo` comparten cuerpo e interlineado y **no se
  // fusionan**: el primero va en 600 y el segundo en 400 con otro tracking, que es
  // exactamente la diferencia entre rotular una celda y rotular un dato suelto.
  //
  // ⚠ **`formaPago.rotulo` VA EN LA NEO-GROTESCA Y LA LÁMINA LO COMPONE EN IBM PLEX
  // MONO.** Séptimo caso idéntico (`CONCILIA D13, D20, D30`). I.1.4 prohíbe la mono en
  // documento impreso. Reportado.
  //
  // El interlineado de los dos rótulos —10— **no está medido**: lo fija la fila en la
  // que viven, que mide 13 en las dos y la gobierna el valor. Con cualquier cifra mayor,
  // el rótulo estiraría la fila. `DERIVADO, NO MEDIDO`.
  'aseguradora.nombre': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 15, peso: 500, tracking: 0, color: 'tinta.negra' },
  'aseguradora.rotulo': { familia: FUENTE.neogrotesca, cuerpo: 6.5, interlineado: 10, peso: 600, tracking: 0.22, color: 'tinta.etiqueta' },
  'aseguradora.valor': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 13, peso: 400, tracking: 0, color: 'tinta.negra' },
  // Los dos de la leyenda no fiscal. **La jerarquía va por PESO Y POR FAMILIA, no por
  // cuerpo ni por color**: los dos miden 9.5 / 13.5 y los dos van en tinta plena, y lo
  // que distingue al título es el 600 de la neo-grotesca. Es lo que hace que la leyenda
  // sobreviva a la fotocopia sin depender del marco (I.3.3), y es también por qué II.5
  // §1 exige que vaya «en jerarquía visible, no en gris pequeño al pie».
  'noFiscal.titulo': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 13.5, peso: 600, tracking: 0.02, color: 'tinta.negra' },
  'noFiscal.cuerpo': { familia: FUENTE.humanista, cuerpo: 9.5, interlineado: 13.5, peso: 400, tracking: 0, color: 'tinta.negra' },
  'formaPago.rotulo': { familia: FUENTE.neogrotesca, cuerpo: 6.5, interlineado: 10, peso: 400, tracking: 0.1, color: 'tinta.etiqueta' },
  'formaPago.valor': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 13, peso: 400, tracking: 0, color: 'tinta.negra' },
  // ── LOS SEIS ROLES DE LA LÁMINA DE INTERNAMIENTO (II.6).
  //
  // Suben aquí por el par de razones de siempre —no son desviaciones de ningún rol y los
  // compone el FORMATO o un componente que no puede escribir tipografía— y ninguno
  // coincide con uno existente. Los tres que más se acercan y **no son**:
  //
  //     `bloqueSimple.titulo`   9 / **12**   `recomendaciones.encabezado` va a 9 / 13
  //     `requerimiento.texto`   10.5 / **14** en **500**   `concepto.texto`, 10.5 / 13 en 400
  //     `instruccion.texto`     11.5 / 18 en **500**   `texto.corrido`, lo mismo en 400
  //
  // Los que SÍ coinciden no entran, que es la otra mitad del criterio: el número de la
  // apertura y el de los bloques numerados son `seccion.numero` —15 / 15, 600, acento— y
  // el título de bloque numerado es `titulo.seccion` —10 / 14, 600, 0.14 em—, hasta la
  // centésima. Un rol nuevo idéntico a uno existente sería deuda (ver la nota de
  // `entradaEstudio.numero`).
  //
  // Los tres trackings salen del píxel, con la conversión de siempre: 1.68 px a 9 pt
  // —12 px— son **0.14 em**, y 2.347 px a 8 pt —10.667 px— son **0.22 em**, que es la
  // versalita del sistema. `COINCIDENCIA` con el tracking de `etiqueta`, que vale lo
  // mismo y no es este.
  //
  // ⚠ **`seccion.lector` LLEVA EL TRACKING DE LA VERSALITA Y LA LÁMINA ESCRIBE LA CADENA
  // EN CAPITALIZACIÓN DE ORACIÓN** —`Para personal de enfermería y médico residente`—.
  // Toda versalita del sistema se compone en mayúsculas; esta no, porque es lo que la
  // lámina imprime. Se compone textual y queda **reportado**.
  //
  // ⚠ **`item.raya` VA EN LA NEO-GROTESCA Y LA LÁMINA COMPONE LA RAYA EN IBM PLEX MONO.**
  // Octavo caso idéntico (`CONCILIA D13, D20, D30`), y este es el que la propia ficha de
  // II.6 §5 manda sustituir con nombre. I.1.4 prohíbe la mono en documento impreso.
  // Reportado.
  'bloqueSimple.titulo': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 12, peso: 600, tracking: 0.14, color: 'tinta.negra' },
  'seccion.lector': { familia: FUENTE.neogrotesca, cuerpo: 8, interlineado: 12, peso: 600, tracking: 0.22, color: 'tinta.secundaria' },
  'item.raya': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 18, peso: 400, tracking: 0, color: 'tinta.etiqueta' },
  'instruccion.numero': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 18, peso: 600, tracking: 0, color: 'acento.tinta' },
  'instruccion.texto': { familia: FUENTE.humanista, cuerpo: 11.5, interlineado: 18, peso: 500, tracking: 0, color: 'tinta.negra' },
  'requerimiento.texto': { familia: FUENTE.neogrotesca, cuerpo: 10.5, interlineado: 14, peso: 500, tracking: 0, color: 'tinta.negra' },
  // ── LOS OCHO ROLES DE LA LÁMINA DE CONSENTIMIENTO (II.7).
  //
  // Es el formato de texto corrido más extenso del sistema y **el más alejado del token**:
  // su prosa va a 10.5 / 16 donde `texto.corrido` pone 11.5 / 18, y su medida de línea es
  // 381 pt donde el sistema pone 486. Los dos ejes están reportados como `D33` desde la
  // conciliación; lo que 4.7 compone es el cuerpo medido y **no** el justificado.
  //
  // Ninguno coincide con uno existente. Los que SÍ coinciden no entran, que es la otra
  // mitad del criterio, y en esta lámina son seis:
  //
  //     número de sección y del anexo   `seccion.numero`      15 / 15, 600, acento
  //     título de sección               `titulo.seccion`      10 / 14, 600, 0.14 em
  //     subtítulo del documento         `titulo.subtitulo`    10.5 / 14, 400, secundaria
  //     rótulo de nivel y de firmante   `firma.rol`           7 / 11, 600, 0.22 em
  //     rótulo de parentesco            `aseguradora.rotulo`  6.5 / 10, 600, 0.22 em
  //     entradilla del anexo            `cita.nota`           9.5 / 13, 400, secundaria
  //
  // ⚠ **LOS DOS ÚLTIMOS LLEVAN EL NOMBRE DE OTRO FORMATO Y SE REUSAN IGUAL.** Un rol nuevo
  // idéntico a uno existente sería deuda —lo dicen ya las notas de `entradaEstudio.numero`
  // y de la calibración `suplemento`—, y el nombre de un rol describe de dónde salió, no
  // quién puede leerlo. Si el sistema acaba con tres consumidores de cada uno, lo que hará
  // falta es renombrarlos, no duplicarlos.
  //
  // **EL TRACKING DE `rotulo.bloque` SALE DE LOS MISMOS 2.4 px QUE EL DE `rotulo.riel`.**
  // La lámina compone los dos rótulos con el mismo `letter-spacing` absoluto, y a 9 pt eso
  // son 0.2 em exactos mientras que a 11 pt son **0.164**. No es una cifra elegida: es la
  // misma línea de CSS leída a dos cuerpos. `COINCIDENCIA` con el 0.2 de la versalita del
  // sistema, que vale lo mismo solo en el rótulo pequeño.
  'seccion.parrafo': { familia: FUENTE.humanista, cuerpo: 10.5, interlineado: 16, peso: 400, tracking: 0, color: 'tinta.negra' },
  'seccion.entradilla': { familia: FUENTE.humanista, cuerpo: 10.5, interlineado: 16, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  // El cuerpo de prosa más pequeño del sistema, y va en el bloque que cita la norma.
  'fundamento.cuerpo': { familia: FUENTE.humanista, cuerpo: 9, interlineado: 13.5, peso: 400, tracking: 0, color: 'tinta.negra' },
  'rotulo.riel': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 13, peso: 600, tracking: 0.2, color: 'tinta.negra' },
  'rotulo.bloque': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 15, peso: 600, tracking: 0.1636, color: 'tinta.negra' },
  'nivel.numero': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 13, peso: 600, tracking: 0, color: 'acento.tinta' },
  'casilla.texto': { familia: FUENTE.humanista, cuerpo: 8, interlineado: 11, peso: 400, tracking: 0, color: 'tinta.negra' },
  'anexo.nombre': { familia: FUENTE.neogrotesca, cuerpo: 11, interlineado: 15, peso: 500, tracking: -0.012, color: 'tinta.negra' },
  'anexo.pie': { familia: FUENTE.humanista, cuerpo: 7.5, interlineado: 11, peso: 400, tracking: 0, color: 'tinta.etiqueta' },
  /**
   * EL SELLO DE TRAZABILIDAD DE II.7 — Archivo 7 / 9, 400, `tinta.secundaria`.
   *
   * Lo componen los dos sitios donde el documento acredita QUÉ pasó y CUÁNDO: el pie de cada
   * celda de firma y el bloque de verificación del cierre. Es el cuerpo más pequeño del
   * sistema junto con `pie.leyenda`, y eso es lo correcto — el sello no se lee, se coteja.
   *
   * ⚠ **VA EN LA NEO-GROTESCA Y CON CIFRAS TABULARES, Y NO ES ESTÉTICA.** Lo que se hace con
   * una hora impresa en papel es compararla con otra: la de la celda de al lado, la del
   * expediente, la de la nota de evolución. Con cifras proporcionales, `12:43:07` y
   * `12:47:19` no alinean sus columnas y la comparación deja de ser visual. Por eso entra en
   * `CIFRAS_TABULARES` — es el mismo motivo por el que están el folio y la póliza.
   *
   * `tinta.secundaria` y no `tinta.etiqueta`: es texto que se lee, no un rótulo que nombra
   * otra cosa. El gris del cuerpo, un escalón por encima del de las versalitas.
   *
   * **El interlineado de 9 sale de la cota, no del gusto:** el pie de celda cuesta 11 pt y su
   * margen respecto de la calidad del firmante son 2, así que el renglón mide 9.
   */
  'sello.pie': { familia: FUENTE.neogrotesca, cuerpo: 7, interlineado: 9, peso: 400, tracking: 0, color: 'tinta.secundaria' },
  // ── LOS DOS ROLES DE LA LÁMINA DE ESCRITO MÉDICO (II.8).
  //
  // Son los DOS ÚNICOS que hacen falta para el formato de cuerpo más rico del sistema, y esa
  // es la medida de lo desnudo que es su chasis: todo lo demás de su cuerpo ya existía.
  //
  //     párrafo, ítem de lista   `texto.corrido`       IBM Plex Sans 11.5 / 18, 400
  //     negrita y cita           `instruccion.texto`   lo mismo en peso 500
  //     marca de lista           `item.raya`           Archivo 9 / 18, 400, `tinta.etiqueta`
  //     fecha del encabezado     `fecha.encabezado`    Archivo 9, 400, `tinta.etiqueta`
  //
  // ⚠ **`instruccion.texto` E `item.raya` LLEVAN EL NOMBRE DE OTRO FORMATO Y SE REUSAN
  // IGUAL.** Un rol nuevo idéntico a uno existente sería deuda, y el nombre de un rol dice de
  // dónde salió, no quién puede leerlo. Con tres consumidores cada uno, lo que hará falta es
  // renombrarlos —a `texto.destacado` y `lista.marca`—, no duplicarlos. Reportado.
  //
  // Los dos que sí son nuevos se distinguen de lo que más se les parece por una sola cosa:
  //
  //     `cuerpo.encabezado1`   13 / 18   no hay ningún rol de 13 pt en la escala
  //     `cuerpo.encabezado2`   10 / 14 en **`tinta.secundaria`**   `titulo.seccion` es igual
  //                            en todo menos en la tinta, que allí es plena
  //
  // **El techo de 13 pt es deliberado y la lámina lo declara:** el encabezado mayor del
  // cuerpo se queda muy por debajo de los 22 del nombre del médico, «para que nunca
  // compitan». Es un cuerpo cuyo texto lo escribe el médico en un editor, así que el chasis
  // tiene que garantizar que no pueda gritar más que el membrete.
  'cuerpo.encabezado1': { familia: FUENTE.neogrotesca, cuerpo: 13, interlineado: 18, peso: 600, tracking: 0.08, color: 'tinta.negra' },
  'cuerpo.encabezado2': { familia: FUENTE.neogrotesca, cuerpo: 10, interlineado: 14, peso: 600, tracking: 0.14, color: 'tinta.secundaria' },
  'recomendaciones.encabezado': { familia: FUENTE.neogrotesca, cuerpo: 9, interlineado: 13, peso: 600, tracking: 0.14, color: 'tinta.negra' },
  'alarma.encabezado': { familia: FUENTE.neogrotesca, cuerpo: 9.5, interlineado: 13, peso: 600, tracking: 0.22, color: 'tinta.negra' },
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

/**
 * Un rol de la escala, ya en las unidades de react-pdf y listo para pasarse a
 * `style`. Lo devuelve `estiloTipografico()`.
 */
export interface EstiloTipografico {
  readonly fontFamily: Familia
  readonly fontSize: number
  /**
   * MULTIPLICADOR del cuerpo, que es lo que react-pdf entiende por `lineHeight`.
   * Ausente cuando el rol no declara interlineado (`marca.estado`): así manda el
   * valor por defecto del renderer en vez de uno inventado aquí.
   */
  readonly lineHeight?: number
  readonly fontWeight: Peso
  /** En pt, que es lo que react-pdf entiende por `letterSpacing`. */
  readonly letterSpacing: number
  /** Ausente cuando el rol no se rellena: `marca.estado` va de contorno. */
  readonly color?: string
}

/**
 * Resuelve el nombre de color de un rol a un hex.
 *
 * Un rol en `acento.tinta` al que no se le pasa acento cae a `tinta.negra`: es
 * el mismo criterio que un hex inválido en `resolverAcento()` — negro legible,
 * nunca un color roto.
 */
function colorDeRol(color: ColorDeTexto, acento?: AcentoResuelto): string | undefined {
  switch (color) {
    case 'tinta.negra':
      return TINTA.negra
    case 'tinta.secundaria':
      return TINTA.secundaria
    case 'tinta.etiqueta':
      return TINTA.etiqueta
    case 'tinta.papel':
      return TINTA.papel
    case 'acento.tinta':
      return acento?.tinta ?? TINTA.negra
    case 'contorno':
      return undefined
  }
}

/**
 * LA ÚNICA PUERTA A LA ESCALA TIPOGRÁFICA. Un componente pide un rol y recibe el
 * estilo listo; ningún componente vuelve a dividir ni multiplicar nada.
 *
 * Existe porque el spec y react-pdf no hablan en las mismas unidades y son DOS
 * conversiones, no una:
 *
 *   `lineHeight`    react-pdf = multiplicador · spec = pt  → interlineado / cuerpo
 *   `letterSpacing` react-pdf = pt            · spec = em  → tracking × cuerpo
 *
 * Con veinte componentes por delante, cada uno repitiendo esas dos operaciones,
 * la regla de tres estaba garantizada. Si ves `/ cuerpo` o `* cuerpo` en un
 * componente, sobra: es esta función.
 *
 * Pura y determinista. El `acento` solo hace falta para los roles cuyo color es
 * `acento.tinta` — `seccion.numero`, `entrada.numero` y `folio`.
 */
export function estiloTipografico(
  rol: RolTipograficoNombre,
  acento?: AcentoResuelto,
): EstiloTipografico {
  const r = TIPOGRAFIA[rol]
  const color = colorDeRol(r.color, acento)
  return {
    fontFamily: r.familia,
    fontSize: r.cuerpo,
    ...(r.interlineado === null ? {} : { lineHeight: r.interlineado / r.cuerpo }),
    fontWeight: r.peso,
    letterSpacing: r.tracking * r.cuerpo,
    ...(color === undefined ? {} : { color }),
  }
}

/** Roles que llevan cifras tabulares (I.1.4, párrafo bajo la escala). */
export const CIFRAS_TABULARES = [
  'dato',
  'tabla.celda',
  'entrada.numero',
  'entradaCompacta.numero',
  'entradaMedicamento.numero',
  // Los dos de la tabla de II.5. `concepto.texto` entra por el PRECIO, que es la
  // única columna del sistema donde una cifra tiene que sumar visualmente con la
  // de abajo (2.T regla 1); el concepto comparte rol y no lleva cifras.
  'concepto.numero',
  'concepto.texto',
  // El ordinal de las instrucciones al paciente (II.6), por lo mismo que los cuatro de
  // arriba: es un identificador de ítem que se lee en columna, `01` sobre `02`.
  'instruccion.numero',
  // El sello de II.7: una hora impresa se compara, no se lee. Ver su ficha.
  'sello.pie',
  // La póliza es alfanumérica y la lámina la compone tabular igual: es un
  // identificador que se coteja carácter a carácter contra el oficio de la
  // aseguradora, que es el mismo caso que el folio.
  'aseguradora.valor',
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
  /**
   * Bloque de alarma.
   *
   * ⚠ **SON 4 pt Y EL CHASIS LOS TENÍA EN 3.** La lámina aprobada de Receta —el
   * único formato del sistema que compone una alarma— mide su filete superior e
   * izquierdo en **4 pt sólidos `tinta.negra`**, no en 3. El 3 venía de A.4 y no
   * está medido sobre ninguna lámina.
   *
   * La jerarquía de grosores de 2.I aguanta el cambio sin tocarse: alarma (4) >
   * instrucciones (2, `filete.acento`) > cita (1.6, `filete.cita`). Lo que sí deja
   * de ser cierto es la coincidencia con `filete.transicion`, que vale 4 y **no es
   * este valor**: aquel abre una sección numerada (2.Q) y este enmarca un pasaje.
   * `COINCIDENCIA`, no identidad.
   *
   * Alcance: un solo consumidor —la variante `alarma` de 2.I— y un solo formato que
   * la instancia. Reportado.
   */
  alarma: 4,
  /** Cabecera de tabla · marco parcial de dos lados · marco del QR. */
  acento: 2,
  /** Bloque de cita · filete corto sobre el folio. */
  cita: 1.6,
  /** Escritura, firma, cierre de membrete, apertura y cierre de riel. */
  fino: 0.8,
  /** Regla entre entradas, entre celdas de riel, contorno de marca de estado. */
  regla: 0.5,
} as const

/**
 * LOS DOS GROSORES QUE MIDE LA LÁMINA DE SUPLEMENTACIÓN, Y POR QUÉ NO ENTRAN EN
 * `FILETE`.
 *
 * Esa escala es de seis grosores del SISTEMA y ninguno de estos dos lo es: son las
 * cifras con que una lámina concreta dibuja dos trazos que el chasis ya tiene. Meterlos
 * ahí como séptimo y octavo miembro los ofrecería a los ocho formatos, que es lo
 * contrario de lo que son.
 *
 * Viven aquí y **no en la ficha de un componente** —que es donde I.1.7 manda poner la
 * geometría interna— porque los dos tienen DOS consumidores cada uno, y §0 exige un
 * solo sitio de definición por token:
 *
 *   `acento`  borde de la celda de peso (2.D) · filetes del bloque de cita (2.I)
 *   `regla`   regla entre entradas (2.G) · filete de las notas (2.I)
 *
 * Con un solo consumidor cada uno, lo correcto sería la ficha del componente, igual
 * que las desviaciones de 2.F o el padding de alarma de 2.I.
 *
 * ⚠ **LOS DOS SE APARTAN DEL CHASIS POR MENOS DE UN TERCIO DE PUNTO**, y eso es lo que
 * hay que saber antes de tocarlos: 1.9 contra los 1.6 de `filete.cita` y 0.63 contra
 * los 0.5 de `filete.regla`. No se unifican por la misma razón que los hairlines de
 * 0.75 del riel siguen sin unificarse (ver `TRAZO` en 2.F): mover `filete.cita` o
 * `filete.regla` mueve los formatos ya conciliados. Reportado.
 */
export const FILETE_SUPLEMENTACION = {
  /** Celda de peso y bloque de cita. El chasis pone `filete.cita`, 1.6. */
  acento: 1.9,
  /** Regla entre entradas y filete de notas. El chasis pone `filete.regla`, 0.5. */
  regla: 0.63,
} as const

/**
 * LOS CUATRO GROSORES QUE MIDE LA LÁMINA DE RECIBO Y COTIZACIÓN.
 *
 * Mismo criterio que `FILETE_SUPLEMENTACION`, y por la misma razón de §0: cada uno
 * tiene más de un consumidor, así que no puede vivir en la ficha de un componente.
 *
 *   `regla`   regla de fila de la tabla (II.5) · línea de escritura de la celda de
 *             paciente (2.F) · filete del riel de importes (2.T)
 *   `riel`    los dos filetes del riel de identificación (2.F)
 *   `firma`   la línea sobre la que se firma (2.L)
 *   `acento`  el marco parcial de dos lados (2.U)
 *
 * ⚠ **ESTA LÁMINA DIBUJA SUS HAIRLINES MEDIO PUNTO POR DEBAJO DEL CHASIS Y LOS TRES
 * PRIMEROS VALORES SON DISTINTOS ENTRE SÍ.** No se unifican, por lo mismo que no se
 * unificaron los 0.75 del riel de las otras tres láminas: mover `filete.fino` o
 * `filete.regla` mueve los cuatro formatos ya conciliados. Reportado.
 *
 * `COINCIDENCIA` — `regla` vale lo mismo que `FILETE_SUPLEMENTACION.regla` y **no es
 * él**: son dos láminas distintas que miden 0.63 por su cuenta. Fusionarlos ataría la
 * regla de esta tabla a la de las entradas de aquel formato.
 *
 * `DERIVADO, NO MEDIDO` — `riel`. La lámina da las dos cotas del riel de
 * identificación —abre en 219.85, cierra en 250.8— y la celda base mide 30 como en
 * todo el sistema: los 0.95 pt que sobran son sus dos filetes, 0.475 cada uno. Es del
 * mismo orden que el 0.47 de la línea de firma, que esta misma lámina sí declara.
 *
 * `regla` interior del riel: **NO EXISTE EN ESTA LÁMINA**. Su riel es de una sola
 * fila, así que no hay ninguna regla horizontal que dibujar. Ver `TRAZO` en 2.F.
 */
export const FILETE_HONORARIOS = {
  /** Regla de fila, línea de escritura y filete del riel de importes. */
  regla: 0.63,
  /** Filetes de apertura y cierre del riel de identificación. */
  riel: 0.475,
  /** La línea de firma. El chasis pone `filete.fino`, 0.8; las otras láminas, 0.75. */
  firma: 0.47,
  /** Los dos lados del marco parcial. El chasis pone `filete.acento`, 2. */
  acento: 2.53,
} as const

/**
 * EL ÚNICO GROSOR PROPIO DE LA LÁMINA DE INTERNAMIENTO.
 *
 * Mismo criterio que `FILETE_SUPLEMENTACION` y `FILETE_HONORARIOS`, y por la misma razón
 * de §0: tiene TRES consumidores, así que no puede vivir en la ficha de un componente.
 *
 *   filete superior del bloque simple (II.6, `tinta.reglaSuave`)
 *   filetes de apertura y cierre del riel de requerimientos (2.F)
 *   regla vertical entre celdas de ese riel (2.F, `tinta.hairline`)
 *
 * `COINCIDENCIA` — vale lo mismo que `FILETE_SUPLEMENTACION.regla` y que
 * `FILETE_HONORARIOS.regla`, y **no es ninguno de los dos**: son tres láminas distintas
 * que miden 0.63 por su cuenta. Es ya la tercera, lo que inclina el aviso de aquellas dos
 * —«si 0.63 fuera el valor real, `filete.regla` está mal en los ocho»— del lado del 0.63.
 * Sigue sin unificarse aquí: mover `filete.regla` mueve los cinco formatos conciliados.
 * Reportado.
 *
 * ⚠ **B.6 §3 MIDE ESTE MISMO FILETE EN 0.5 pt Y EL PASO 4.6 MANDA 0.63.** Se compone el
 * que manda el paso. Reportado.
 *
 * **Los filetes del riel de identificación NO están aquí**, y no por olvido: esa lámina
 * no los declara y se derivan de su cota. Ver `TRAZO` en 2.F.
 */
export const FILETE_INTERNAMIENTO = {
  /** Bloque simple, riel de requerimientos y su regla vertical. */
  regla: 0.63,
} as const

/**
 * EL ÚNICO GROSOR PROPIO DE LA LÁMINA DE CONSENTIMIENTO.
 *
 * Mismo criterio que las tres tablas de arriba, y por la misma razón de §0: tiene TRES
 * consumidores, así que no puede vivir en la ficha de un componente.
 *
 *   filete superior de las siete secciones clínicas (II.7)
 *   filetes de apertura y cierre del riel de identificación (2.F)
 *   línea de escritura de la celda `Familiar o responsable` (2.F)
 *
 * `COINCIDENCIA` — es el cuarto 0.63 del sistema, tras Suplementación, Honorarios e
 * Internamiento, y **no es ninguno de los tres**: cuatro láminas lo miden por su cuenta.
 * Con cuatro votos contra el 0.5 de `filete.regla`, el aviso de las otras tres deja de ser
 * una diferencia y pasa a ser la regla; unificar sigue siendo una decisión de producto
 * porque movería los seis formatos conciliados. Reportado.
 *
 * ⚠ **B.7 §2 Y §3 MIDEN ESTOS DOS FILETES EN 0.8 pt Y EL PASO 4.7 MANDA 0.63.** Se compone
 * el que manda el paso, y además es el que cuadra el riel: con 0.8, sus cuatro filas dan
 * 139.195 contra los 138.85 medidos; con 0.63, dan **138.855**. Reportado.
 */
export const FILETE_CONSENTIMIENTO = {
  /** Filete de sección, filetes del riel y línea de escritura del familiar. */
  regla: 0.63,
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
 * La escala. `espacio.16` → `ESPACIO[16]`.
 *
 * ALCANCE. La escala gobierna la separación vertical entre BLOQUES DE PRIMER
 * NIVEL. La geometría interna de un componente —aire entre panel y nombre,
 * padding de celda de riel, medianil de la zona de QR— se declara en la ficha
 * del componente con el valor extraído del diseño, aunque no sea múltiplo de 4.
 * El espécimen aprobado usa 14, 18, 10, 7, 6, 5 y 3 pt dentro de sus
 * componentes: forzarlos a esta escala sería rediseñar hojas ya aprobadas.
 *
 * **ERA DE OCHO MIEMBROS Y AHORA ES DE ONCE.** Se añaden `2`, `5` y `20`, que no
 * son múltiplos de `espacio.base` y no tienen por qué serlo: **la escala existe
 * para expresar el diseño, no para restringirlo.** Los tres salen medidos de la
 * lámina de Laboratorio y sin ellos el formato no se puede componer sin escribir
 * literales, que es lo que I.1 prohíbe:
 *
 *   `espacio.2`   subtítulo bajo el título          B.1 §1
 *   `espacio.5`   cierre de la lista → contador     B.1 §2 · bloque 11
 *   `espacio.20`  aire antes de observaciones y antes de la firma   B.1 §5 `separacion`
 *
 * `COINCIDENCIA` — `espacio.20` mide lo mismo que el antiguo `transicion.tituloRiel`
 * y no es él. Aquel quedó en 8 pt por la misma lámina; que hayan coincidido en 20
 * durante una generación no los hace el mismo valor.
 *
 * **Y AHORA ES DE TRECE.** Se añaden `14` y `26`, medidos en la lámina de
 * Imagenología por el mismo criterio con que entraron los tres anteriores — sin
 * ellos el formato no se compone sin escribir literales:
 *
 *   `espacio.14`  riel de identificación → cabecera de la lista
 *   `espacio.26`  aire antes de la firma
 *
 * `COINCIDENCIA` — `espacio.14` NO es el aire de continuación de esa misma lámina,
 * que mide 16 y es `espacio.16`: son dos separaciones distintas que la hoja 1 y la
 * hoja de continuación miden distinto a propósito.
 *
 * **Y AHORA ES DE CATORCE.** Se añade `10`, medido en la lámina de Receta por el
 * mismo criterio con que entraron los cinco anteriores — sin él el formato no se
 * compone sin escribir un literal:
 *
 *   `espacio.10`  cierre del riel de identificación → cabecera de la lista
 *
 * `COINCIDENCIA` — esos 10 pt miden lo mismo que el espaciador que cierra el
 * membrete en esa misma lámina (2.B) y que el aire `tituloRiel` de la de
 * Imagenología (2.C). Los tres separan cosas distintas y ninguno es este.
 */
export const ESPACIO = {
  2: 2,
  4: 4,
  5: 5,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  26: 26,
  32: 32,
  48: 48,
  64: 64,
} as const

/**
 * QUÉ LÁMINA FIJA LA COMPOSICIÓN DE UN COMPONENTE. **La declara el formato.**
 *
 * No es una variante de diseño ni un tema: es la constatación de que dos hojas
 * aprobadas componen la misma pieza con cifras distintas, y de que el chasis no
 * puede tener las dos a la vez sin decir cuál está usando. El criterio es el mismo
 * que ya rige `CalibracionEntrada` en 2.G — lo declara el formato, una vez, y
 * nunca el contenido en tiempo de render (I.3.4).
 *
 * `chasis` es el valor por defecto en los seis componentes que la aceptan, así que
 * **ningún formato ya construido cambia por esto**. Solo Imagenología la declara.
 *
 * Las seis desviaciones, con su sitio de definición, para que se puedan cruzar de
 * una sola lectura:
 *
 *   2.B  banda de dirección de DOS renglones a 7.5 / 12   (el chasis compone uno)
 *   2.C  caja de título 287 · riel derecho 190 · aires 6 y 10
 *   2.F  filetes del riel 0.75 y regla interior 0.375     (el chasis, 0.8 y 0.5)
 *   2.D  valor de diagnóstico a 11 / 15                   (el chasis, 11 / 13)
 *   2.K  contador en `tinta.etiqueta`                     (el chasis, secundaria)
 *   2.L  línea 0.75 · nombre 11 / 15 · aire 4 · cédulas en humanista
 *
 * ⚠ **LOS DOS GROSORES DE HAIRLINE SON UN PÍXEL Y MEDIO PÍXEL.** 0.75 pt = 1 px y
 * 0.375 pt = 0.5 px a 96 dpi, que es lo que las láminas dibujan por ser HTML. El
 * chasis los declara en 0.8 y 0.5 (`filete.fino`, `filete.regla`) porque así los
 * leyó A.7. **No los unifiques por tu cuenta:** si el 0.75 es el valor real,
 * `filete.fino` está mal en los ocho formatos y eso mueve Laboratorio. Reportado.
 *
 * **AHORA SON TRES LÁMINAS, Y LA TERCERA CONFIRMA A LA SEGUNDA MÁS DE LO QUE LA
 * CONTRADICE.** `receta` coincide con `imagenologia` en cinco de las seis
 * desviaciones de arriba —los dos hairlines del riel, el diagnóstico a fila entera,
 * el contador en `tinta.etiqueta`, la banda de dirección de dos renglones y el
 * bloque de firma de 118.75 pt— y solo diverge en la geometría del bloque de
 * título, que cada formato mide con su propio reparto. Que dos de las tres láminas
 * midan 0.75 donde el chasis pone 0.8 mueve el aviso de arriba de «reportado» a
 * «pendiente de decisión»: son dos votos contra uno, y el uno es Laboratorio.
 *
 * Las cinco desviaciones PROPIAS de `receta`, con su sitio de definición:
 *
 *   2.B  espaciador de cierre del membrete a 10          (chasis e imagenología, 12)
 *   2.C  caja de título 267 · riel derecho 210 · medianil de celdas 20 · aire 5
 *   2.F  valor de celda en peso 500                      (el chasis, 400)
 *   2.G  calibración `medicamento` y tratamiento binario de la vía
 *   2.I  alarma con padding `6 0 8 14`                   (el chasis, `espacio.16`)
 *
 * **Y AHORA SON CUATRO. LA CUARTA ES LA QUE MENOS DECLARA, Y ESO ES EL HALLAZGO.**
 *
 * `suplementacion` hereda de `receta` casi todo lo que aquella desvió —los dos
 * hairlines del riel, el reparto 267 + 9 + 210 del bloque de título con su medianil de
 * 20 y su aire de 5, la banda de dirección de dos renglones, el bloque de firma de
 * 118.75, el contador en `tinta.etiqueta`— y **ninguna de esas cifras se vuelve a
 * escribir**: se leen de donde ya están. Lo que declara de propio es esto, y solo esto:
 *
 *   2.B  espaciador de cierre del membrete a 12          (receta, 10)
 *   2.C  aire del filete de título al riel a 10          (el chasis, 8)
 *   2.D  fila inferior del riel: peso (4) + diagnóstico (8), con la celda de peso
 *   2.G  calibración `suplemento` —dos ranuras— y cabecera de lista con rótulo
 *   2.I  cita con filete superior e izquierdo, y ranura de composición propia
 *
 * Las dos primeras son el valor del chasis o el de otra lámina, no cifras nuevas.
 *
 * **Y AHORA SON CINCO. LA QUINTA NO HEREDA DE NINGUNA Y ESO ES LO QUE LA DEFINE.**
 *
 * `honorarios` es la lámina de Recibo y Cotización, y es la más divergente de las
 * cinco: su membrete vuelve al renglón único de Laboratorio —sin cédulas ni
 * universidad, `D23`—, su bloque de título es el más alto del sistema (50 pt) y el
 * único con rótulo de subtítulo, su riel es de una sola fila, y su fila de cierre
 * invierte las dos columnas de I.1.3. Lo que declara de propio:
 *
 *   2.B  banda de UN renglón a 7.5 / 12         (Laboratorio compone uno a 7.5 / 11)
 *   2.B  espaciador de continuación a 24        (los cuatro anteriores, 12)
 *   2.C  caja 321 + riel 156 —los del chasis— con rótulo de subtítulo y aire de 6
 *   2.F  filetes del riel 0.475, celda con fondo y celda con línea de escritura
 *   2.L  línea 0.47 · nombre 10 / 14 · ancho declarado por el formato
 *   2.T  y 2.U, que nacen con ella
 *
 * ⚠ **LA FILA DE CIERRE VA AL REVÉS QUE EN LOS OTROS CUATRO.** `cierre.izquierda`
 * (246) es aquí la columna DERECHA —la del riel de importes, que la lámina sitúa en
 * `x = 312`— y `cierre.derecha` (216) la IZQUIERDA, la de la firma en `x = 72`. Los
 * dos nombres se corrigieron una vez contra B.3 y B.4 y siguen siendo correctos para
 * aquellas láminas: lo que esta añade es que **el reparto 246 / 24 / 216 no siempre
 * cae del mismo lado**. No los vuelvas a cambiar por esto —moverías Imagenología,
 * Receta y Suplementación—; lo que hay que leer es el VALOR. Reportado.
 *
 * **Y AHORA SON SEIS. LA SEXTA ES LA MÁS ALTA Y LA ÚNICA CON DOS SECCIONES.**
 *
 * `internamiento` mide el encabezado más alto del sistema —**237.61 pt**, contra los
 * 232.51 de Suplementación— y es la única lámina con tres hojas de reparto FIJO. Casi todo
 * lo que desvía ya estaba medido en otra: el espaciador de cierre de 10 es el de Receta,
 * los 5 pt hasta el filete del título también, los dos renglones de banda con cédulas son
 * los de Imagenología y los hairlines de su riel son los de Honorarios. **Ninguna de esas
 * cifras se vuelve a escribir**: se leen de donde ya están.
 *
 * Lo que declara de propio:
 *
 *   2.B  espaciador de la hoja de continuación a 14      (chasis 12, honorarios 24)
 *   2.C  caja de título 297 —la más ancha— con el riel derecho DERIVADO
 *   2.D  fila inferior de cuatro celdas: hospital, tipo, días y ASA (span 1)
 *   2.F  variante `catalogo`, que nace con ella
 *   2.I  instrucciones con filete superior, padding `6 0 8 14` y encabezado
 *   2.J  las tres calibraciones de ítem, que nacen con ella
 *   2.L  medianil de pareja a 30 y DOS composiciones de nombre en el mismo documento
 *   2.Q  que se estrena aquí y no tiene otro consumidor
 *
 * **Y AHORA SON SIETE. LA SÉPTIMA ES LA MAYOR DE TODAS.**
 *
 * `consentimiento` mide el encabezado más alto del sistema —**511.6 pt**, más del doble que
 * los 237.61 de Internamiento— porque entre el título y el riel mete un bloque entero de
 * fundamento legal. Es también el formato de texto corrido más extenso, el único con firmas
 * en tres niveles de jerarquía repartidos en dos hojas, y el único con hoja condicional.
 *
 * Lo que declara de propio:
 *
 *   2.B  espaciador de cierre a 20 —valor único— y banda de UN renglón alto sin cédulas
 *   2.B  espaciador de continuación **por hoja**: 26, 12 y 20 en el mismo documento
 *   2.C  aire del filete del título al cuerpo a 18            (el chasis, 8)
 *   2.D  riel de OCHO celdas en cuatro filas, sin sexo, con celda base de 33
 *   2.F  padding de celda `4 10 5` y valor a 11.5 / 14        (el chasis, `3 10 4` y 11.5 / 13)
 *   2.L  medianil de pareja a 30 y una ranura para lo que cuelga bajo la nota
 *   2.U  grosor de marco a `filete.acento`                    (Honorarios, 2.53)
 */
export type Lamina =
  | 'chasis'
  | 'imagenologia'
  | 'receta'
  | 'suplementacion'
  | 'honorarios'
  | 'internamiento'
  | 'consentimiento'
  /**
   * **Y AHORA SON OCHO. LA OCTAVA ES LA MENOR, Y ESO ES LO QUE VALIDA.**
   *
   * `escrito` mide el encabezado más pequeño del sistema —**165.22 pt**, un tercio del de
   * Consentimiento— porque no lleva casi nada: sin folio, sin riel de identificación, sin
   * bloque de paciente y con un título que escribe el médico. Es el chasis desnudo, y por eso
   * es el que dice si el chasis se sostiene solo.
   *
   * Lo que declara de propio:
   *
   *   2.B  espaciador de cierre a 16 —cuarto valor— y rótulo de continuación en `firma.rol`
   *   2.C  medianil de 16 a la fecha, aire de 20 bajo el filete y una variante `ausente`
   *        **que no colapsa**: deja 20 pt con la fecha sola
   *   2.M  las tres zonas de la banda en otro orden, y la única con recorte por elipsis
   *   2.V  hoja de continuación **sin paciente**: su línea reducida lleva las cédulas
   */
  | 'escrito'
  /**
   * **Y AHORA SON NUEVE. LA NOVENA ES LA QUE MENOS DECLARA DE PROPIO, Y NO POR SER SENCILLA.**
   *
   * `denegacion` es la lámina de la Denegación o revocación del consentimiento: un documento
   * INDEPENDIENTE de una hoja que se emite **en lugar** del consentimiento cuando el paciente
   * rechaza el procedimiento o revoca una autorización previa. No es una hoja de II.7.
   *
   * ⚠ **NO ES `consentimiento` CON MENOS COSAS, Y ES EL ERROR FÁCIL DE COMETER.** Comparte con
   * aquella la banda de un renglón sin cédulas, la anatomía de celda del riel y el marco de su
   * declaración —de ahí que casi todo lo suyo se LEA de allí en vez de volver a declararse—,
   * pero sus dos aires de encabezado son los del CHASIS y no los de II.7:
   *
   *     espaciador de cierre del membrete   **12**, el del chasis   (consentimiento, 20)
   *     aire bajo el filete del título      ** 8**, el del chasis   (consentimiento, 18)
   *
   * Son 18 pt de encabezado, y por eso esta lámina no puede componerse pasando
   * `lamina: 'consentimiento'`: con los dos aires de aquella el documento mide 258.59 pt de
   * encabezado en vez de 240.59, y esos 18 pt salen de la holgura de la variante por
   * sustitución, que solo tiene 26.04.
   *
   * Que los dos sean los del chasis es también lo que hace que **2.C no la nombre**: sin
   * ninguna rama suya, el bloque de título compone la caja de 321, el riel de folio de 156 y
   * los dos aires del chasis, que es exactamente lo que la guía mide.
   *
   * Lo que declara de propio:
   *
   *   2.B  banda de UN renglón alto sin cédulas —la de Honorarios y Consentimiento—, con el
   *        espaciador de cierre del chasis
   *   2.D  riel de SEIS celdas en dos filas, sin diagnóstico y sin expediente, con el familiar
   *        como campo vacío requerido
   *   2.F  la anatomía de celda de Consentimiento —padding `4 10 5`, valor a 11.5 / 14— con
   *        los filetes del CHASIS: 0.8 y 0.5. Es la segunda lámina que los compone
   *   2.L  retícula de tantas COLUMNAS como firmantes, en una sola fila
   *   2.M  banda `completo` **sin QR**: el documento no autoriza nada
   */
  | 'denegacion'

/**
 * Las nueve transiciones entre bloques declaradas por el diseño (I.1.7).
 *
 * NO SE FUSIONAN CON `ESPACIO` aunque varias coincidan en valor.
 * `seccionParrafo` mide lo mismo que `espacio.8`, `contenidoPie` que
 * `espacio.16` y `entreSecciones` que `espacio.24`: son `COINCIDENCIA`, no
 * identidad. La escala se usa donde la separación es genérica; estos tokens
 * donde tiene dos extremos identificables y tiene que poder cambiar sola. Mover
 * `ESPACIO[16]` para ajustar el aire sobre la banda de pie movería también toda
 * sangría de bloque destacado del sistema.
 *
 * Las otras tres —14, 6 y 10 pt— no son miembros de la escala y nunca lo fueron.
 * Esa es la razón por la que este grupo existe: sin nombre propio, los
 * componentes las escribirían como literales, que es justo lo que I.1 prohíbe.
 *
 * No confundir con `FILETE.transicion`, que es un grosor de línea.
 */
export const TRANSICION = {
  /**
   * Fila superior del membrete → filete de cierre.
   *
   * **8 pt, no 14.** Tercera transición que el espécimen declara de una forma y la
   * lámina compone de otra, y la tercera que se resuelve igual: A.7 y A.15 dicen
   * 14, y las coordenadas medidas de la lámina de Laboratorio dan el cierre de la
   * fila superior en **58.7** y el filete en **66.7 → 69.2**. Ocho.
   */
  membreteFilete: 8,
  /** Filete de cierre del membrete → línea fina. */
  membreteLineaFina: 6,
  /**
   * Bloque de título → su filete.
   *
   * **4 pt, no 10.** A.15 —los espaciados del ESPÉCIMEN— declara 10 pt, y con 10
   * el encabezado no cabe en el presupuesto de la lámina. `SPEC_DISENO_PARTE_B.md`
   * B.1 §2 mide **4 pt** sobre la lámina aprobada de Laboratorio, y manda la lámina
   * del formato, no el espécimen. Vale 6 pt de deriva de encabezado.
   */
  tituloFilete: 4,
  /**
   * Filete del título → riel de identificación.
   *
   * **8 pt, no 20.** Misma causa que `tituloFilete`: A.15 declara 20 y B.1 §2 mide
   * **8** en la lámina. Vale 12 pt de deriva de encabezado.
   *
   * ⚠ **También gobierna el Escrito Médico.** Es el arranque del cuerpo bajo el
   * filete del membrete cuando el título colapsa (2.C variante `ausente`, II.8 §5):
   * lo que va bajo el filete sin título ocupa el sitio del riel. Ese formato sube
   * 12 pt de contenido por este cambio y **su lámina no se ha medido todavía**
   * (B.8). Queda reportado.
   */
  tituloRiel: 8,
  /** Encabezado de sección → su párrafo. */
  seccionParrafo: 8,
  /** Cierre de una sección numerada → apertura de la siguiente. */
  entreSecciones: 24,
  /**
   * Cabecera de tabla → filete de acento.
   *
   * **3 pt, no 6.** Cuarta transición que el espécimen declara de una forma y la
   * lámina compone de otra, y la cuarta que se resuelve igual: A.15 dice 6, y la
   * lámina de Laboratorio mide el bloque de cabecera —rótulo + aire + filete— en
   * **16 pt**. Con el rótulo en `etiqueta` (11 pt) y el filete en `filete.acento`
   * (2 pt), el aire que queda es 3. Manda la lámina del formato, no el espécimen.
   */
  tablaFilete: 3,
  /** Cierre de tabla → fila de total. */
  tablaTotal: 6,
  /** Último bloque de contenido → banda de pie. */
  contenidoPie: 16,
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
  /**
   * ⚠ **EL OCTAVO NEUTRO, Y I.1.8 DECLARA SIETE.**
   *
   * Fondo de la caja de fotografía del anexo de II.7 —y del bloque de motivo de su variante
   * por sustitución, que no se compone—. Es un blanco cálido, no un gris de la escala: no
   * sale de mezclar ninguno de los siete ni del acento, así que no se puede derivar.
   *
   * **Se compone porque no es el único portador de significado** (I.3.3): la caja de foto
   * se distingue además por su borde de 0.5 y por el filete de acento que la abre, así que
   * en fotocopia sigue siendo una caja. Quien quite cualquiera de los dos deja el color
   * solo y rompe la regla. Reportado.
   */
  papelTenue: '#FAF9F7',
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
 * `acento.base` mezclado con blanco a la proporción pedida, por mezcla OPACA.
 *
 * Existe porque **el velo dejó de tener un solo valor** y I.1.8 ya lo preveía: declara
 * `acento.velo` al 6 % y, en la misma línea, un **máximo admitido del 12 %** para
 * cualquier fondo tenue. Un máximo sin más valores que él es un máximo sin uso; la
 * celda de vigencia de II.5 es el primero que lo estrena, al 8 %.
 *
 * ⚠ **EL 8 % ES UN VALOR NUEVO Y QUEDA REPORTADO.** Es el único fondo de celda de los
 * cinco formatos extraídos, y la razón por la que se compone es que no es el único
 * portador de significado (I.3.3): la vigencia se distingue **además** por el peso de
 * su cifra y por la tinta de su rótulo, así que sobrevive a la fotocopia. Quien quite
 * cualquiera de esos dos deja el color solo y rompe la regla.
 *
 * La proporción se recorta al máximo de I.1.8 en vez de confiarse: un velo por encima
 * del 12 % deja de ser tenue y pasa a ser la barra sólida que I.3.2 prohíbe.
 */
export function veloDeAcento(base: string, proporcion: number): string {
  const leido = leerHex(base)
  if (leido === null) return escribirHex(BLANCO)
  return escribirHex(
    mezclar(leido, BLANCO, Math.min(proporcion, ACENTO_DERIVACION.velo.maximo)),
  )
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
    // Por la misma puerta que el velo de la celda de vigencia: un solo sitio donde
    // se mezcla contra blanco, y el 6 % es una proporción más, no un caso aparte.
    velo: veloDeAcento(base, ACENTO_DERIVACION.velo.proporcion),
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
  /**
   * **61.6 pt, y eran 77 — un 20 % menos.**
   *
   * ⚠ **NO ES PAPEL EN BLANCO PARA FIRMAR A MANO, Y ESA ERA LA PREMISA EQUIVOCADA.**
   * Este hueco es donde 2.L imprime la rúbrica capturada del médico: la caja de
   * `GEOMETRIA.rubrica` mide exactamente `142 × espacio`. Reducirlo no le quita sitio
   * a nadie — compone la misma rúbrica proporcionalmente más pequeña. Angel, con una
   * receta real delante.
   *
   * ⚠ **Y `GEOMETRIA.rubrica.ancho` BAJA EL MISMO 20 %, DE 142 A 113.6. LOS DOS O
   * NINGUNO.** La proporción de esa caja —1.8442— es el invariante sobre el que está
   * construido `firmaTrazo.ts`: su espacio canónico de 592 × 321 px es esta caja a 300
   * dpi, y coincide en proporción para que `contain` dé los mismos dpi lo limite el
   * ancho o lo limite el alto. Bajar solo el alto rompe la coincidencia y los dpi
   * pasan a depender de la FORMA de cada firma — que es exactamente la dispersión que
   * el espacio canónico existe para eliminar. Bajando los dos, el invariante se
   * conserva y el trazo sigue siendo el mismo para todos.
   *
   * EL TRAZO, MEDIDO: la rúbrica imprime un 20 % más pequeña y su grosor baja en la
   * misma proporción, de **0.508 mm a 0.406 mm** —375 dpi contra 300—, igual para
   * todas las firmas y para las ya capturadas. Es un escalado uniforme: nada se
   * deforma, y 0.406 mm sigue siendo el grosor de una pluma fina.
   *
   * `GROSOR_CANONICO` NO se toca, y es deliberado: vale 6 px en el bitmap y las
   * rúbricas ya guardadas se generaron con ese 6. Subirlo para compensar los dpi solo
   * afectaría a las capturas NUEVAS y dejaría dos poblaciones de médicos imprimiendo
   * con grosores distintos, que es peor que el punto de milímetro que se pierde.
   */
  espacio: 61.6,
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
  /**
   * Nombre + **un solo renglón** de credenciales.
   *
   * ⚠ **ERAN DOS RENGLONES DE CÉDULA Y LA LÁMINA COMPONE UNO.** B.1 §4 imprime
   * `Céd. Prof. 9552456 · Céd. Esp. 12085805` en una línea, separadas por la raya
   * del sistema, no una debajo de otra. El chasis contaba un renglón de más y por
   * eso daba 130.8 pt donde la lámina mide 119.5.
   *
   * **El alcance no es Laboratorio.** `altoBloqueFirma()` y `umbralFirma()` salen de
   * esta tabla y gobiernan la regla 1 de 2.N en los ocho formatos: el umbral del
   * médico tratante baja de 200.8 a 189.5 pt. Es la corrección de un cálculo que
   * sobraba, no un ajuste para que quepa esta hoja.
   *
   * Que los tres roles tengan hoy el mismo inventario es CONSECUENCIA, no diseño:
   * cada uno llegó a un renglón por su causa —el médico juntando dos cédulas, los
   * otros dos porque siempre tuvieron una—. Si algún rol vuelve a necesitar dos, se
   * declara aquí y la fórmula lo absorbe sin tocarse.
   */
  medicoTratante: ['firma.nombre', 'firma.credencial'],
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
 *     firma.rol + firma.espacio + filete.fino + espacio.5
 *               + Σ(renglones de identificación)
 *
 * **UN SOLO SUMANDO CAMBIÓ, Y ES EL AIRE BAJO LA LÍNEA:** `espacio.5`, no
 * `espacio.4`. Lo declaran igual A.12 —«margen superior 5 pt» para el nombre del
 * caso de 1 firma— y el desglose medido de la lámina, así que no hay divergencia
 * que resolver: el 4 era del spec viejo. La línea sigue siendo `filete.fino`, como
 * A.12 y B.1 §5.
 *
 *     11 rótulo + 77 rúbrica + 0.8 filete + 5 aire + 16 nombre + 11 cédulas = 120.8
 *
 * Lo que sí bajó el alto es el renglón de cédula que se fusionó en uno: 130.8 → 120.8.
 *
 * El rol va ENCIMA de la línea, en versalita; el nombre y las credenciales van
 * debajo. Ese renglón del rol es lo que le faltaba a la composición de 119.8 pt
 * de una generación anterior del spec.
 *
 * Valor de referencia: **120.8 pt** para los tres roles. Los 130.8 pt del médico
 * tratante y los 119.8 pt de los otros dos son de la generación anterior del spec,
 * la que contaba dos renglones de cédula al médico y ponía `espacio.4` bajo la
 * línea.
 *
 * El 131.8 pt que declaraba una versión anterior del spec era doble conteo de
 * `filete.fino` y quedó corregido (anexo A, P1-1). Se detectó justamente aquí:
 * la fórmula daba los tres roles 1 pt por debajo, con desfase constante. La
 * fórmula no cambió — es la tercera generación de valores que aguanta sin
 * tocarla, y ese es el motivo de escribirla como fórmula.
 *
 * `COINCIDENCIA` — que los tres roles den hoy la misma cifra NO significa que el
 * parámetro sobre: siguen siendo tres inventarios declarados por separado en
 * `FIRMA_RENGLONES`, y coinciden porque los tres acabaron en un renglón de
 * credencial. No colapses la función a una constante.
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
      ESPACIO[5] +
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
 * Valor de referencia: **190.8 pt** para los tres roles. Los 200.8 pt del spec son
 * de la generación que contaba dos renglones de cédula al médico tratante.
 */
export function umbralFirma(rol: RolFirmante = 'medicoTratante'): number {
  return redondearPt(
    altoBloqueFirma(rol) +
      ESPACIO[16] +
      FLUJO.arrastre * (TIPOGRAFIA['texto.corrido'].interlineado ?? 0),
  )
}
