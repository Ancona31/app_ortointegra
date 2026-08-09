/**
 * Sistema de documentos v2 — formato II.5 · **Recibo de Honorarios / Cotización**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada**, con
 * `DOCUMENTOS_SPEC.md` II.5 y `SPEC_DISENO_PARTE_B.md` B.5 como segunda lectura. Donde
 * difieren manda la lámina, y difieren en bastantes sitios: están listados abajo.
 *
 * UN FORMATO, DOS CASOS, UN SOLO COMPONENTE
 *
 * Cotización y Recibo no cambian solo el título: cambian en TRECE cosas medidas —el
 * riel, la aseguradora, la columna de origen, los subtotales, el rótulo del total, el
 * anticipo, la forma de pago, el QR, las notas y el prefijo del folio—. Aun así son un
 * solo componente con **variantes declaradas**, y eso es I.3.5: si esto acabara en dos
 * archivos, el chasis estaría mal.
 *
 * Lo que hace posible que sea uno solo es que las trece diferencias entran por el TIPO
 * de la unión discriminada de abajo, no por trece condiciones sueltas: el tipo impide
 * pasarle un anticipo a una cotización o una aseguradora a un recibo, así que ninguna
 * de las trece se puede mezclar por descuido.
 *
 * ESTE ARCHIVO SÍ DECIDE TIPOGRAFÍA, Y ES EL PRIMERO QUE LO HACE — PERO NO LA ESCRIBE
 *
 * Los cuatro formatos anteriores no componen ni un cuerpo. Este monta tres bloques que
 * no son de ningún componente del chasis —la tabla de conceptos, el riel de aseguradora
 * y la forma de pago— más el contenido de dos marcos parciales, que 2.U envuelve sin
 * componer. **Los doce roles que eso necesita viven en I.1.4**, con el criterio de los
 * cuatro `cita.*`: lo que compone un formato entra por la única puerta a la escala. En
 * este archivo no hay un solo `fontSize`.
 *
 * LO QUE LA LÁMINA CONTRADICE DEL SPEC, Y GANA LA LÁMINA
 *
 * a. **No hay `ContadorLista` en ninguna hoja** (`D24`). II.5 §3 lo declara con
 *    `<ÍTEMS>` = CONCEPTOS y el diseño no lo instancia, ni siquiera en la hoja 1 del
 *    recibo de 14, que es hoja intermedia y según la regla del chasis debería llevarlo.
 *    No se compone. Reportado.
 * b. **El paciente vacío NO colapsa**: conserva su rótulo y deja una línea de escritura
 *    (2.F, 2.D). II.5 §5 dice lo contrario —«no imprime un guion ni una línea, porque
 *    nadie va a llenarlo a mano»— y la lámina del recibo mínimo la dibuja. Reportado.
 * c. **La celda de vigencia lleva fondo**, el único del sistema, y es un velo nuevo al
 *    8 % (`D25`). Ver `veloDeAcento` en la capa de tokens y `GEOMETRIA.honorarios` en
 *    2.D: se compone porque el color no es el único portador de significado.
 * d. **Las notas van a 9.5 / 14 y en bandera izquierda** (`D28`). De los dos ejes de esa
 *    divergencia se compone uno: el cuerpo, que es de la lámina, y **no** la
 *    justificación con partición, que I.3.2 prohíbe sin excepción. Ver `texto.reducido`.
 * e. **El membrete va sin cédulas ni universidad** (`D23`), como Laboratorio. Segunda
 *    lámina de cinco que lo compone así. Reportado en 2.B.
 * f. **La divisa, la fecha del anticipo y el rótulo `Método` van en la neo-grotesca** y
 *    la lámina los compone en IBM Plex Mono, que I.1.4 prohíbe en documento impreso.
 *    Casos sexto, séptimo y octavo (`CONCILIA D13, D20, D30`).
 * g. **El nombre bajo la firma va a 10 / 14**, cuarto valor del sistema para el mismo
 *    renglón. Se compone el de esta lámina y queda reportado en 2.L.
 *
 * LAS TRES CALIBRACIONES DE FILA, Y POR QUÉ SE COMPONE UNA
 *
 * B.5 §3 mide la fila de la tabla en **21.42** pt (cotización de 4), **17.21** (recibo
 * de 14) y **22.47** (mínimo de 1). Eso es exactamente lo que `D4` prohíbe: un
 * documento no cambia de métrica según cuántos ítems traiga (I.3.4). Se compone **una
 * sola**, la del caso de volumen, y las otras dos quedan reportadas — mismo criterio con
 * el que 2.G declara sus cinco calibraciones y ninguna se elige en tiempo de render.
 *
 * ⚠ La compuesta da **17.63** y no 17.21: 2 + 13 + 2 + 0.63. Los cuerpos son los que el
 * paso 4.5 entrega —9 / 13 y 10.5 / 13—, que son los de la calibración de cotización;
 * B.5 §3 mide la de volumen a 9 / 12.5 y 10 / 12.5, y con esos la fila daría 17.13. Los
 * 0.42 quedan reportados.
 *
 * LA FILA DE CIERRE, QUE VA AL REVÉS QUE EN LOS OTROS CUATRO
 *
 * La firma vive en la columna IZQUIERDA, en `x = 72`, y mide **216** pt; el riel de
 * importes en la DERECHA, en `x = 312`, y mide **246**. Es el mismo reparto de I.1.3
 * —246 / 24 / 216— cayendo del otro lado, así que los tokens se leen por su VALOR y no
 * por su nombre. Ver la nota de `Lamina` en la capa de tokens.
 *
 * ⚠ **LA LÁMINA COMPONE CUATRO DISPOSICIONES DE ESA FILA Y AQUÍ HAY DOS.** Las que
 * faltan son las del recibo de 14, que reparte su cierre entre dos hojas: la nota de
 * origen y el riel en la hoja 1, y la forma de pago con la firma —a 246, sin riel al
 * lado— en la 2. **No se compone, y no por falta de sitio**: elegir entre esa
 * disposición y la del recibo mínimo exige saber si el documento cabe en una hoja, que
 * es contenido en tiempo de render (I.3.4). Se compone la del mínimo —que es la que
 * también funciona cuando cabe todo— y, cuando no cabe, la fila entera viaja a la hoja
 * 2 con su riel dentro, en vez de partirse. Reportado.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina lo mide en **270.7** pt con aseguradora y **208.8** sin ella, desde el
 * margen de 54. Como en los otros cuatro, eso no es una constante que copiar:
 *
 *     fila superior del membrete   56      (el panel; la lámina la mide en 58.85)
 *     aire                          8      `transicion.membreteFilete`
 *     filete principal              2.5
 *     aire                          6      `transicion.membreteLineaFina`
 *     banda de dirección           12      UN renglón, sin cédulas (D23)
 *     espaciador de cierre         12      2.B
 *     bloque de título             50      ← el más alto del sistema
 *     aire                          6      ← 2.C, y aquí son 6 y no los 4 del chasis
 *     filete del título             2.5
 *     aire                          8      `transicion.tituloRiel`, el del chasis
 *     riel de identificación       30.95   (0.475 + 30 + 0.475)
 *     aire hasta la cabecera       12
 *                                 ────────
 *                                 205.95   contra los 208.8 de la lámina
 *
 * Con aseguradora se sustituyen esos 12 finales por 10 + 52.53 + 12 y salen **268.48**
 * contra los 270.7 medidos. Las dos diferencias se explican enteras con dos residuos ya
 * conocidos, y las dos están fijadas en `src/lib/tests/reciboHonorarios.test.ts`:
 *
 *     sin aseguradora   205.95   ← 2.85 por debajo. Es el hueco del PANEL: 56 pt en el
 *                                  chasis contra 59 en la lámina, la quinta que lo mide
 *                                  así, y está en los dos lados porque el panel está en
 *                                  los dos.
 *     con aseguradora   268.48   ← 2.22 por debajo. Son los mismos 2.85 menos los 0.63
 *                                  que el bloque de aseguradora compone de MÁS, que es
 *                                  el residuo de caja de línea de esta lámina — el mismo
 *                                  0.63 con el que mide su regla de fila.
 *
 * Reportado.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import MotorFlujo from '../MotorFlujo'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import RielImportes, {
  type AnticipoRecibido,
  type FilaImporte,
} from '../RielImportes'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import ParserBloques from '../ParserBloques'
import ZonaQR from '../ZonaQR'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import {
  CIERRE,
  ESPACIO,
  FILETE,
  FILETE_HONORARIOS,
  MARGEN,
  PAPEL,
  RETICULA,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

// ─── Las cadenas que este formato declara, textuales de la lámina ────────────

/** Los dos valores del título fijo. Se componen en mayúsculas en 2.C. */
const TITULO_COTIZACION = 'Cotización'
const TITULO_RECIBO = 'Recibo de honorarios'
/** El único rótulo de subtítulo del sistema (2.C regla 6). */
const ROTULO_SUBTITULO = 'Procedimiento o motivo'
/** Los cuatro rótulos de la tabla. `#` es el mismo del espécimen y de 2.G. */
const CABECERA = {
  numero: '#',
  concepto: 'Concepto',
  origen: 'Origen',
  precio: 'Precio',
} as const
/** Los dos valores de la marca de origen. */
const ORIGEN = { propio: 'Propio', tercero: 'Tercero' } as const
/** Los tres rótulos del riel de aseguradora. */
const ASEGURADORA = {
  bloque: 'Aseguradora',
  poliza: 'Póliza',
  cobertura: 'Cobertura',
} as const
/**
 * Los dos rótulos del total. **No es el mismo dato con otro nombre**: una cotización
 * estima y un recibo cobra, y la palabra es lo que lo dice.
 */
const ROTULO_TOTAL_COTIZACION = 'Total estimado'
const ROTULO_TOTAL_RECIBO = 'Total'
/** Las dos líneas de la leyenda no fiscal. Van en jerarquía visible (II.5 §1). */
const NO_FISCAL_TITULO = 'Documento informativo'
const NO_FISCAL_CUERPO =
  'No es un Comprobante Fiscal Digital por Internet (CFDI).'
/** Encabezado del bloque de notas, uno por caso. */
const ENCABEZADO_NOTAS_COTIZACION = 'Notas y consideraciones'
const ENCABEZADO_NOTAS_RECIBO = 'Origen de los conceptos'
/** Forma de pago: su encabezado y el rótulo de su único dato. */
const ENCABEZADO_FORMA_PAGO = 'Forma de pago'
const ROTULO_METODO = 'Método'
/**
 * ⚠ **NO ES «Firma y sello del médico».** `D14` sigue reportado sin resolver: las dos
 * solicitudes rotulan la firma con sello y Receta y Suplementación sin él. Esta lámina
 * no declara la cadena, así que se toma la de los dos formatos más cercanos —los que
 * tampoco pasan por ventanilla de hospital—. `DERIVADO POR PRECEDENTE`.
 */
const ROTULO_FIRMA = 'Firma del médico'
const ROTULO_VERIFICACION = 'Verificación'
/** La raya del sistema, la misma con la que 2.B une las cédulas y 2.L las credenciales. */
const RAYA = ' · '
/**
 * EL ECO DEL TOTAL, que ningún otro formato tiene.
 *
 * La hoja 2 de un recibo cierra con la firma y sin un solo importe: sin el eco sería una
 * hoja firmada que no dice cuánto se cobra. La lámina compone
 * `14 conceptos · total $18,400.00 USD en la hoja 1`.
 *
 * ⚠ **«en la hoja 1» VA LITERAL Y ESO SOLO ES VERDAD CON DOS HOJAS.** Es lo que compone
 * la lámina, y el dato que haría falta para escribirlo de otra manera —en cuál de las
 * hojas anteriores quedó el total— es del mismo tipo que el rango de ítems que `D5`
 * tuvo que retirar del aviso de pie: el renderer no lo reporta. Reportado.
 */
const ITEMS = 'conceptos'
const ECO_CIERRE = 'en la hoja 1'
const ECO_TOTAL = 'total'

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina.
 *
 * Mismo criterio que en 4.1 a 4.4: I.1.7 no nombra ninguna de estas parejas, así que
 * gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es literal y
 * ninguna es miembro nuevo.
 *
 *   riel → aseguradora            **10 pt**
 *   aseguradora → cabecera        **12 pt**
 *   riel → cabecera, sin ella     **12 pt**
 *   última fila → fila de cierre  **10 pt**
 *
 * **Faltan las del encabezado y las tres van declaradas en el chasis:** membrete →
 * título es el espaciador de 2.B, título → filete y filete → riel son los aires de 2.C.
 * Sumar cualquiera aquí la contaría dos veces.
 *
 * Y faltan las dos del aviso de continuación —cierre → filete de aviso 14.53 y aviso →
 * banda 16—, que **no las pone este archivo**: el aviso de 2.N vive en posición absoluta
 * colgado del borde inferior de la caja, así que su separación es una resta del margen y
 * no un margen de nadie. Ver la cabecera de 2.N.
 */
const SEPARACION_RIEL_ASEGURADORA = ESPACIO[10]
const SEPARACION_HASTA_CABECERA = ESPACIO[12]
const SEPARACION_TABLA_CIERRE = ESPACIO[10]

/**
 * GEOMETRÍA DE LA TABLA DE CONCEPTOS, medida en la lámina.
 *
 * ⚠ **NO ES UNA `EntradaNumerada` Y NO DEBE SERLO** (B.5 §3, con esas palabras). Sus
 * cuatro columnas son una retícula de tabla, no las cinco ranuras de 2.G: aquí el número
 * va alineado a la DERECHA de su riel, el precio a la derecha de una columna de ancho
 * fijo y la marca de origen es tipográfica y sin caja, donde 2.G monta un bloque en
 * negativo. Meterlo en aquel componente pediría una calibración, una disposición y tres
 * ranuras nuevas para que dejara de parecerse a lo que hace.
 *
 * Las dos retículas cierran la caja exacta, con el medianil del sistema entre columnas:
 *
 *     con origen   23.25 + 9 + 273.75 + 9 + 66 + 9 + 96 = 486
 *     sin origen   23.25 + 9 + 348.75 + 9 + 96          = 486
 *
 * El `1fr` del concepto **no se declara**: sale solo de restar las demás, que es lo mismo
 * que hace la tercera columna de 2.G.
 *
 * ⚠ **LA COLUMNA DE ORIGEN LA DECIDE EL TIPO DE DOCUMENTO, NO EL CONTENIDO.** B.5 §3 la
 * declara «según haya mezcla de origen», que sería métrica decidida en tiempo de render
 * (I.3.4); el paso 4.5 la declara por caso —la cotización la lleva, el recibo no— y es lo
 * que se compone. Reportado.
 */
const TABLA = {
  origen: 66,
  precio: 96,
  /** Padding vertical de la fila. Ver la nota de las tres calibraciones. */
  padding: 2,
} as const

/**
 * GEOMETRÍA DEL RIEL DE ASEGURADORA, medida en la lámina.
 *
 * Es «un segundo riel» según B.5 §6 y **no lo compone 2.F**: no tiene filetes de
 * apertura ni de cierre, no tiene reglas verticales, sus celdas no salen de `riel.celda`
 * —136.1, 120 y 96— y se separan con un medianil de 24 en vez de con una regla. Un riel
 * sin ninguna de las cuatro cosas que hacen a un riel es otra cosa.
 *
 * Los tres anchos cierran el interior del marco: 136.1 + 24 + 120 + 24 + 96 = 400.1,
 * contra los 399.47 que deja la caja de 426 menos su filete y su sangría. Los 0.63 de
 * sobra son del mismo orden que los demás residuos de esta lámina.
 */
const RIEL_ASEGURADORA = {
  nombre: 136.1,
  poliza: 120,
  cobertura: 96,
  medianil: 24,
  /** Aire entre el rótulo del bloque y la fila de celdas. */
  aireFila: ESPACIO[2],
} as const

/**
 * AIRE ENTRE EL QR Y LA FIRMA, y entre el riel de importes y lo que lleva debajo.
 *
 * `DERIVADO POR PRECEDENTE`, no medido: la lámina apila las piezas de sus dos columnas y
 * no da ninguna de las tres separaciones. Se toman los dos miembros de la escala que el
 * sistema ya usa para exactamente esto — `espacio.16` es el aire que la fórmula de
 * `umbral.firma` pone sobre la firma en los ocho formatos (I.1.9), y `espacio.12` y
 * `espacio.16` son los que separan los bloques de cierre en las láminas de Receta y de
 * Suplementación. Reportado.
 */
const AIRE_FIRMA = ESPACIO[16]
const AIRE_LEYENDA = ESPACIO[12]
const AIRE_NOTAS = ESPACIO[16]

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la banda de 2.M.
    paddingBottom: MARGEN.inferior,
  },

  // ── El riel de aseguradora ─────────────────────────────────────────────────
  bloqueAseguradora: { marginTop: SEPARACION_RIEL_ASEGURADORA },
  rotuloAseguradora: { ...estiloTipografico('etiqueta') },
  filaAseguradora: {
    flexDirection: 'row',
    // Las tres celdas se apoyan por su borde inferior, que es lo único alineable
    // aquí (ver `cajaFecha` en 2.C): el nombre mide 15 y las otras dos 23.
    alignItems: 'flex-end',
    marginTop: RIEL_ASEGURADORA.aireFila,
  },
  celdaNombre: { width: RIEL_ASEGURADORA.nombre, flexShrink: 0 },
  celdaPoliza: {
    width: RIEL_ASEGURADORA.poliza,
    flexShrink: 0,
    marginLeft: RIEL_ASEGURADORA.medianil,
  },
  celdaCobertura: {
    width: RIEL_ASEGURADORA.cobertura,
    flexShrink: 0,
    marginLeft: RIEL_ASEGURADORA.medianil,
  },
  nombreAseguradora: { ...estiloTipografico('aseguradora.nombre') },
  rotuloCelda: { ...estiloTipografico('aseguradora.rotulo') },
  valorCelda: { ...estiloTipografico('aseguradora.valor') },

  // ── La tabla de conceptos ──────────────────────────────────────────────────
  /**
   * La cabecera mide 16 pt —11 de rótulo + 3 de aire + 2 de filete— igual que la de
   * 2.G, y por las mismas dos cifras del chasis: `transicion.tablaFilete` y
   * `filete.acento`. Es lo único de esta tabla que coincide con aquella.
   */
  cabecera: {
    flexDirection: 'row',
    paddingBottom: TRANSICION.tablaFilete,
    borderBottomWidth: FILETE.acento,
    marginTop: SEPARACION_HASTA_CABECERA,
  },
  rotuloColumna: { ...estiloTipografico('etiqueta') },
  fila: {
    flexDirection: 'row',
    paddingTop: TABLA.padding,
    paddingBottom: TABLA.padding,
    borderBottomWidth: FILETE_HONORARIOS.regla,
    borderBottomColor: TINTA.reglaFila,
  },
  /**
   * El riel del número, con el ancho y el medianil del sistema —23.25 + 9 = una columna
   * exacta—, y **alineado a la DERECHA**, que es lo que lo separa de 2.G: allí lo que
   * alinea los números es el ancho fijo de la caja y aquí, además, su borde derecho.
   */
  columnaNumero: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
    textAlign: 'right',
  },
  columnaConcepto: { flex: 1, marginRight: RETICULA.medianil },
  columnaOrigen: {
    width: TABLA.origen,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  /**
   * ⚠ **LOS IMPORTES SE ALINEAN AL BORDE DERECHO Y NO POR EL PUNTO DECIMAL.** La columna
   * es de ancho fijo y las cifras son tabulares, así que las unidades caen en la misma
   * vertical sin depender de cuántos dígitos traiga cada precio. Alinear por el punto
   * exigiría partir la cadena, y este componente no formatea importes: llegan compuestos.
   */
  columnaPrecio: { width: TABLA.precio, flexShrink: 0, textAlign: 'right' },
  numero: { ...estiloTipografico('concepto.numero') },
  concepto: { ...estiloTipografico('concepto.texto') },
  precio: { ...estiloTipografico('concepto.texto') },
  origenPropio: { ...estiloTipografico('concepto.origenPropio') },
  origenTercero: { ...estiloTipografico('concepto.origenTercero') },

  // ── La fila de cierre ──────────────────────────────────────────────────────
  /**
   * LA FILA DE CIERRE, INVERTIDA RESPECTO DE LOS OTROS CUATRO FORMATOS.
   *
   * La columna de la firma es la ESTRECHA (216) y la del riel de importes la ANCHA
   * (246). Los dos anchos salen de `cierre.*` por su valor; ver la cabecera del archivo
   * y la nota de `Lamina` en la capa de tokens antes de leerlos por su nombre.
   *
   * SIN `marginTop`: el aire hasta el cierre lo aporta 2.N por `aireFirma`, que es quien
   * monta el bloque indivisible. Declararlo aquí también lo contaría dos veces.
   */
  filaCierre: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  columnaFirma: { width: CIERRE.derecha, flexShrink: 0 },
  columnaImportes: {
    width: CIERRE.izquierda,
    flexShrink: 0,
    marginLeft: CIERRE.medianil,
  },
  hastaFirma: { marginTop: AIRE_FIRMA },
  hastaLeyenda: { marginTop: AIRE_LEYENDA },
  hastaNotas: { marginTop: AIRE_NOTAS },

  // ── Los dos bloques que 2.U envuelve sin componer ──────────────────────────
  noFiscalTitulo: { ...estiloTipografico('noFiscal.titulo') },
  noFiscalCuerpo: { ...estiloTipografico('noFiscal.cuerpo') },
  encabezadoNotas: { ...estiloTipografico('recomendaciones.encabezado') },

  // ── La forma de pago ───────────────────────────────────────────────────────
  encabezadoFormaPago: { ...estiloTipografico('recomendaciones.encabezado') },
  filaFormaPago: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: ESPACIO[2],
  },
  rotuloMetodo: {
    ...estiloTipografico('formaPago.rotulo'),
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  valorMetodo: { ...estiloTipografico('formaPago.valor'), flex: 1 },
})

/**
 * Un concepto de la relación. **Las dos primeras ranuras bloquean la emisión** (II.5
 * §2): al menos un concepto, y su precio mayor que cero. Eso se valida en el formulario,
 * no aquí — I.3.7: la validación bloquea, el render nunca colapsa.
 */
export interface ConceptoCobrado {
  readonly concepto: string
  /** Importe YA compuesto por quien llama, con su signo y su separador de miles. */
  readonly precio: string
  /**
   * De quién es el honorario. Colapsa: en un recibo la columna no existe, y en una
   * cotización un concepto sin origen deja su celda vacía sin cerrar la columna — que
   * es lo mismo que hace la celda de indicación de 2.G.
   */
  readonly origen?: 'propio' | 'tercero'
}

/** La aseguradora. Colapsa ENTERA, no por celdas (B.5 §5). */
export interface AseguradoraCotizacion {
  readonly nombre: string
  /** Colapsa la celda. */
  readonly poliza?: string
  /** Colapsa la celda. */
  readonly cobertura?: string
}

/**
 * La divisa, en sus dos piezas. Entra partida y no ya redactada porque el documento la
 * imprime de dos maneras: entera bajo el total —`USD · Dólares estadounidenses`— y solo
 * el código en el eco de la hoja 2 —`total $18,400.00 USD`—. Unirlas es redacción de
 * este formato, como el ancla de Receta.
 */
export interface Divisa {
  /** `MXN`, `USD`. */
  readonly codigo: string
  /** `Pesos mexicanos`. Colapsa: bajo el total queda el código solo. */
  readonly nombre?: string
}

interface Comun {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa TRES de las nueve celdas de 2.D —paciente,
   * fecha de emisión y vigencia— y ninguna otra: no hay edad, ni sexo, ni expediente, ni
   * diagnóstico.
   *
   * **`paciente` puede venir vacío y es el único formato donde puede** (II.5 §2). Cuando
   * falta, la celda no colapsa: conserva su rótulo y deja la línea para llenarla a mano.
   */
  readonly paciente: ValoresPaciente
  /** El procedimiento o motivo, bajo el título y con su rótulo. Colapsa. */
  readonly procedimiento?: string
  /** `lineas[]` bloquea emisión en el formulario: al menos una (II.5 §2). */
  readonly conceptos: readonly ConceptoCobrado[]
  /** La cifra del total, YA compuesta. Este formato no suma: recibe sumado. */
  readonly total: string
  /** Por defecto MXN en el formulario, no aquí: si no viene, no se imprime. */
  readonly divisa?: Divisa
  /** Cuerpo del bloque de notas. Colapsa entero con su encabezado. */
  readonly notas?: string
  /** Folio del documento, ya generado. Prefijos `Q-` y `R-` en la lámina. */
  readonly folio: string
  /** Trazo capturado del médico (2.L regla 5). */
  readonly rubrica?: string
}

/**
 * LAS TRECE DIFERENCIAS, EN UN TIPO.
 *
 * Cada rama declara solo lo que su caso puede llevar, así que el compilador impide pasar
 * un anticipo a una cotización o una aseguradora a un recibo. Es lo que hace que el
 * componente pueda ser uno solo sin que los dos casos se contaminen (I.3.5).
 */
export type ReciboHonorariosProps = Comun &
  (
    | {
        readonly tipo: 'cotizacion'
        /** Las dos filas de subtotal. Vacías, colapsan con su filete (2.T regla 3). */
        readonly subtotales?: readonly FilaImporte[]
        /** Colapsa el riel entero, con su marco y su aire. */
        readonly aseguradora?: AseguradoraCotizacion
        /**
         * Ráster del QR de verificación, ya generado. Sin él la zona colapsa y la firma
         * se queda sola en su columna, que es lo que ocurre en una vista previa (2.R
         * regla 3). **Solo la cotización lo lleva**: un recibo no lo verifica nadie.
         */
        readonly qr?: string
      }
    | {
        readonly tipo: 'recibo'
        /** Anticipo, su fecha y el saldo. Colapsan las tres filas (2.T regla 3). */
        readonly anticipo?: AnticipoRecibido
        /** Método de pago, ya redactado. Colapsa el bloque entero. */
        readonly formaPago?: string
      }
  )

/** La firma del médico tratante, que es la única del formato. */
function firmaDelMedico(medico: MedicoMembrete, rubrica?: string): Firma {
  return {
    rol: ROTULO_FIRMA,
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
}

/** `USD · Dólares estadounidenses`, con la raya del sistema. Sin nombre, el código. */
function divisaCompleta(divisa: Divisa | undefined): string | undefined {
  if (divisa === undefined) return undefined
  return tieneValor(divisa.nombre)
    ? `${divisa.codigo}${RAYA}${divisa.nombre}`
    : divisa.codigo
}

/** Regla 1 de 2.G, que aquí también aplica: dos dígitos hasta 99. */
function numeroDeFila(indice: number): string {
  return String(indice + 1).padStart(2, '0')
}

/** Una fila de la tabla. `conOrigen` lo declara el caso, nunca el contenido. */
function FilaConcepto({
  linea,
  indice,
  conOrigen,
}: {
  readonly linea: ConceptoCobrado
  readonly indice: number
  readonly conOrigen: boolean
}): ReactElement {
  return (
    // Una fila no se parte entre hojas, por la misma razón que una entrada de 2.G:
    // un concepto con su precio en dos hojas distintas es un importe sin dueño.
    <View style={estilos.fila} wrap={false}>
      <Text style={[estilos.numero, estilos.columnaNumero]}>
        {numeroDeFila(indice)}
      </Text>
      <Text style={[estilos.concepto, estilos.columnaConcepto]}>
        {linea.concepto}
      </Text>
      {!conOrigen ? null : (
        <Text
          style={[
            linea.origen === 'tercero' ? estilos.origenTercero : estilos.origenPropio,
            estilos.columnaOrigen,
          ]}
        >
          {linea.origen === undefined
            ? ''
            : (linea.origen === 'tercero' ? ORIGEN.tercero : ORIGEN.propio).toUpperCase()}
        </Text>
      )}
      <Text style={[estilos.precio, estilos.columnaPrecio]}>{linea.precio}</Text>
    </View>
  )
}

/** II.5 · Recibo de Honorarios / Cotización. */
export default function ReciboHonorarios(props: ReciboHonorariosProps): ReactElement {
  const cotizacion = props.tipo === 'cotizacion'
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la da
  // sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(props.medico, props.rubrica)]
  const aseguradora = cotizacion ? props.aseguradora : undefined
  const divisa = divisaCompleta(props.divisa)

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico: props.medico,
          consultorio: props.consultorio,
          panel: props.panel,
          acento: props.acento,
          lamina: 'honorarios',
          titulo: cotizacion ? TITULO_COTIZACION : TITULO_RECIBO,
          subtitulo: props.procedimiento,
          rotuloSubtitulo: ROTULO_SUBTITULO,
          paciente: props.paciente,
          rielHonorarios: cotizacion ? 'cotizacion' : 'recibo',
          folio: props.folio,
          /*
            EL ECO DEL TOTAL, y solo lo compone este formato. Sale en la línea de
            paciente de las hojas de continuación —2.V decide en cuáles—, así que aquí
            se declara y no se coloca.
          */
          eco: `${props.conceptos.length} ${ITEMS}${RAYA}${ECO_TOTAL} ${props.total}${
            props.divisa === undefined ? '' : ` ${props.divisa.codigo}`
          } ${ECO_CIERRE}`,
        }}
        /*
          SIN CONTADOR EN NINGUNA HOJA. Es `D24` y no se compone: II.5 §3 lo declara y el
          diseño no lo instancia, ni siquiera en la hoja intermedia del recibo de 14. Ver
          el punto (a) de la cabecera.
        */
        aireFirma={SEPARACION_TABLA_CIERRE}
        firmas={
          /*
            LA FILA DE CIERRE ENTERA, dentro del bloque que 2.N cierra con `wrap={false}`.
            Es lo que la lámina llama «bloque indivisible» y presupuesta en 290 pt: el
            riel de importes y la firma no se separan.
          */
          <View style={estilos.filaCierre}>
            <View style={estilos.columnaFirma}>
              {/*
                EL QR VA ARRIBA DE LA FIRMA, no a su lado: en este formato la columna de
                la firma es la estrecha y la de al lado la ocupa el riel de importes. Es
                la disposición `honorarios` de 2.R —código a la izquierda, texto de 146 a
                su derecha—, y sus tres cifras cierran los 216 de la columna.
              */}
              {cotizacion && tieneValor(props.qr) ? (
                <ZonaQR
                  qr={props.qr}
                  rotulo={ROTULO_VERIFICACION}
                  folio={props.folio}
                  acento={props.acento}
                  lamina="honorarios"
                />
              ) : null}

              {/* LA FORMA DE PAGO. Solo el recibo: una cotización no se cobra. */}
              {!cotizacion && tieneValor(props.formaPago) ? (
                <View>
                  <Text style={estilos.encabezadoFormaPago}>
                    {ENCABEZADO_FORMA_PAGO.toUpperCase()}
                  </Text>
                  <View style={estilos.filaFormaPago}>
                    <Text style={estilos.rotuloMetodo}>
                      {ROTULO_METODO.toUpperCase()}
                    </Text>
                    <Text style={estilos.valorMetodo}>{props.formaPago}</Text>
                  </View>
                </View>
              ) : null}

              <View style={estilos.hastaFirma}>
                <BloqueFirmas
                  variante="simple"
                  lamina="honorarios"
                  ancho={CIERRE.derecha}
                  firmas={firmas}
                />
              </View>
            </View>

            <View style={estilos.columnaImportes}>
              {/*
                EL RIEL DE IMPORTES. Las dos disposiciones de 2.T, declaradas por el caso:
                en la cotización los subtotales abren y el total cierra; en el recibo el
                total abre y el anticipo cuelga debajo.
              */}
              {cotizacion ? (
                <RielImportes
                  disposicion="subtotales"
                  subtotales={props.subtotales ?? []}
                  rotuloTotal={ROTULO_TOTAL_COTIZACION}
                  divisa={divisa}
                  total={props.total}
                />
              ) : (
                <RielImportes
                  disposicion="anticipo"
                  anticipo={props.anticipo}
                  rotuloTotal={ROTULO_TOTAL_RECIBO}
                  divisa={divisa}
                  total={props.total}
                />
              )}

              {/*
                LA LEYENDA NO FISCAL, en marco parcial. Va en jerarquía visible y no en
                gris pequeño al pie (II.5 §1): sus dos líneas comparten cuerpo y tinta, y
                lo que las distingue es el peso y la familia. 2.U pone el marco; el ancho
                y la sangría los declara este sitio, que es la regla 4 de su ficha.
              */}
              <View style={estilos.hastaLeyenda}>
                <MarcoParcial
                  ancho={MARCO.leyenda.ancho}
                  padding={MARCO.leyenda.padding}
                  acento={props.acento}
                >
                  <Text style={estilos.noFiscalTitulo}>{NO_FISCAL_TITULO}</Text>
                  <Text style={estilos.noFiscalCuerpo}>{NO_FISCAL_CUERPO}</Text>
                </MarcoParcial>
              </View>

              {/*
                LAS NOTAS. Mismo bloque y dos encabezados: en la cotización explican los
                importes de terceros y en el recibo sustituyen a la columna de origen.
                El cuerpo pasa por 2.J en `texto.reducido` —bandera izquierda, nunca
                justificado (I.3.2)—. Ver el punto (d) de la cabecera.
              */}
              {tieneValor(props.notas) ? (
                <View style={estilos.hastaNotas}>
                  <Text style={estilos.encabezadoNotas}>
                    {(cotizacion
                      ? ENCABEZADO_NOTAS_COTIZACION
                      : ENCABEZADO_NOTAS_RECIBO
                    ).toUpperCase()}
                  </Text>
                  <ParserBloques
                    texto={props.notas}
                    marca="raya"
                    rolCuerpo="texto.reducido"
                  />
                </View>
              ) : null}
            </View>
          </View>
        }
      >
        {/*
          EL RIEL DE ASEGURADORA. Solo la cotización, y colapsa entero —no por celdas—.
          Va en el FLUJO y no en el encabezado a propósito: identifica al pagador de este
          documento, no la hoja, así que no tiene por qué repetirse en una continuación.
        */}
        {aseguradora === undefined ? null : (
          <View style={estilos.bloqueAseguradora}>
            <MarcoParcial
              ancho={MARCO.aseguradora.ancho}
              padding={MARCO.aseguradora.padding}
              acento={props.acento}
            >
              <Text style={estilos.rotuloAseguradora}>
                {ASEGURADORA.bloque.toUpperCase()}
              </Text>
              <View style={estilos.filaAseguradora}>
                {/* El nombre no lleva rótulo: lo rotula el bloque entero. */}
                <View style={estilos.celdaNombre}>
                  <Text style={estilos.nombreAseguradora}>{aseguradora.nombre}</Text>
                </View>
                {tieneValor(aseguradora.poliza) ? (
                  <View style={estilos.celdaPoliza}>
                    <Text style={estilos.rotuloCelda}>
                      {ASEGURADORA.poliza.toUpperCase()}
                    </Text>
                    <Text style={estilos.valorCelda}>{aseguradora.poliza}</Text>
                  </View>
                ) : null}
                {tieneValor(aseguradora.cobertura) ? (
                  <View style={estilos.celdaCobertura}>
                    <Text style={estilos.rotuloCelda}>
                      {ASEGURADORA.cobertura.toUpperCase()}
                    </Text>
                    <Text style={estilos.valorCelda}>{aseguradora.cobertura}</Text>
                  </View>
                ) : null}
              </View>
            </MarcoParcial>
          </View>
        )}

        {/*
          LA CABECERA DE LA TABLA, EN EL FLUJO Y NO EN EL ENCABEZADO DE HOJA.

          ⚠ **ESO SIGNIFICA QUE NO SE REPITE EN UNA HOJA DE CONTINUACIÓN**, y es
          deliberado: la hoja 2 de esta lámina no lleva ninguna fila —solo la forma de
          pago y la firma—, así que una cabecera repetida sería la cabecera HUÉRFANA de
          §8.2, un rótulo de columnas sobre nada. El precio de componerla aquí es el
          contrario: un recibo lo bastante largo como para partir la TABLA dejaría sus
          filas de la hoja 2 sin rótulos de columna. Reportado.
        */}
        <View style={[estilos.cabecera, { borderBottomColor: props.acento.base }]}>
          <Text style={[estilos.rotuloColumna, estilos.columnaNumero]}>
            {CABECERA.numero}
          </Text>
          <Text style={[estilos.rotuloColumna, estilos.columnaConcepto]}>
            {CABECERA.concepto.toUpperCase()}
          </Text>
          {!cotizacion ? null : (
            <Text style={[estilos.rotuloColumna, estilos.columnaOrigen]}>
              {CABECERA.origen.toUpperCase()}
            </Text>
          )}
          <Text style={[estilos.rotuloColumna, estilos.columnaPrecio]}>
            {CABECERA.precio.toUpperCase()}
          </Text>
        </View>

        {props.conceptos.map((linea, indice) => (
          <FilaConcepto
            // El índice ES la identidad: dos renglones pueden cobrar el mismo concepto
            // a distinto precio y lo único que los distingue es su orden.
            key={indice}
            linea={linea}
            indice={indice}
            conOrigen={cotizacion}
          />
        ))}
      </MotorFlujo>

      {/*
        Variante `completo`: folio · paginación · leyenda. Es uno de los tres formatos
        que la llevan (2.M), y con razón: aquí la ventanilla es la aseguradora, que cita
        el número por oficio. Los prefijos `Q-` y `R-` los pone quien genera el folio.
      */}
      <PieDocumento variante="completo" folio={props.folio} acento={props.acento} />
    </Page>
  )
}
