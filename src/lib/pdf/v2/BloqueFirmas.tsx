/**
 * Sistema de documentos v2 — componente 2.L · `BloqueFirmas`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.L y I.1.9. Transcripción, no
 * diseño.
 *
 * Propósito: el espacio donde se firma. De 1 a 6 firmas por hoja.
 *
 * ⚠ **LA RETÍCULA YA NO ES SIEMPRE DE DOS COLUMNAS.** La ficha la declaraba así y el 2 estaba
 * cableado; II.9 —la denegación— compone tres firmantes en **tres** columnas de 142 pt, una
 * sola fila, porque en dos desbordaba 62 pt de una hoja que tiene que ser una. Entra como
 * PARÁMETRO `columnas` del formato, con 2 por defecto: la celda y su fórmula de alto no
 * cambian. Ver `columnas` en `BloqueFirmasProps`, que es donde queda declarado.
 *
 * REGLA 1 — EL ALTO DE LA FIRMA NO DEPENDE DE LA HOJA
 *
 * `firma.espacio` son 77 pt **en las tres variantes**. Lo que cambia entre ellas
 * es cuántas firmas caben en la fila, no el alto de la firma. Si no caben todas
 * en una hoja se reparten en dos; **nunca se comprimen** (I.3.4). Si alguna vez
 * ves aquí un alto que sale de una resta contra el hueco disponible, es el tramo
 * de 28 pt volviendo, y quedó retirado en `CONCILIA D37`.
 *
 * ANATOMÍA, Y POR QUÉ EL ROL VA ENCIMA DE LA LÍNEA
 *
 *     firma.rol         versalita, ENCIMA de la línea            11 pt
 *     firma.espacio     77 pt de espacio de escritura            77
 *     filete.fino       la línea                                  0.8
 *     espacio.5         margen superior del nombre                5
 *     firma.nombre      bajo la línea                            16
 *     firma.credencial  UN renglón, unido con la raya            11
 *                                                                ──── 120.8
 *
 * La suma es `firma.bloque.alto(rol)` de I.1.9 —**120.8 pt**— y está implementada
 * como fórmula en `altoBloqueFirma()`. Los 130.8 pt del médico tratante que
 * declaraba el spec contaban un renglón de cédula de más. Este
 * componente no la recalcula: **compone las mismas ranuras en el mismo orden**,
 * así que el alto sale solo. La línea se dibuja como borde de una caja sin alto
 * propio para que los 0.8 pt del filete se sumen a los 77 y no se coman de ellos.
 *
 * REGLA 4 — NUNCA SE SOLAPA CON `PieDocumento`
 *
 * Es el bug §8.1 del sistema viejo, presente en las dos páginas de Internamiento
 * y en Consentimiento. **No se resuelve aquí ni podría:** este bloque va en el
 * flujo del contenido y el pie va anclado al papel. Lo que lo garantiza es que la
 * página declare `paddingBottom: margen.inferior`, que reserva los 36 + 16 + 16
 * pt donde vive la banda. Ver la cabecera de 2.M.
 *
 * REGLA 2 — ANCLADO AL FINAL DEL CONTENIDO, NO AL PIE DE LA CAJA
 *
 * Por eso este componente **no lleva `position: absolute` ni `marginTop: auto`**:
 * va en el flujo, detrás de lo último que haya. El aire sobrante queda debajo de
 * la rúbrica, no encima (I.3.4). Si alguna vez alguien lo empuja al fondo de la
 * caja «para que quede bonito», está invirtiendo esa regla.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import {
  CAJA,
  CIERRE,
  ESPACIO,
  FILETE,
  FILETE_HONORARIOS,
  FIRMA,
  FUENTE,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type Lamina,
  type Peso,
} from './tokens'

/**
 * Geometría interna de las variantes en fila, de la ficha de 2.L.
 *
 * `COINCIDENCIA` — el medianil de 24 pt vale lo mismo que `cierre.medianil`, y no
 * es el mismo valor: aquel separa las dos columnas de la fila de cierre —una de
 * 216 y otra de 246—, este separa dos celdas iguales de firma. No se fusionan.
 *
 * El padding de celda `14 0 4` es lo que separa las FILAS de una retícula: 14 pt
 * sobre cada celda y 4 bajo ella, 18 entre dos filas. La ficha lo declara solo
 * para `retícula` y aquí se respeta — en `pareja` hay una sola fila y no hay nada
 * que separar (anexo A, P2-27).
 */
const GEOMETRIA = {
  medianil: 24,
  /**
   * EL MEDIANIL DE LA PAREJA EN LA LÁMINA DE INTERNAMIENTO — **30 pt**.
   *
   * ⚠ **LA LÁMINA DECLARA ADEMÁS DOS CAJAS DE 246 Y LAS DOS CIFRAS NO CABEN JUNTAS**:
   * 246 + 30 + 246 = 522, treinta y seis por encima de `caja.ancho`. Se compone el
   * MEDIANIL, que es la cifra que no depende de nadie, y las dos celdas se reparten lo que
   * queda —(486 − 30) / 2 = **228**—, que es como reparte la variante en las otras
   * láminas. Los 246 son `cierre.izquierda`, el ancho de la columna de firma cuando la
   * firma va SOLA; en una pareja no puede valer para las dos. Reportado.
   */
  medianilInternamiento: 30,
  /**
   * EL BLOQUE DE PARENTESCO — **23.48 pt**, y lo lleva UNA celda de UN formato.
   *
   * La celda del familiar de II.7 mide 146.95 contra los 117.47 de las otras cuatro, y la
   * diferencia son estos 23.48 más su margen de 6. Dentro van un rótulo de 6.5 / 10 y una
   * línea de 13 pt: **23 exactos**, y los 0.48 que faltan son el residuo de caja de línea
   * del HTML, el mismo que esa lámina deja en su celda de riel. Reportado.
   *
   * ⚠ **LA LÍNEA MIDE 13 pt Y `manuscrito.alto` SON 20.** Es el cuarto valor del sistema
   * para el mismo token —20 del chasis, 16.47 de los dos campos de riel, 11 de Receta y 13
   * aquí—, y `D27` lo lleva reportado desde la conciliación. Se compone el medido.
   *
   * **Este componente no sabe qué es un parentesco** y no lo compone: lo que declara es la
   * ranura y su aire. Ver `anadido` en `Firma`.
   */
  anadido: { margen: 6 },
  /**
   * EL PIE DE SELLO — **2 pt bajo la calidad del firmante**, y cuesta 11 en total.
   *
   * Es la segunda ranura que este componente abre bajo la nota, y es distinta de `anadido`
   * en las dos cosas que importan: va ANTES —pegada a la identificación, que es lo que
   * acredita— y su aire es 2 en vez de 6. Con el renglón de `sello.pie` a 9, la celda sube
   * los 11 pt que la trazabilidad de II.7 declara.
   *
   * **Este componente no sabe qué es un sello** y no lo compone: lo que declara es la ranura
   * y su aire, igual que con el parentesco.
   */
  sello: { margen: 2 },
  celda: { superior: 14, inferior: 4 },
  /**
   * LA CAJA DE RÚBRICA — **142 × 77 pt, LA MISMA EN LOS NUEVE FORMATOS**, y es lo que
   * hace que una firma pese lo mismo en todos ellos.
   *
   * ══ QUÉ PROBLEMA RESUELVE ══════════════════════════════════════════════════
   *
   * `firmaTrazo.ts` redibuja cada firma capturada en un espacio CANÓNICO para que su
   * grosor impreso no dependa de cuánto ocupara el trazo. Ese mecanismo solo funciona
   * si la celda impresa tiene **la misma proporción que el espacio canónico**: entonces
   * `objectFit: contain` no deja holgura en ningún eje y los dpi salen fijos, la limite
   * el ancho o la limite el alto.
   *
   * La calibración anterior estaba hecha contra `FirmaBox` de v1 —245.76 × 48 pt,
   * proporción 5.12— y aquí la celda no mide eso ni mide siempre lo mismo:
   *
   *     2 columnas, medianil 24   →  231 pt   proporción 3.00
   *     2 columnas, medianil 30   →  228 pt   proporción 2.96
   *     3 columnas (II.9)         →  142 pt   proporción 1.84
   *
   * Sin caja propia, la rúbrica se contendría en la celda y los dpi cambiarían con el
   * formato Y con la forma de cada firma: medido, entre 187 y 519 dpi, o sea entre
   * 0.293 y 0.815 mm de grosor para el mismo trazo. Es la dispersión que el espacio
   * canónico existe para eliminar, volviendo por la puerta de atrás.
   *
   * ══ POR QUÉ 142 Y NO MÁS ═══════════════════════════════════════════════════
   *
   * Porque la caja tiene que caber en la celda MÁS ESTRECHA del sistema, y esa es la de
   * la denegación con sus tres columnas. Una caja más ancha se contendría dentro de esa
   * celda —y solo dentro de esa— y ahí se rompería otra vez el invariante.
   *
   * El alto son los 77 de `FIRMA.espacio` enteros: no hay razón para dejar aire, y el
   * espacio de escritura no cambia (regla 1).
   *
   * ⚠ **EL COSTE, DECLARADO:** en los formatos de dos columnas la rúbrica ocupa 142 de
   * los 228–231 pt disponibles. **La restricción muerde en el ANCHO, no en el alto**, al
   * revés de lo que parece al leer «no usa toda la celda». Consecuencia medida: una
   * firma de proporción normal (2–3) imprime MÁS GRANDE que en v1 —142 × 57.6 contra
   * 120 × 48—, y solo una muy plana (proporción > 5) imprime menor. Se acepta.
   *
   * ⚠ **SI ESTA CAJA CAMBIA, `firmaTrazo.ts` HAY QUE REHACERLO ENTERO.** Su espacio
   * canónico —592 × 321 px— es esta caja a 300 dpi, y su grosor está calibrado contra
   * esos dpi. Los dos números son el mismo número visto en dos unidades.
   */
  rubrica: { ancho: 142 },
  /**
   * LA MISMA FIRMA EN LAS LÁMINAS DE IMAGENOLOGÍA Y DE RECETA — 118.75 pt, no 120.8.
   *
   * ⚠ **SON DOS LÁMINAS Y NO UNA, Y COINCIDEN EN LAS SEIS CIFRAS.** Receta mide
   * `rótulo 11 · rúbrica 77 · filete 0.75 · nombre 15 · cédulas 11` con el nombre
   * en Archivo 11 / 15 y las cédulas en IBM Plex Sans 7.5 / 11 sobre
   * `tinta.etiqueta`. Es exactamente lo de abajo. Eso mueve `D9` —el desacuerdo
   * sobre la familia y el color de las cédulas— de «una contra una» a **dos contra
   * una**, y el uno que queda es Laboratorio.
   *
   * Los dos pt de diferencia no son uno: son cuatro desviaciones medidas, y las
   * cuatro se declaran aquí porque tienen un solo consumidor (I.1.7).
   *
   *     firma.rol         11      igual
   *     firma.espacio     77      igual
   *     línea              0.75   el chasis, `filete.fino` = 0.8
   *     aire bajo la línea 4      el chasis, `espacio.5`
   *     nombre            15      el chasis, `firma.nombre` = 11.5 / 16
   *     cédulas           11      igual de alto, distinto de familia y color
   *                       ─────
   *                       118.75
   *
   * ⚠ **D9, CON LA CIFRA AL LADO.** Estas dos láminas componen las cédulas en **IBM
   * Plex Sans, `tinta.etiqueta`**; Laboratorio en **Archivo, `tinta.secundaria`**.
   * Las tres son láminas aprobadas y la divergencia sigue abierta: se compone la de
   * cada formato y queda reportada, no se elige una.
   *
   * ⚠ La línea de 0.75 es el mismo píxel del riel (ver `TRAZO` en 2.F). Mismo aviso:
   * si 0.75 fuera el valor real, `filete.fino` está mal en los ocho.
   *
   * **`altoBloqueFirma()` sigue devolviendo 120.8 y esto no lo mueve.** Esa fórmula
   * es la que consume `umbralFirma()` y con él la regla 1 de 2.N en los ocho
   * formatos; cambiarla por una lámina movería el umbral de todos. El bloque de
   * este formato mide 2.05 pt MENOS que lo que el umbral reserva, que es holgura y
   * no defecto. Reportado.
   */
  medida: {
    linea: 0.75,
    aireNombre: ESPACIO[4],
    interlineadoNombre: 15,
    cuerpoNombre: 11,
  },
  /**
   * LA MISMA FIRMA EN LA LÁMINA DE HONORARIOS — **117.47 pt**, y cierra sin residuo.
   *
   *     firma.rol         11
   *     firma.espacio     77
   *     línea              0.47   las otras dos láminas, 0.75; el chasis, 0.8
   *     aire bajo la línea 4      igual que las otras dos; el chasis, `espacio.5`
   *     nombre            14      Archivo **10 / 14**
   *     cédulas           11      igual
   *                       ───────
   *                       117.47
   *
   * ⚠ **EL NOMBRE VA A 10 / 14 Y ES EL CUARTO VALOR DEL SISTEMA PARA EL MISMO
   * RENGLÓN.** Laboratorio lo compone a 11.5 / 16 —el rol `firma.nombre`—, Imagenología
   * y Receta a 11 / 15, Suplementación hereda esos, y esta lámina baja a 10 / 14. Se
   * compone el de cada lámina y **queda reportado**: no hay ninguna que gane sobre las
   * otras tres mientras las cuatro estén aprobadas.
   *
   * La línea de 0.47 es el mismo hairline con el que esta lámina dibuja los filetes de
   * su riel (0.475) y su regla de fila (0.63): ver `FILETE_HONORARIOS`. Mismo aviso que
   * en las otras dos medidas — si alguno de estos fuera el valor real del sistema,
   * `filete.fino` está mal en los ocho formatos.
   *
   * Las cédulas conservan el tratamiento de las otras dos láminas —IBM Plex Sans sobre
   * `tinta.etiqueta`, `D9`— porque esta no declara nada de ellas más que su alto, que
   * es el mismo. `DERIVADO POR MAYORÍA`, no medido.
   */
  medidaHonorarios: {
    linea: FILETE_HONORARIOS.firma,
    aireNombre: ESPACIO[4],
    interlineadoNombre: 14,
    cuerpoNombre: 10,
  },
} as const

/**
 * La raya del sistema con sus dos espacios: la misma que separa las tres zonas de
 * la banda de pie (2.M). Une las credenciales de un firmante en el renglón único
 * que declara `FIRMA_RENGLONES`. Ver la nota junto al render.
 */
const SEPARADOR_CREDENCIALES = ' · '

/**
 * N COLUMNAS IGUALES SOBRE LA CAJA, CON SU MEDIANIL. **El reparto es fórmula, nunca cifra.**
 *
 * Con dos columnas y el medianil de 24 da los 231 del chasis; con el de 30 da los **228** que
 * componen tres láminas —la pareja de firmas de II.6, la retícula de tres niveles de II.7 y la
 * variante por sustitución de II.9—, y ese es el reparto que explica
 * `GEOMETRIA.medianilInternamiento`: aquella lámina declara además dos cajas de 246 que no
 * caben juntas, así que se compone el MEDIANIL y las celdas se reparten lo que queda.
 * Consentimiento lo confirma por su cuenta, sin repetir el 246.
 *
 * ⚠ **Y CON TRES COLUMNAS DA 142**, que es la cifra que la guía de II.9 mide para su variante
 * de tres firmantes: (486 − 60) / 3 = 142 exactos. No hay que escribirla en ninguna parte —
 * sale de la misma resta— y por eso el parámetro nuevo es un NÚMERO DE COLUMNAS y no un
 * ancho. Ver `columnas` en `BloqueFirmasProps`.
 */
function anchoDeCelda(medianil: number, columnas: number): number {
  return (CAJA.ancho - medianil * (columnas - 1)) / columnas
}

const estilos = StyleSheet.create({
  /**
   * La variante `simple` ocupa la columna IZQUIERDA de la fila de cierre, que es
   * donde vive la caja de firma en los ocho formatos (I.1.3). **No es
   * `manuscrito.ancho`**, aunque mida lo mismo: ver la nota de `cierre.izquierda`.
   *
   * ⚠ **ESTABA A LA DERECHA Y ERA UN DEFECTO DE CHASIS.** I.1.3 declaraba «la caja
   * de firma vive en su columna derecha» y aquí se cableaba con `flex-end`. Las
   * láminas la ponen a la IZQUIERDA, con la cifra al lado —B.3 §2 y B.4: «firma a
   * la izquierda (246 pt) · QR y folio de verificación a la derecha»—. Los dos
   * nombres de `cierre.*` estaban cambiados y quedan corregidos en la capa de
   * tokens; esto es la otra mitad del mismo defecto.
   */
  cajaSimple: {
    width: CIERRE.izquierda,
    alignSelf: 'flex-start',
  },
  fila: {
    flexDirection: 'row',
  },
  /** El aire sobre lo que el formato cuelga bajo la nota. Ver `GEOMETRIA.anadido`. */
  anadido: { marginTop: GEOMETRIA.anadido.margen },
  /** El aire sobre el pie de sello, pegado a la calidad del firmante. */
  sello: { marginTop: GEOMETRIA.sello.margen },
  /**
   * Solo en `retícula` **CON MÁS DE UNA FILA**: es lo que separa una fila de la siguiente.
   *
   * ⚠ **LA CONDICIÓN DE «MÁS DE UNA FILA» ES NUEVA Y NO CAMBIA NADA YA COMPUESTO.** La ficha
   * declara este padding solo para `retícula` y la razón que da es explícita —«es lo que
   * separa las FILAS de una retícula»—, que es la misma por la que `pareja` nunca lo lleva:
   * con una sola fila no hay nada que separar. Mientras `retícula` significó «de 3 a 6 firmas
   * en dos columnas» las dos lecturas coincidían, porque tres firmas ya son dos filas; con
   * `columnas` una retícula puede tener una sola fila, y entonces los 18 pt se sumarían al
   * alto de la celda sin separar nada. Ver `columnas` en `BloqueFirmasProps`.
   *
   * El único consumidor anterior de `retícula` compone cuatro firmas en dos filas y no se
   * mueve ni un punto.
   */
  celdaEnReticula: {
    paddingTop: GEOMETRIA.celda.superior,
    paddingBottom: GEOMETRIA.celda.inferior,
  },
  /** Versalita: mayúsculas con tracking, como toda versalita del sistema. */
  rol: { ...estiloTipografico('firma.rol') },
  /**
   * El espacio de escritura. Caja vacía de `firma.espacio`: es donde se firma a
   * mano, o donde se estampa el trazo capturado del médico (regla 5).
   */
  espacio: {
    height: FIRMA.espacio,
    /**
     * ⚠ **`minHeight` Y NO `flexShrink: 0`: LA REGLA 1 NECESITA UNA GARANTÍA QUE EXISTA.**
     *
     * `@react-pdf/layout` compone `setFlexShrink` como `setYogaValue('flexShrink')(value || 1)`,
     * así que **un `flexShrink: 0` declarado se convierte en 1** y el nodo encoge igual que
     * cualquier otro. Medido: dos cajas de 80 en una fila de 100, una con `flexShrink: 0`,
     * salen las dos a 50.
     *
     * `minHeight` sí lo respeta Yoga —medido con el mismo caso: la caja protegida se queda en
     * 80 y su hermana absorbe todo el encogimiento—, y por eso la regla 1 se declara así. Sin
     * él, una hoja que cierra al ras encoge el espacio de escritura unas décimas **en
     * silencio**, que es exactamente lo que I.3.4 prohíbe.
     *
     * Los 77 pt no dependen de la hoja ni del hueco sobrante. Si no caben, se reparten en dos
     * hojas; nunca se comprimen.
     */
    minHeight: FIRMA.espacio,
    justifyContent: 'flex-end',
  },
  /**
   * La rúbrica no se estira: se apoya en la línea y conserva su proporción.
   *
   * ⚠ **`width` FIJO Y NO `100%`.** Es la caja de proporción fija de `GEOMETRIA.rubrica`,
   * y es lo que da a la firma el mismo peso en los nueve formatos: con el ancho heredado
   * de la celda, los dpi de colocación cambiaban con el formato —231, 228 o 142 pt— y con
   * la forma de cada trazo. Ver la nota larga de `GEOMETRIA.rubrica`.
   */
  rubrica: {
    width: GEOMETRIA.rubrica.ancho,
    height: FIRMA.espacio,
    objectFit: 'contain',
    objectPositionX: '0%',
  },
  /**
   * La línea. Caja sin alto propio con borde inferior, para que el filete SUME sus
   * 0.8 pt a los 77 del espacio en vez de comérselos por dentro — que es como está
   * escrita la fórmula de I.1.9.
   *
   * `filete.fino`, que es lo que declaran A.12 y B.1 §5. Una generación anterior lo
   * bajó a `filete.regla` para que el bloque cuadrara en los 119.45 pt medidos en la
   * lámina: **manda el valor declarado, no el que cuadra la suma.**
   */
  linea: {
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  /**
   * `espacio.5`, no `espacio.4`. Es el margen superior del nombre que mide la
   * lámina, y el mismo sumando que usa `altoBloqueFirma()`.
   */
  nombre: {
    ...estiloTipografico('firma.nombre'),
    marginTop: ESPACIO[5],
  },
  credencial: { ...estiloTipografico('firma.credencial') },
  /** Las cuatro desviaciones que las dos láminas miden. Ver `GEOMETRIA.medida`. */
  lineaMedida: {
    borderBottomWidth: GEOMETRIA.medida.linea,
  },
  nombreMedido: {
    ...estiloTipografico('firma.nombre'),
    fontSize: GEOMETRIA.medida.cuerpoNombre,
    lineHeight:
      GEOMETRIA.medida.interlineadoNombre / GEOMETRIA.medida.cuerpoNombre,
    // El tracking SÍ se recalcula, al revés que en las desviaciones de 2.F: el de
    // `firma.nombre` no es 0, así que mover el cuerpo lo mueve. La conversión
    // em → pt es la misma que hace `estiloTipografico()`.
    letterSpacing:
      TIPOGRAFIA['firma.nombre'].tracking * GEOMETRIA.medida.cuerpoNombre,
    marginTop: GEOMETRIA.medida.aireNombre,
  },
  credencialMedida: {
    ...estiloTipografico('firma.credencial'),
    fontFamily: FUENTE.humanista,
    color: TINTA.etiqueta,
  },
  /** Las mismas cuatro desviaciones con las cifras de Honorarios. */
  lineaHonorarios: {
    borderBottomWidth: GEOMETRIA.medidaHonorarios.linea,
  },
  nombreHonorarios: {
    ...estiloTipografico('firma.nombre'),
    fontSize: GEOMETRIA.medidaHonorarios.cuerpoNombre,
    lineHeight:
      GEOMETRIA.medidaHonorarios.interlineadoNombre /
      GEOMETRIA.medidaHonorarios.cuerpoNombre,
    letterSpacing:
      TIPOGRAFIA['firma.nombre'].tracking * GEOMETRIA.medidaHonorarios.cuerpoNombre,
    marginTop: GEOMETRIA.medidaHonorarios.aireNombre,
  },
})

/**
 * LAS TRES COMPOSICIONES DEL BLOQUE DE FIRMA, Y POR QUÉ ENTRAN POR PROP Y NO SOLO POR
 * LÁMINA.
 *
 *   `chasis`     la fórmula de I.1.9 sin tocar: línea 0.8, aire 5, nombre 11.5 / 16
 *   `estandar`   `GEOMETRIA.medida`, 118.75 pt — Imagenología, Receta, Suplementación
 *   `compacta`   `GEOMETRIA.medidaHonorarios`, 117.47 pt — Honorarios y la hoja 2 de II.6
 *
 * Hasta II.6, cuál se componía lo decidía la lámina y con eso bastaba. **Esa lámina
 * compone las DOS en el mismo documento**: la firma doble de la hoja 2 mide 117.47 —línea
 * 0.47, nombre 10 / 14— y la firma sola de la hoja 3 mide 118.48, que es `estandar` con su
 * residuo de 0.27 ya conocido. Con la lámina como único discriminante no hay forma de
 * componer las dos, así que **lo declara el formato**, que es quien sabe en qué hoja está.
 *
 * ⚠ **DOS COMPOSICIONES DE NOMBRE EN EL MISMO ARCHIVO, Y SON EL CUARTO Y EL SEGUNDO VALOR
 * DEL SISTEMA PARA ESE RENGLÓN.** Laboratorio lo compone a 11.5 / 16, Imagenología, Receta
 * y Suplementación a 11 / 15, Honorarios a 10 / 14, y II.6 a las dos. Se compone lo medido
 * y **queda reportado**: mientras las láminas estén aprobadas, ninguna gana sobre la otra.
 *
 * Sin la prop, la que fija la lámina, así que ningún formato ya construido cambia.
 */
export type CalibracionFirma = 'chasis' | 'estandar' | 'compacta'

function calibracionDeLamina(lamina: Lamina): CalibracionFirma {
  if (lamina === 'chasis') return 'chasis'
  return lamina === 'honorarios' ? 'compacta' : 'estandar'
}

export interface Firma {
  /**
   * Qué firma esta persona: `Firma y sello del médico`, `Paciente`, `Testigo 1`.
   * Se compone en versalita aquí; no lo pases ya en mayúsculas.
   */
  readonly rol: string
  /**
   * Nombre de quien firma. **Puede faltar y su renglón NO colapsa**: un testigo
   * sin nombre deja su línea —y el renglón de abajo— para llenarse a mano
   * (II.7 §5, NOM-004). Colapsarlo dejaría dos firmas vecinas de alto distinto y
   * quitaría el sitio donde se escribe el nombre.
   */
  readonly nombre?: string
  /**
   * PESO DEL NOMBRE, cuando la lámina lo compone por debajo del `firma.nombre` del rol.
   *
   * Lo declara una lámina y en una sola de sus dos firmas: la del paciente o familiar de
   * II.6 va en **400** y la del médico, a su lado, en 600. **Hoy no se ve**, porque esa
   * firma va con el renglón en blanco —quien firma escribe su nombre a mano— y un peso
   * sobre una cadena vacía no imprime nada. Se compone igualmente: el día que ese renglón
   * lleve un nombre saldría en 600 sin esto, que no es lo que mide la lámina. Anotado.
   */
  readonly pesoNombre?: Peso
  /** Cédulas o parentesco. El inventario por rol lo declara I.1.9. */
  readonly credenciales?: readonly string[]
  /**
   * Trazo capturado del médico, ya normalizado a PNG o JPG por quien llama
   * (I.3.8). Los demás firmantes firman a mano sobre la línea (regla 5).
   */
  readonly rubrica?: string
  /**
   * LO QUE CUELGA BAJO LA NOTA, compuesto por el FORMATO.
   *
   * ⚠ **NO ES UN ATAJO PARA METER MÁS RENGLONES DE IDENTIFICACIÓN.** Los renglones bajo la
   * línea los declara `FIRMA_RENGLONES` en I.1.9 y `altoBloqueFirma()` los cuenta: quien
   * añada uno por aquí hará que la fórmula mienta y que el umbral de 2.N pague el error.
   *
   * Existe por un caso y hoy tiene uno: la celda del familiar de II.7 lleva debajo un campo
   * `Parentesco con el paciente` —rótulo y línea de escritura— que **no es una credencial**
   * sino un dato que se llena a pluma después de firmar. Por eso el alto de esa celda
   * (146.95) no sale de la fórmula de I.1.9 y no debe salir: es la celda estándar más un
   * bloque que el formato cuelga.
   *
   * Este componente pone el aire —6 pt— y nada más. La tipografía y la línea las compone
   * quien lo declara, que es el mismo reparto que la ranura `contenido` de 2.I.
   */
  readonly anadido?: ReactNode
  /**
   * EL PIE DE SELLO DE TRAZABILIDAD, compuesto por el FORMATO.
   *
   * ⚠ **NO ES UN RENGLÓN DE IDENTIFICACIÓN Y NO PUEDE SERLO.** Vale aquí el mismo aviso que
   * en `anadido`: `FIRMA_RENGLONES` declara los renglones que van bajo la línea y
   * `altoBloqueFirma()` los cuenta, así que lo que entre por esta ranura **no lo ve la
   * fórmula** y el umbral de la regla 1 de 2.N se queda corto.
   *
   * Hoy lo usa un formato y no le afecta: II.7 reparte sus firmas por estructura —con saltos
   * de hoja declarados— y no entrega `firmas` a 2.N, así que ahí no hay umbral que mentir.
   * **Un formato que sí cierre con 2.N no debe usar esta ranura** sin corregir I.1.9 antes.
   *
   * Va DESPUÉS de la nota y ANTES de `anadido`: el sello acredita la identificación que
   * tiene encima, y lo que cuelga después —un parentesco que se llena a pluma— es otra cosa.
   */
  readonly sello?: ReactNode
}

/** Qué lámina fija la línea, el aire y los dos renglones de abajo. */
interface ConLamina {
  lamina?: Lamina
  /**
   * Cuál de las tres composiciones. Sin ella, la que fija la lámina — que es lo que
   * componen los cinco formatos anteriores. Ver `CalibracionFirma`.
   */
  calibracion?: CalibracionFirma
}

/**
 * EL PARÁMETRO NUEVO DE 2.L — **CUÁNTAS COLUMNAS TIENE LA RETÍCULA**, y por defecto dos.
 *
 * La ficha declaraba la retícula como «de 3 a 6 firmas **en dos columnas**», y ese 2 estaba
 * cableado: `enParejas()` partía la lista en filas de dos y las celdas medían 228 o 231. Con
 * tres firmantes eso da **dos filas y media fila vacía**, y en la lámina que lo destapó —II.9,
 * la denegación— desbordaba 62 pt de una hoja que tiene que ser una.
 *
 * **La regla de esa lámina es «tantas columnas como firmantes, una sola fila siempre»**, y con
 * ella sus tres firmas caben en 142 pt de celda cada una, verificado a que el rol, el nombre y
 * la nota entran en un renglón cada uno.
 *
 * ⚠ **ES UN PARÁMETRO, NO UN COMPONENTE NUEVO NI UNA VARIANTE NUEVA.** Lo único que cambia es
 * en cuántas columnas se reparte la misma caja de 486; la celda, su calibración, su
 * `wrap={false}` y las cinco ranuras de `Firma` son las de siempre. Añadir una cuarta variante
 * habría duplicado `UnaFirma` y su fórmula de alto para no cambiar ni un punto de la celda.
 *
 * **Sin él, dos** — que es lo que compone el único consumidor anterior de `retícula` y lo que
 * la ficha declaraba. Ningún formato ya construido cambia.
 *
 * ⚠ **NO ES UN ANCHO DE CELDA Y NO DEBE SERLO.** El ancho sale de `anchoDeCelda()` a partir del
 * medianil de la lámina, así que quien pase 3 no puede equivocarse en la resta. Un formato que
 * quisiera columnas desiguales no cabe aquí y **tampoco debería**: la retícula de firmas del
 * sistema reparte la caja en partes iguales, y un firmante con más sitio que otro es jerarquía
 * de otorgamiento, que es lo que II.7 compone con rótulos de nivel y no con anchos.
 *
 * ⚠ **EL FORMATO ES QUIEN LO SABE, Y TIENE QUE PASARLO.** Este componente **no** lo deduce de
 * `firmas.length`: hacerlo sería métrica decidida por el contenido en tiempo de render, que es
 * lo que I.3.4 prohíbe, y dejaría a II.7 —cuatro firmas que la lámina quiere en dos columnas—
 * componiendo cuatro columnas de 106 pt sin que nadie lo hubiera pedido.
 */
export type BloqueFirmasProps = ConLamina &
  (
    /**
     * Una firma, en la columna izquierda de la fila de cierre.
     *
     * `ancho` lo declara el formato cuando su fila de cierre no reparte las dos
     * columnas como las demás. Sin él, `cierre.izquierda` (246), que es lo que componen
     * los cuatro formatos anteriores.
     *
     * ⚠ **HONORARIOS LA COMPONE EN LA COLUMNA ESTRECHA, Y SIGUE SIENDO LA IZQUIERDA.**
     * Esa lámina pone el riel de importes (246) a la derecha y la firma (216) a la
     * izquierda: el reparto de I.1.3 es el mismo —246 / 24 / 216— pero cae del otro
     * lado. Por eso lo que entra es el ANCHO y no un lado: la regla de 2.L —«la caja de
     * firma vive en la columna izquierda»— no cambia, y los dos nombres de `cierre.*`
     * tampoco. Ver la nota de `Lamina` en la capa de tokens.
     */
    | { variante: 'simple'; firmas: readonly [Firma]; ancho?: number }
    /** Dos firmas en la misma fila. */
    | { variante: 'pareja'; firmas: readonly [Firma, Firma] }
    /** De 3 a 6 firmas, en dos columnas —o en las que declare `columnas`—. */
    | { variante: 'reticula'; firmas: readonly Firma[]; columnas?: number }
  )

/** Una firma: rol encima, espacio de escritura, línea, y la identificación. */
function UnaFirma({
  firma,
  calibracion,
}: {
  firma: Firma
  calibracion: CalibracionFirma
}): ReactElement {
  /**
   * `estandar` son las cuatro desviaciones de `GEOMETRIA.medida`, que dos láminas miden
   * con las mismas cifras; `compacta` son las de `GEOMETRIA.medidaHonorarios`, que difieren
   * en dos de las cuatro. Ver `CalibracionFirma`.
   */
  const medida = calibracion !== 'chasis'
  const honorarios = calibracion === 'compacta'

  return (
    <View>
      <Text style={estilos.rol}>{firma.rol.toUpperCase()}</Text>

      <View style={estilos.espacio}>
        {firma.rubrica === undefined ? null : (
          // `Image` es la primitiva de @react-pdf/renderer, no un `<img>` de
          // HTML: no admite `alt` y su salida es un PDF, no un árbol accesible.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={firma.rubrica} style={estilos.rubrica} />
        )}
      </View>

      <View
        style={[
          estilos.linea,
          honorarios
            ? estilos.lineaHonorarios
            : medida
              ? estilos.lineaMedida
              : {},
        ]}
      />

      {/*
        El renglón del nombre se reserva SIEMPRE, con o sin nombre: es la ranura
        que la fórmula de I.1.9 cuenta y es donde se escribe a mano cuando el
        formato deja la firma en blanco.
      */}
      <Text
        style={[
          honorarios
            ? estilos.nombreHonorarios
            : medida
              ? estilos.nombreMedido
              : estilos.nombre,
          firma.pesoNombre === undefined ? {} : { fontWeight: firma.pesoNombre },
        ]}
      >
        {firma.nombre ?? ' '}
      </Text>

      {/*
        UN SOLO RENGLÓN DE CREDENCIALES, SIEMPRE.

        La lámina imprime `Céd. Prof. 9552456 · Céd. Esp. 12085805` en una línea
        (B.1 §4), separadas por la raya del sistema. La versión anterior mapeaba el
        arreglo a un `Text` por elemento y sacaba dos renglones donde la lámina tiene
        uno: **11 pt de más en el bloque**, y una de las tres causas por las que 18
        estudios no cabían en una hoja.

        Se une AQUÍ y no en el formato porque `FIRMA_RENGLONES` declara un renglón de
        credencial por rol y `altoBloqueFirma()` cuenta ese renglón: si el formato
        pudiera pasar dos, la fórmula mentiría y el motor de flujo pagaría el error.
        Unir con un solo elemento es idempotente, así que los roles que ya traían una
        credencial no cambian.
      */}
      <Text style={medida ? estilos.credencialMedida : estilos.credencial}>
        {(firma.credenciales ?? []).join(SEPARADOR_CREDENCIALES) || ' '}
      </Text>

      {/* El pie de sello, pegado a la nota. Ver `sello` en `Firma`. */}
      {firma.sello === undefined ? null : (
        <View style={estilos.sello}>{firma.sello}</View>
      )}

      {/* La ranura del formato, con su aire. Ver `anadido` en `Firma`. */}
      {firma.anadido === undefined ? null : (
        <View style={estilos.anadido}>{firma.anadido}</View>
      )}
    </View>
  )
}

/**
 * Parte las firmas en filas de `columnas`. Con dos es la retícula que la ficha declaraba y el
 * reparto no cambia; con tres cabe una sola fila. Ver `columnas` en `BloqueFirmasProps`.
 */
function enFilas(
  firmas: readonly Firma[],
  columnas: number,
): readonly (readonly Firma[])[] {
  const filas: Firma[][] = []
  firmas.forEach((firma, indice) => {
    if (indice % columnas === 0) filas.push([firma])
    else filas[filas.length - 1].push(firma)
  })
  return filas
}

/** 2.L · `BloqueFirmas`. */
export default function BloqueFirmas(props: BloqueFirmasProps): ReactElement {
  const lamina = props.lamina ?? 'chasis'
  const calibracion = props.calibracion ?? calibracionDeLamina(lamina)
  /**
   * EL MEDIANIL DE 30, que componen TRES láminas: la pareja de II.6, la retícula de II.7 y las
   * dos variantes de II.9. Las demás componen el de 24. Ver `GEOMETRIA.medianilInternamiento`.
   *
   * Es lo único que la lámina decide de este reparto; **cuántas columnas hay lo decide el
   * formato**, y de las dos cosas juntas sale el ancho de celda.
   */
  const medianil =
    lamina === 'internamiento' ||
    lamina === 'consentimiento' ||
    lamina === 'denegacion'
      ? GEOMETRIA.medianilInternamiento
      : GEOMETRIA.medianil

  // Regla 3: `break-inside: avoid`. Un bloque de firmas no se parte entre hojas;
  // es uno de los cuatro bloques indivisibles de 2.N (`CONCILIA D44`).
  if (props.variante === 'simple') {
    return (
      <View
        style={[
          estilos.cajaSimple,
          props.ancho === undefined ? {} : { width: props.ancho },
        ]}
        wrap={false}
      >
        <UnaFirma firma={props.firmas[0]} calibracion={calibracion} />
      </View>
    )
  }

  const reticula = props.variante === 'reticula'
  /** Sin `columnas`, dos: la pareja siempre y la retícula que la ficha declaraba. */
  const columnas = reticula ? (props.columnas ?? 2) : 2
  const ancho = anchoDeCelda(medianil, columnas)
  const filas = enFilas(props.firmas, columnas)
  /**
   * El padding que separa una fila de la siguiente, **solo si hay una siguiente**. Ver
   * `celdaEnReticula`.
   */
  const conPaddingDeFila = reticula && filas.length > 1

  return (
    <View wrap={false}>
      {filas.map((fila) => (
        <View key={fila[0].rol} style={estilos.fila}>
          {fila.map((firma, columna) => (
            <View
              key={firma.rol}
              style={[
                { width: ancho },
                columna === 0 ? {} : { marginLeft: medianil },
                conPaddingDeFila ? estilos.celdaEnReticula : {},
              ]}
            >
              <UnaFirma firma={firma} calibracion={calibracion} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
