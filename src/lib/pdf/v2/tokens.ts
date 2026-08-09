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
 * I.1.2 · Márgenes de la hoja. Asimétricos: el izquierdo es el mayor porque la
 * hoja se perfora y se engrapa por ese borde.
 *
 * Declarado antes de `CAJA` —al revés que en el spec, donde I.1.2 va después de
 * I.1.1— porque `caja.alto` se deriva de estos valores y TypeScript necesita
 * tenerlos inicializados.
 *
 * DESGLOSE DEL MARGEN INFERIOR, que es la parte que hay que respetar al
 * implementar: 36 pt de papel intocable + 16 pt de banda de pie + 16 pt de aire.
 * La banda de pie es tinta, no sangre: vive DENTRO de la zona segura y FUERA de
 * la caja de texto, así que el margen inferior no se mide hasta la banda.
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
 * `ancho` no es derivado: I.1.1 lo declara como valor propio, «token único de
 * texto corrido en todo el sistema». El 453.75 pt que apareció en Plan de
 * Suplementación queda eliminado — no existe un segundo ancho de caja.
 */
export const CAJA = {
  ancho: 486,
  alto: PAPEL.alto - MARGEN.superior - MARGEN.inferior,
} as const

/**
 * Zona segura: banda perimetral que ninguna impresora de escritorio garantiza,
 * por los cuatro lados. Cubre el área no imprimible de 4–5 mm de una impresora
 * de consultorio. Ningún elemento con tinta la cruza.
 */
export const ZONA_SEGURA = 36

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
 * `321 + 9 + 156 = 486` = `caja.ancho`, con un medianil de retícula entre las dos.
 */
export const ZONA = {
  texto: 321,
  riel: 156,
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
 */
export type Lamina = 'chasis' | 'imagenologia' | 'receta'

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
