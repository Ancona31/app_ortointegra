/**
 * Sistema de documentos v2 — componente 2.C · `TituloDocumento`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.C, más las dos reglas del
 * preámbulo de la Sección II que aplican a los ocho formatos.
 *
 * Propósito: nombrar el documento. Es la primera lectura del receptor —farmacia,
 * admisión, laboratorio.
 *
 * LAS CUATRO REGLAS DE LA FICHA
 *
 * 1. Los títulos fijos CABEN EN UN RENGLÓN POR DISEÑO. Un título fijo que rompe a
 *    dos líneas es un error de redacción del título, no un caso de flujo — fue lo
 *    que obligó a acortar el de Imagenología. Aquí no hay nada que implementar:
 *    es una regla sobre las CADENAS de la Sección II, no sobre el render. Por eso
 *    `fijo` y `variable` se dibujan igual; lo que cambia es de dónde sale el texto
 *    y quién responde si no cabe.
 * 2. El título variable SÍ puede romper a dos líneas y el encabezado no se
 *    desalinea por ello. Sin `maxLines`, sin truncado, sin elipsis.
 * 3. La fecha se alinea por LÍNEA BASE con la PRIMERA línea del título, no con la
 *    última y no con el centro del bloque. Ver la nota larga en `cajaFecha`: es el
 *    punto donde react-pdf no llega y hay que saber por qué.
 * 4. La variante `ausente` COLAPSA ENTERA: no deja hueco reservado. Lo único que
 *    sobrevive es la separación que existe siempre bajo el filete —
 *    `transicion.tituloRiel`—, porque cuando no hay título el filete del membrete
 *    hace doble trabajo: cierra el membrete y abre el cuerpo.
 * 5. El SUBTÍTULO va bajo el título, separado por `espacio.2`, y colapsa si no
 *    viene. Ver la nota en `subtitulo`.
 * 6. El RIEL DE FOLIO ocupa la zona derecha del bloque, 156 pt de ancho fijo, y
 *    colapsa si no viene. Lo llevan siete de los ocho formatos; el Escrito Médico
 *    es el único sin folio. Ver la nota en `rielFolio`.
 *
 * LAS DOS REGLAS DEL PREÁMBULO DE II
 *
 * a. **El título se almacena en capitalización de oración y se compone en
 *    MAYÚSCULAS por transformación** (`CONCILIA D1`). Nunca se almacena en
 *    mayúsculas. La transformación ocurre aquí, en el render.
 * b. **La ranura de subtítulo se queda construida y HOY NO TIENE CONSUMIDORES.**
 *    `CONCILIA D2` la declaraba para los ocho formatos, deducida de la lámina; la
 *    deducción queda REVERTIDA por decisión de producto: ningún formulario de la
 *    app tiene ese campo y añadirlo obligaría a tocar los ocho para algo que
 *    quedaría vacío casi siempre. Solicitud de Laboratorio ya no lo pasa.
 *
 *    **NO BORRES LA RANURA.** La necesita el título variable del Escrito Médico, y
 *    sigue siendo el único sitio donde un subtítulo puede vivir: es parte del bloque
 *    de título (anexo A, P2-6). Colapsa si no viene, que es lo que hace ahora en el
 *    único formato construido.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import {
  CAJA,
  ESPACIO,
  RETICULA,
  TINTA,
  TIPOGRAFIA,
  TRANSICION,
  ZONA,
  estiloTipografico,
  type AcentoResuelto,
  type Lamina,
  type Peso,
} from './tokens'

/**
 * Rótulo del riel de folio. Se compone en versalita aquí, como toda versalita del
 * sistema: no lo pases ya en mayúsculas.
 */
const ETIQUETA_FOLIO = 'Folio'

/** Rótulo de la segunda celda del riel derecho. Solo la lámina de Imagenología. */
const ETIQUETA_EMISION = 'Emisión'

/**
 * GEOMETRÍA DEL BLOQUE EN LA LÁMINA DE IMAGENOLOGÍA.
 *
 * Las tres cifras son la misma decisión vista por sus tres lados: **el título de
 * este formato tuvo que acortarse por romper a dos líneas** (regla 1), y la
 * solución de la lámina fue darle caja de ancho FIJO en vez de `flex: 1`. Con 287
 * de título, 9 de medianil y 190 de riel se cierran los 486 de la caja, así que el
 * título no puede invadir el riel ni aunque crezca.
 *
 * El riel de 190 lleva DOS celdas —`Emisión` y `Folio`— con 16 pt entre ellas, y
 * es él quien fija el alto del bloque en 25 pt: la caja del título mide 20.
 *
 * Los dos aires del bloque también son propios: 6 pt hasta su filete y 10 pt del
 * filete al riel de identificación, donde el chasis pone 4 y 8
 * (`transicion.tituloFilete` y `transicion.tituloRiel`, medidos en Laboratorio).
 */
const IMAGENOLOGIA = {
  cajaTitulo: 287,
  rielDerecho: 190,
  medianilCeldas: 16,
  tituloFilete: 6,
  tituloRiel: 10,
} as const

/**
 * GEOMETRÍA DEL BLOQUE EN LA LÁMINA DE RECETA.
 *
 * Mismo reparto que Imagenología —caja fija a la izquierda, riel de dos celdas a la
 * derecha— con otras tres cifras: **267 + 9 + 210 = 486**, que vuelve a cerrar la
 * caja. El riel es 20 pt más ancho porque su folio es más largo: `P-B8570E3FA164`
 * contra `IMG-2026-0148`.
 *
 * ⚠ **`SPEC_DISENO_PARTE_B.md` B.3 §1 DICE QUE ESTA CAJA NO ES FIJA** —«sin caja de
 * ancho fijo (`flex: 1; min-width: 0`)»— y las coordenadas medidas dicen 267. Con
 * `flex: 1` la caja mediría exactamente lo mismo mientras el riel siga en 210, así
 * que las dos lecturas imprimen igual **hoy** y solo divergen si el título creciera.
 * Se compone FIJA por la razón de la regla 1 de la ficha: un título fijo que rompe a
 * dos líneas es un error de redacción, y una caja fija lo hace visible en el taller
 * en vez de dejar que el título coma riel en silencio. Reportado.
 *
 * El aire hasta su filete son **5 pt** —188.5 → 193.5—, que no es ni el 4 del chasis
 * ni el 6 de Imagenología. El aire de abajo, en cambio, **sí es el del chasis**:
 * 196 → 204 son los 8 pt de `transicion.tituloRiel`, así que este formato no
 * declara nada por ese lado.
 *
 * El medianil entre las dos celdas del riel —20 pt— es el único valor de este
 * bloque que **no sale de las coordenadas**: con `justify-content: flex-end` la
 * separación entre celdas no se puede despejar de los bordes del riel. Sale de
 * B.3 §2, que es la otra lectura del mismo archivo. Reportado como derivado.
 */
const RECETA = {
  cajaTitulo: 267,
  rielDerecho: 210,
  medianilCeldas: 20,
  tituloFilete: 5,
} as const

/**
 * GEOMETRÍA DEL BLOQUE EN LA LÁMINA DE SUPLEMENTACIÓN — **LAS DE RECETA, MENOS UNA**.
 *
 * Las cuatro cifras del reparto son idénticas a las de arriba y por eso se leen de
 * `RECETA` en vez de volver a escribirse: caja 267, riel 210, medianil de celdas 20 y
 * 5 pt hasta el filete. Copiarlas aquí crearía dos sitios de definición para el mismo
 * bloque medido dos veces igual, que es cómo se desincronizan.
 *
 * Lo único propio es el aire de ABAJO: **10 pt del filete al riel de identificación**,
 * donde Receta no declara nada y se queda con los 8 del chasis
 * (`transicion.tituloRiel`). `COINCIDENCIA` — vale lo mismo que el de Imagenología y
 * no es él: aquella lámina también mide 6 hasta su filete y esta mide 5, así que sus
 * dos aires no son la misma pareja.
 */
const SUPLEMENTACION = { ...RECETA, tituloRiel: 10 } as const

/**
 * GEOMETRÍA DEL BLOQUE EN LA LÁMINA DE HONORARIOS — **LA DEL CHASIS, Y ES LA MÁS ALTA**.
 *
 * Su reparto horizontal no es propio: caja de 321 y riel de 156, que son `zona.texto` y
 * `zona.riel` de A.8 sin tocar, y por eso aquí no se escribe ninguno de los dos. El
 * riel lleva UNA celda —solo `Folio`—, como el chasis: la emisión de este formato no
 * sube aquí, se queda en el riel de identificación con su rótulo entero
 * (`Fecha de emisión`).
 *
 * Lo propio son dos cosas, y las dos son de la columna del título:
 *
 * a. **El aire hasta el filete son 6 pt**, donde el chasis pone 4.
 *    `COINCIDENCIA` — vale lo mismo que el de Imagenología y no es él: aquella mide 10
 *    del filete al riel y esta 8, que es el del chasis. No son la misma pareja.
 * b. **El bloque mide 50 pt, el más alto del sistema**, y es el único que rotula su
 *    subtítulo. Las tres piezas cierran la cifra sin residuo:
 *
 *        título       20      `titulo.documento`, 17 / 20
 *        rótulo       15      4 de margen + 11 de `etiqueta`
 *        subtítulo    15      11 / 15, que NO es el rol
 *        ────────────────
 *                     50
 *
 * ⚠ **EL SUBTÍTULO SE DESVÍA EN CUERPO, INTERLINEADO Y TINTA.** `titulo.subtitulo` va a
 * 10.5 / 14 en `tinta.secundaria` y esta lámina lo compone a **11 / 15 en tinta plena**.
 * Es una desviación declarada de variante, con el patrón de 2.F, 2.B y 2.L: el rol no se
 * toca —lo sigue usando quien lo instancie— y no sube a I.1.4 mientras tenga un solo
 * consumidor. La tinta plena es lo que lo separa de un subtítulo cualquiera: aquí el
 * subtítulo es el PROCEDIMIENTO, que es lo que la aseguradora busca al leer la hoja.
 */
const HONORARIOS = {
  tituloFilete: 6,
  /** Aire entre el título y el rótulo del subtítulo. */
  aireRotulo: ESPACIO[4],
  subtitulo: { cuerpo: 11, interlineado: 15 },
} as const

/**
 * GEOMETRÍA DEL BLOQUE EN LA LÁMINA DE INTERNAMIENTO — **LA CAJA MÁS ANCHA DEL SISTEMA**.
 *
 * Mismo reparto que Imagenología y Receta —caja fija a la izquierda, riel de dos celdas a
 * la derecha— con la caja del título en **297 pt**, diez más que la de Imagenología. Y el
 * aire hasta su filete son los **5 pt** de Receta, así que se leen de allí.
 *
 * ⚠ **LAS DOS CIFRAS DE LA LÁMINA NO CIERRAN LA CAJA, Y SE COMPONE LA DEL TÍTULO.** Mide
 * caja 297 y riel derecho 190; con el medianil de retícula eso son **496**, diez por
 * encima de `caja.ancho`. Aquí el riel se DERIVA —486 − 9 − 297 = 180— y un 190 literal en
 * este archivo significaría que el bloque desborda:
 *
 * - La caja es la pieza que la regla 1 de 2.C protege: `SOLICITUD DE INTERNAMIENTO` es el
 *   título fijo más largo de los seis formatos y es justo por eso que esta lámina le da
 *   diez puntos más que Imagenología. Recortarla a 287 devolvería el defecto que aquella
 *   tuvo que resolver acortando su propio título.
 * - El riel aguanta la resta sin apretarse porque **este formato no lleva folio** (ver la
 *   cabecera de II.6): su riel derecho compone una sola celda, `Emisión`, y 180 pt le
 *   sobran. Los 190 harían falta con las dos.
 *
 * Reportado.
 *
 * **LAS DOS CELDAS DEL RIEL SE DESVÍAN EN CUERPO Y UNA TAMBIÉN EN PESO.** El rol `folio`
 * va a 11 / 14 en peso 500 y esta lámina compone las dos a **10 / 14**, con la emisión en
 * **400** y el folio en 500. Es una desviación declarada del par, con el patrón de 2.F,
 * 2.B y 2.L: el rol no se toca y no sube a I.1.4 mientras tenga un solo consumidor.
 *
 * ⚠ La lámina declara la tinta —`#1a3250`, que es `acento.tinta` con el acento por
 * defecto— **solo para el folio**. La emisión conserva la del rol, que es la misma.
 * `DERIVADO, NO MEDIDO`.
 */
const INTERNAMIENTO = {
  cajaTitulo: 297,
  /** DERIVADO: lo que queda de la caja tras el título y su medianil. Ver arriba. */
  rielDerecho: CAJA.ancho - RETICULA.medianil - 297,
  medianilCeldas: IMAGENOLOGIA.medianilCeldas,
  celda: { cuerpo: 10, interlineado: 14, pesoEmision: 400 as Peso },
} as const

/** Interlineado del título: el alto de UNA de sus líneas. Lo usa la fecha. */
const ALTO_LINEA_TITULO = TIPOGRAFIA['titulo.documento'].interlineado ?? 0

const estilos = StyleSheet.create({
  /**
   * El bloque siempre aporta su separación inferior, en las tres variantes.
   *
   * Eso NO contradice la regla 4: `transicion.tituloRiel` no es hueco reservado
   * para el título, es la separación que hay bajo el filete que abre el cuerpo.
   * Con título es el filete del título; sin título es el del membrete. Lo que
   * desaparece en `ausente` es el bloque del título entero y su propio filete.
   */
  bloque: {
    width: '100%',
    marginBottom: TRANSICION.tituloRiel,
  },
  bloqueImagenologia: {
    marginBottom: IMAGENOLOGIA.tituloRiel,
  },
  /**
   * `COINCIDENCIA` con el de arriba, y por eso es un estilo aparte y no el mismo: las
   * dos láminas miden 10 pt en este aire por su cuenta. Fusionarlos ataría el bloque
   * de un formato al del otro.
   */
  bloqueSuplementacion: {
    marginBottom: SUPLEMENTACION.tituloRiel,
  },
  fila: {
    flexDirection: 'row',
  },
  columnaTitulo: {
    // Regla 2: el título toma el ancho restante y rompe solo. Sin truncado.
    flex: 1,
  },
  /**
   * La caja fija de la lámina de Imagenología. No es `flex: 1` con un máximo: es
   * ancho fijo, que es lo que garantiza que el título no colisione con el riel de
   * 190 pase lo que pase con la cadena (ver `IMAGENOLOGIA`).
   */
  columnaTituloFija: {
    width: IMAGENOLOGIA.cajaTitulo,
    flexShrink: 0,
  },
  columnaTituloFijaReceta: {
    width: RECETA.cajaTitulo,
    flexShrink: 0,
  },
  columnaTituloFijaInternamiento: {
    width: INTERNAMIENTO.cajaTitulo,
    flexShrink: 0,
  },
  /** La ranura de lo que cuelga bajo el título, dentro del bloque. */
  bajoTitulo: {
    marginTop: ESPACIO[4],
    flexDirection: 'row',
  },
  titulo: { ...estiloTipografico('titulo.documento') },
  /**
   * REGLA 5 — LA SEPARACIÓN DEL SUBTÍTULO.
   *
   * `espacio.4` sale de la ESCALA y no de la geometría interna del componente
   * porque aquí no hay nada que transcribir: el diseño nunca inventarió el
   * subtítulo (`CONCILIA D2`), así que no existe una cifra medida que declarar.
   *
   * De la escala se elige el mínimo por jerarquía: título y subtítulo son UN
   * SOLO bloque, y su separación interna tiene que ser estrictamente menor que
   * la que cierra el bloque —`transicion.tituloFilete`, 10 pt— y que la que lo
   * separa del riel —`transicion.tituloRiel`, 20 pt—. Con 4 pt el orden queda
   * 4 < 10 < 20 y el subtítulo se lee pegado a su título.
   *
   * NO se usa `transicion.seccionParrafo` aunque la relación sea análoga
   * —encabezado y el texto que lo explica—: ese token tiene dos extremos
   * declarados y I.1.7 prohíbe leer la coincidencia de valor como identidad.
   * Moverlo para ajustar un encabezado de sección no debe arrastrar al subtítulo.
   */
  subtitulo: {
    ...estiloTipografico('titulo.subtitulo'),
    // `espacio.2`, medido en B.1 §1 («margen superior 2 pt»). La versión anterior
    // usaba `espacio.4`, elegido por jerarquía porque el diseño «nunca inventarió
    // el subtítulo»; la lámina sí lo tiene y sí lo mide, así que el razonamiento
    // sobra. El orden que aquel argumento buscaba se conserva: 2 < 4 < 8.
    marginTop: ESPACIO[2],
  },
  /**
   * EL RIEL DE FOLIO. Zona derecha del bloque de título, de ancho FIJO: A.8 declara
   * las dos zonas del bloque —texto 321 pt (columnas 1–8), riel 156 pt (9–12)— y
   * B.1 §2 lo confirma sobre la lámina de Laboratorio, «riel de folio de 156 pt a
   * la derecha».
   *
   * No comparte caja con la fecha y no puede: la fecha se apoya en la línea base
   * del título (regla 3) y el folio es un par etiqueta + valor de dos renglones.
   * Ningún formato lleva los dos —la fecha en el encabezado es solo del Escrito
   * Médico (II.8 §5), que es el único sin folio—, así que no hay que decidir cómo
   * conviven.
   */
  rielFolio: {
    width: ZONA.riel,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  /**
   * El riel derecho de la lámina de Imagenología: 190 pt y DOS celdas alineadas a
   * la derecha, con 16 pt entre ellas. Es él quien fija el alto del bloque.
   */
  rielDoble: {
    width: IMAGENOLOGIA.rielDerecho,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  rielDobleReceta: {
    width: RECETA.rielDerecho,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  rielDobleInternamiento: {
    width: INTERNAMIENTO.rielDerecho,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  celdaRiel: {
    alignItems: 'flex-end',
  },
  celdaRielSiguiente: {
    marginLeft: IMAGENOLOGIA.medianilCeldas,
  },
  celdaRielSiguienteReceta: {
    marginLeft: RECETA.medianilCeldas,
  },
  etiquetaFolio: { ...estiloTipografico('etiqueta') },
  /**
   * REGLA 3, Y HASTA DÓNDE LLEGA EL RENDERER.
   *
   * `alignItems: 'baseline'` NO sirve aquí: react-pdf no le da a Yoga una función
   * de línea base para los nodos de texto —no existe `setBaselineFunc` en
   * `@react-pdf/layout`—, así que Yoga usa el borde inferior del nodo. Con un
   * título de dos líneas eso alinearía la fecha con la SEGUNDA, que es
   * exactamente lo que la regla prohíbe.
   *
   * Lo que se hace: la caja de la fecha mide una línea de título de alto y su
   * texto se apoya abajo. Así la fecha queda siempre en la primera línea, nunca
   * en la segunda ni centrada entre ambas. Lo que quedan alineados con exactitud
   * son los BORDES INFERIORES de las dos cajas de línea; las líneas base quedan
   * desplazadas 1.976 pt, con la fecha por debajo del título.
   *
   * Esa cifra NO es un residuo que haya que perseguir: es geometría derivada del
   * componente, declarada en la ficha de 2.C con su fórmula. react-pdf sitúa la
   * línea base a `ascendente × cuerpo` del borde superior de la caja de línea, y
   * la caja mide el interlineado, así que el desplazamiento sale de los dos roles
   * y del ascendente de Archivo (878/1000 em):
   *
   *     (20 − 11) − 0.878 × (17 − 9) = 1.976 pt = 0.70 mm
   *
   * Medido contra el flujo de contenido del PDF real, no estimado. No lo
   * «corrijas» con un desplazamiento duro: dependería del ascendente de la
   * familia y de los dos cuerpos, y se rompería en silencio al cambiar
   * cualquiera de los tres.
   */
  cajaFecha: {
    height: ALTO_LINEA_TITULO,
    justifyContent: 'flex-end',
    // La ficha no declara el medianil entre título y fecha. Se usa el separador
    // de columnas del sistema en vez de inventar una cifra.
    marginLeft: RETICULA.medianil,
    // La fecha es un dato corto y entero: no se comprime ni rompe.
    flexShrink: 0,
  },
  fecha: { ...estiloTipografico('fecha.encabezado') },
  /**
   * EL RÓTULO DEL SUBTÍTULO — la versalita del sistema, con su aire de 4 pt. Es la
   * única pieza de este bloque que no existía: hasta esta lámina, un subtítulo era un
   * renglón suelto bajo el título y nadie decía qué era. Ver `HONORARIOS`.
   */
  rotuloSubtitulo: {
    ...estiloTipografico('etiqueta'),
    marginTop: HONORARIOS.aireRotulo,
  },
  /** El subtítulo con la desviación de la lámina encima del rol. Ver `HONORARIOS`. */
  subtituloHonorarios: {
    ...estiloTipografico('titulo.subtitulo'),
    fontSize: HONORARIOS.subtitulo.cuerpo,
    lineHeight: HONORARIOS.subtitulo.interlineado / HONORARIOS.subtitulo.cuerpo,
    color: TINTA.negra,
    // El mismo aire que el subtítulo del chasis cuando NO hay rótulo del que colgar.
    // Con rótulo lo anula el render: el rótulo ya trae el suyo.
    marginTop: ESPACIO[2],
  },
  hastaFilete: {
    marginTop: TRANSICION.tituloFilete,
  },
  hastaFileteImagenologia: {
    marginTop: IMAGENOLOGIA.tituloFilete,
  },
  hastaFileteReceta: {
    marginTop: RECETA.tituloFilete,
  },
  hastaFileteHonorarios: {
    marginTop: HONORARIOS.tituloFilete,
  },
})

interface ConTitulo {
  /**
   * En capitalización de oración. Se compone en mayúsculas aquí (regla a del
   * preámbulo de II): no lo pases ya en mayúsculas.
   */
  titulo: string
  /** Colapsa si no viene (regla b del preámbulo de II). */
  subtitulo?: string
  /**
   * RÓTULO DEL SUBTÍTULO, en capitalización de oración: la versalita la pone el render.
   *
   * Lo lleva un solo formato —II.5 rotula el suyo `Procedimiento o motivo`— y es lo que
   * convierte un renglón suelto en un dato con nombre. Colapsa con el subtítulo: sin
   * subtítulo no hay nada que rotular, que es la misma condición con la que colapsa el
   * rótulo de la nota en 2.G.
   */
  rotuloSubtitulo?: string
  /**
   * Fecha del encabezado, ya formateada por quien llama —II.8 la imprime en forma
   * corta y sin rótulo—. Colapsa si no viene: solo un formato la lleva aquí.
   */
  fecha?: string
  /**
   * Folio del documento, ya generado. Colapsa si no viene.
   *
   * **Siete de los ocho formatos lo llevan.** El único sin folio es el Escrito
   * Médico, y las láminas lo dicen dos veces (B.8: «Folio — no existe en ninguna
   * parte», «el único formato sin folio»). La decisión de que Laboratorio no lo
   * llevara —II.1 §1, «nadie de fuera cita el número de una solicitud»— iba contra
   * su propia lámina, que compone el riel de 156 pt y emite con prefijo.
   */
  folio?: string
  /**
   * Fecha y hora de emisión, YA compuestas por quien llama —la lámina de
   * Imagenología imprime `4 ago 2026 · 11:05`—. Ocupa la primera celda del riel
   * derecho y colapsa si no viene, que es lo que hace en los otros siete formatos.
   *
   * No es la `fecha` de arriba y no se confunde con ella: aquella es la del
   * Escrito Médico, va sin rótulo y se apoya en la línea base del título (regla 3).
   * Esta es un par rótulo + valor dentro del riel, como el folio.
   */
  emision?: string
  /**
   * LO QUE CUELGA BAJO EL TÍTULO, DENTRO DEL BLOQUE, a `espacio.4`.
   *
   * Es una ranura y no una prop `urgente`: 2.C no tiene por qué conocer 2.H ni el
   * booleano que lo enciende. Hoy la ocupa un solo formato —el badge `URGENTE` de
   * Imagenología, que la lámina compone a 4 pt bajo el título y DENTRO del bloque,
   * encima del filete— y por eso no se declara nada más.
   *
   * ⚠ Con la ranura ocupada el bloque deja de medir los 25 pt que fija el riel
   * derecho: la columna del título pasa a 20 + 4 + 14.5 = 38.5 y el bloque entero
   * crece 13.5 pt. Las coordenadas medidas de la lámina son las de la hoja SIN
   * badge; con badge todo lo que va debajo baja esos 13.5.
   */
  bajoTitulo?: ReactNode
  acento: AcentoResuelto
  /** Qué lámina fija la geometría del bloque. Sin ella, la del chasis. */
  lamina?: Lamina
}

export type TituloDocumentoProps =
  /** 7 de los 8 formatos. El texto es constante del formato. */
  | ({ variante: 'fijo' } & ConTitulo)
  /** Escrito Médico. Lo escribe el médico. */
  | ({ variante: 'variable' } & ConTitulo)
  /** Escrito Médico sin título. No deja hueco reservado. */
  | { variante: 'ausente' }

/**
 * UNA CELDA DEL RIEL DE FOLIO: rótulo en versalita y valor en `folio`.
 *
 * Exportada porque el membrete de continuación compone la misma pareja a la derecha
 * de su cabecera (2.B, ranura `riel`), y **la pareja tiene que tener un solo sitio de
 * definición**: son dos roles y una transformación a versalita, y con dos copias
 * bastaría con tocar una para que el folio de la hoja 1 y el de la 2 dejaran de
 * parecerse. Es el mismo criterio con que 2.F se quedó la composición del riel que
 * 2.D había escrito por su cuenta (I.3.5).
 *
 * El rol `folio` va en `acento.tinta`, así que se resuelve en el render y se esparce
 * en un literal: misma razón de tipos que en 2.B, 2.D, 2.F y 2.G.
 */
export function CeldaFolio({
  etiqueta,
  valor,
  acento,
  desviacion,
}: {
  readonly etiqueta: string
  readonly valor: string
  readonly acento: AcentoResuelto
  /**
   * Desviación declarada del rol `folio`, cuando la lámina compone el valor con otro
   * cuerpo o con otro peso. Solo se escribe lo que se desvía: familia, tracking y color
   * los sigue poniendo el rol, y por eso el estilo se arma AQUÍ y no en la hoja de
   * estilos — el color depende del acento y se resuelve en el render.
   *
   * Hoy la declara una lámina, en sus dos celdas. Ver `INTERNAMIENTO`.
   */
  readonly desviacion?: {
    readonly cuerpo: number
    readonly interlineado: number
    readonly peso?: Peso
  }
}): ReactElement {
  return (
    <>
      <Text style={estilos.etiquetaFolio}>{etiqueta.toUpperCase()}</Text>
      <Text
        style={{
          ...estiloTipografico('folio', acento),
          ...(desviacion === undefined
            ? {}
            : {
                fontSize: desviacion.cuerpo,
                lineHeight: desviacion.interlineado / desviacion.cuerpo,
                // El tracking SÍ se recalcula: el de `folio` no es 0 —vale 0.03 em—, así
                // que mover el cuerpo lo mueve. Misma conversión que `estiloTipografico()`.
                letterSpacing: TIPOGRAFIA.folio.tracking * desviacion.cuerpo,
                ...(desviacion.peso === undefined ? {} : { fontWeight: desviacion.peso }),
              }),
        }}
      >
        {valor}
      </Text>
    </>
  )
}

/** El rótulo del riel de folio, para quien componga la celda desde fuera. */
export const ETIQUETA_FOLIO_RIEL = ETIQUETA_FOLIO

/** 2.C · `TituloDocumento`. */
export default function TituloDocumento(props: TituloDocumentoProps): ReactElement {
  if (props.variante === 'ausente') {
    // Regla 4: colapsa entero. Solo queda la separación bajo el filete del
    // membrete, que aquí hace de filete de apertura del cuerpo.
    return <View style={estilos.bloque} />
  }

  /**
   * DOS LÁMINAS COMPONEN EL RIEL DERECHO CON DOS CELDAS Y UNA CON UNA. Lo que
   * distingue a `chasis` de las otras dos es la ANATOMÍA del riel —`Folio` solo
   * contra `Emisión` + `Folio`—; lo que distingue a las otras dos entre sí son solo
   * cifras. Por eso el árbol se ramifica una vez, por `doble`, y las cifras entran
   * como estilo.
   */
  const lamina = props.lamina ?? 'chasis'
  const imagen = lamina === 'imagenologia'
  const suplementacion = lamina === 'suplementacion'
  const honorarios = lamina === 'honorarios'
  /**
   * Suplementación compone el bloque **con las cifras de Receta** (ver `SUPLEMENTACION`),
   * así que aquí van juntas: lo único que las separa es el aire de abajo, y ese se
   * decide en el contenedor.
   */
  const receta = lamina === 'receta' || suplementacion
  const internamiento = lamina === 'internamiento'
  const doble = imagen || receta || internamiento

  /**
   * Una celda del riel derecho: rótulo en versalita y valor en `folio`. El rol va
   * en `acento.tinta`, así que se resuelve en el render y se esparce en un
   * literal: misma razón de tipos que en 2.B, 2.D, 2.F y 2.G.
   *
   * `peso` es la única pieza que las dos celdas de Internamiento no comparten: la emisión
   * baja a 400 y el folio se queda en el 500 del rol.
   */
  const celda = (etiqueta: string, valor: string, peso?: Peso): ReactElement => (
    <CeldaFolio
      etiqueta={etiqueta}
      valor={valor}
      acento={props.acento}
      desviacion={
        internamiento
          ? {
              cuerpo: INTERNAMIENTO.celda.cuerpo,
              interlineado: INTERNAMIENTO.celda.interlineado,
              peso,
            }
          : undefined
      }
    />
  )

  return (
    <View
      style={[
        estilos.bloque,
        imagen
          ? estilos.bloqueImagenologia
          : suplementacion
            ? estilos.bloqueSuplementacion
            : {},
      ]}
    >
      <View style={estilos.fila}>
        <View
          style={
            imagen
              ? estilos.columnaTituloFija
              : receta
                ? estilos.columnaTituloFijaReceta
                : internamiento
                  ? estilos.columnaTituloFijaInternamiento
                  : estilos.columnaTitulo
          }
        >
          <Text style={estilos.titulo}>{props.titulo.toUpperCase()}</Text>
          {/*
            EL RÓTULO VA ENTRE EL TÍTULO Y EL SUBTÍTULO, y él lleva el aire de los dos:
            con rótulo, el subtítulo va pegado a su rótulo —los 15 pt del bloque son 4 +
            11 y 15 limpios—; sin él, conserva el `espacio.2` de la lámina de
            Laboratorio. Son dos composiciones del mismo par, no un margen que se suma.
          */}
          {props.subtitulo === undefined ? null : (
            <>
              {props.rotuloSubtitulo === undefined ? null : (
                <Text style={estilos.rotuloSubtitulo}>
                  {props.rotuloSubtitulo.toUpperCase()}
                </Text>
              )}
              <Text
                style={[
                  honorarios ? estilos.subtituloHonorarios : estilos.subtitulo,
                  props.rotuloSubtitulo === undefined ? {} : { marginTop: 0 },
                ]}
              >
                {props.subtitulo}
              </Text>
            </>
          )}
          {props.bajoTitulo === undefined ? null : (
            <View style={estilos.bajoTitulo}>{props.bajoTitulo}</View>
          )}
        </View>
        {props.fecha === undefined ? null : (
          <View style={estilos.cajaFecha}>
            <Text style={estilos.fecha}>{props.fecha}</Text>
          </View>
        )}

        {doble ? (
          /*
            EL RIEL DERECHO CON DOS CELDAS — 190 pt en Imagenología, 210 en Receta.
            Es lo que fija el alto del bloque en 25 pt: 11 de rótulo más 14 de
            valor, en las dos láminas. Las dos celdas colapsan por separado, como
            cualquier par rótulo + valor del sistema (2.E).
          */
          <View
            style={
              imagen
                ? estilos.rielDoble
                : internamiento
                  ? estilos.rielDobleInternamiento
                  : estilos.rielDobleReceta
            }
          >
            {props.emision === undefined ? null : (
              <View style={estilos.celdaRiel}>
                {celda(
                  ETIQUETA_EMISION,
                  props.emision,
                  internamiento ? INTERNAMIENTO.celda.pesoEmision : undefined,
                )}
              </View>
            )}
            {props.folio === undefined ? null : (
              <View
                style={[
                  estilos.celdaRiel,
                  props.emision === undefined
                    ? {}
                    : imagen || internamiento
                      ? estilos.celdaRielSiguiente
                      : estilos.celdaRielSiguienteReceta,
                ]}
              >
                {celda(ETIQUETA_FOLIO, props.folio)}
              </View>
            )}
          </View>
        ) : props.folio === undefined ? null : (
          <View style={estilos.rielFolio}>{celda(ETIQUETA_FOLIO, props.folio)}</View>
        )}
      </View>

      {/*
        DOS LÁMINAS MIDEN 5 pt HASTA EL FILETE. Internamiento cierra su bloque en 202.69 y
        abre el filete en 207.69, que son los mismos 5 de Receta: se lee de allí en vez de
        declarar un miembro que valdría lo mismo. El aire de ABAJO sí es el del chasis —
        210.19 → 218.19 son los 8 de `transicion.tituloRiel`—, así que no declara ninguno.
      */}
      <View
        style={
          imagen
            ? estilos.hastaFileteImagenologia
            : receta || internamiento
              ? estilos.hastaFileteReceta
              : honorarios
                ? estilos.hastaFileteHonorarios
                : estilos.hastaFilete
        }
      >
        <FileteGruesoFino acento={props.acento} />
      </View>
    </View>
  )
}
