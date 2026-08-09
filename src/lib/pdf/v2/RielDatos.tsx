/**
 * Sistema de documentos v2 — componente 2.F · `RielDatos`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.F. Transcripción, no diseño.
 *
 * Propósito: presentar varios datos cortos en una banda horizontal, cada uno con
 * su etiqueta.
 *
 * DE DÓNDE SALE ESTE ARCHIVO
 *
 * La composición de aquí se escribió por primera vez dentro de 2.D, cuando el
 * riel del paciente hizo falta antes de que 2.F existiera, con la nota de que al
 * llegar 2.F se sustituiría y no se duplicaría (I.3.5). Esto es esa sustitución:
 * `BloquePaciente` ya no compone celdas, declara las suyas y las entrega.
 *
 * LA RETÍCULA ES `riel.celda`, NO `reticula.columna`
 *
 * I.1.3 declara dos retículas conviviendo sobre la misma caja de 486 pt. Los
 * bloques de texto se separan con aire —el medianil de 9 pt sobre columnas de
 * 32.25— y las celdas del riel se separan con una REGLA VERTICAL más padding, así
 * que su partición es de doce partes iguales SIN medianil: `riel.celda` = 40.5 pt.
 * Donde hay regla no hace falta medianil. La ficha de 2.F pedía
 * `reticula.columna` «más sus medianiles» hasta que el barrido de listas de
 * tokens la corrigió (anexo A, P2-11); si vuelves a leer eso en algún sitio, es
 * spec viejo.
 *
 * QUÉ NO ES ESTE COMPONENTE
 *
 * a. NO compone el par rótulo + valor delegando en `Campo` (2.E). Ver la nota
 *    larga sobre `tieneValor` más abajo: la decisión de colapsar tiene que vivir
 *    donde vive la geometría que colapsa. Lo que sí se comparte con 2.E, y una
 *    sola vez en el sistema, es la regla de qué cuenta como dato ausente.
 * b. NO compone la línea fina del membrete. La tabla de variantes de 2.F la
 *    reclamaba como consumidora de `una línea` y no lo es: no tiene rótulos, sus
 *    anchos no salen de `riel.celda` y su texto va en `medico.credencial`. Queda
 *    declarada en 2.B, que es donde estaba su geometría.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { tieneValor } from './Campo'
import {
  CAJA,
  FILETE,
  FILETE_HONORARIOS,
  FILETE_INTERNAMIENTO,
  RETICULA,
  RIEL_CELDA,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type Lamina,
  type Peso,
} from './tokens'

/**
 * Geometría interna del riel, de la ficha de 2.F. I.1.7 declara que la geometría
 * interna vive en la ficha del componente y no en la escala de espaciado, aunque
 * no sea múltiplo de 4 — y `3 10 4` no lo es.
 *
 * ⚠ **EL PADDING VERTICAL DE A.8 ERA 8 / 10 Y LA CELDA MEDÍA 45 pt. Son 30.**
 *
 * La lámina de Laboratorio compone la celda del riel de identificación en 30 pt
 * exactos, y su desglose no deja margen de interpretación:
 *
 *     3  padding superior
 *     10 interlineado del rótulo   `etiqueta`
 *     13 interlineado del valor    `dato`
 *     4  padding inferior
 *     ── 30
 *
 * Las cuatro celdas de la fila 1 miden 30; las tres de la fila 2 miden 30.5, porque
 * arrastran la regla de 0.5 pt que las separa de la fila de arriba. Con los dos
 * filetes del riel, el bloque entero mide 62.1 pt donde antes medía 92.1.
 *
 * El padding lateral de 10 pt no cambia — la corrección es vertical.
 */
const GEOMETRIA = {
  /** Padding de celda `3 10 4`: superior 3, laterales 10, inferior 4. */
  padding: { superior: 3, lateral: 10, inferior: 4 },
  /**
   * LA CELDA DEL CATÁLOGO — `padding: 4 10 5 10`, y **0 a la izquierda en la primera de
   * cada fila**. Es la única celda del sistema con padding vertical propio: 4 y 5 donde el
   * riel de identificación pone 3 y 4.
   *
   * El cero de la primera es el mismo criterio que el de la celda de peso en 2.D: el
   * primer requerimiento de cada renglón arranca pegado al margen de la caja, no a 10 pt.
   * Aquí además cierra la retícula — con 10 a la izquierda, las tres columnas de 162 no
   * empezarían donde empieza la caja.
   *
   * ⚠ **LA CELDA MIDE 23 Y LA LÁMINA 23.48.** Con el cuerpo en `requerimiento.texto`
   * —10.5 / 14— la suma es 4 + 14 + 5 = 23, y los **0.48 pt** que faltan son el residuo de
   * caja de línea que esta lámina deja en todo lo demás: el HTML añade el *strut* de la
   * fuente donde Yoga no. Es el mismo signo y el mismo orden que el 0.47 de las filas de
   * Suplementación y el 0.56 de las de Receta. Reportado.
   */
  catalogo: { superior: 4, derecha: 10, inferior: 5, izquierda: 10 },
} as const

/**
 * LOS DOS TRAZOS DEL RIEL, uno por lámina. Ver `Lamina` en la capa de tokens.
 *
 * La lámina de Imagenología cierra su riel con **0.75 pt** y separa sus dos filas
 * con **0.375**: son 1 px y 0.5 px, que es lo que dibuja un HTML a 96 dpi. Con
 * ellos el riel entero mide 63.87 —0.75 + 30 + 32.375 + 0.75—, que es exactamente
 * lo que la medición da entre 209 y 272.87.
 *
 * El chasis los declara en `filete.fino` y `filete.regla`, 0.8 y 0.5, leídos de
 * A.7. **La diferencia se compone, no se unifica:** si el 0.75 fuera el valor real
 * del sistema, `filete.fino` estaría mal en los ocho formatos y eso movería
 * Laboratorio, que ya está conciliado. Reportado.
 *
 * **LA LÁMINA DE RECETA MIDE LO MISMO, Y ESO CAMBIA EL PESO DEL AVISO.** Su riel abre
 * en 204 y cierra en 267.88: son los mismos 63.88 —0.75 + 30 + 32.38 + 0.75— hasta
 * la centésima. Dos láminas de tres miden 0.75 y 0.375 donde el chasis pone 0.8 y
 * 0.5, así que lo que arriba se declaraba «diferencia de una lámina» es ya la
 * mayoría. Sigue sin unificarse aquí por la misma razón: unificar mueve Laboratorio,
 * que está conciliado, y esa es una decisión de producto. Reportado.
 *
 * **Y LA DE SUPLEMENTACIÓN ES LA TERCERA, CON LAS MISMAS DOS CIFRAS.** Su riel mide
 * los mismos 0.75 y 0.375, así que el aviso pasa de dos contra uno a **tres contra
 * uno**: solo Laboratorio compone 0.8 y 0.5. Sigue sin unificarse aquí, y ya no por
 * falta de votos sino porque es una decisión de producto. Reportado.
 *
 * **Y LA DE HONORARIOS ES LA CUARTA, CON UNA CIFRA PROPIA Y UNA QUE NO EXISTE.** Su
 * riel abre en 219.85 y cierra en 250.8: con la celda base en 30, los 0.95 pt que
 * sobran son sus dos filetes a **0.475**, que es del mismo orden que el 0.47 con el que
 * esa misma lámina dibuja la línea de firma. Su regla interior **no está medida y no
 * puede estarlo**: el riel de este formato es de una sola fila, así que no hay ninguna
 * regla horizontal que dibujar. Se declara la de las tres láminas anteriores para no
 * dejar el miembro sin valor, y no la lee nadie.
 *
 * **Y LA DE INTERNAMIENTO ES LA QUINTA, Y NO DECLARA NINGUNA DE LAS DOS.** Esa lámina da
 * las dos cotas de su riel —abre en 218.19 y cierra en 279.61— y sus dos filas de celda
 * base son 30 y 30, así que lo que queda para los dos filetes y la regla interior son
 * **1.42 pt**. Con los 0.475 de Honorarios y los 0.375 de las otras tres el riel compone
 * **61.325** contra los 61.42 medidos: **0.095 pt de sobra**, el residuo más pequeño del
 * sistema y de la misma clase que el 0.27 de la firma de Suplementación o el 0.365 de su
 * encabezado. Se reutilizan los dos valores en vez de inventar una pareja que cuadre la
 * resta: `DERIVADO, NO MEDIDO`. Reportado.
 */
const TRAZO = {
  chasis: { filete: FILETE.fino, regla: FILETE.regla },
  imagenologia: { filete: 0.75, regla: 0.375 },
  receta: { filete: 0.75, regla: 0.375 },
  suplementacion: { filete: 0.75, regla: 0.375 },
  honorarios: { filete: FILETE_HONORARIOS.riel, regla: 0.375 },
  internamiento: { filete: FILETE_HONORARIOS.riel, regla: 0.375 },
} as const satisfies Record<Lamina, { filete: number; regla: number }>

/** Lo que una desviación puede mover de un rol: solo su cuerpo y su interlineado. */
interface DesviacionRol {
  /** En pt. Ausente cuando la desviación no mueve el cuerpo. */
  readonly cuerpo?: number
  /** En pt, como lo declara el diseño. La conversión a multiplicador va abajo. */
  readonly interlineado: number
}

/**
 * LAS DOS DESVIACIONES DE ROL DEL RIEL, Y POR QUÉ VIVEN AQUÍ Y NO EN LA ESCALA.
 *
 * El rótulo de celda va en `etiqueta` con interlineado **10** en vez de 11, y el
 * valor en `dato` con cuerpo **11.5** e interlineado **13** en vez de 12 / 16. Es lo
 * que hace que la celda mida los 30 pt de la lámina.
 *
 * Una generación anterior bajó los dos valores a I.1.4 y arrastró cinco elementos
 * que la lámina mide en 7 / 11 —cabecera de tabla (2.G), etiqueta de folio (2.C),
 * bloque en negativo (2.H), encabezado de 2.J y rótulo de campo (2.E)—, porque
 * `etiqueta` es el rol de TODA versalita de rótulo del sistema. **La escala no se
 * toca por un componente:** los 7 / 10 y los 11.5 / 13 son del riel.
 *
 * Es el mismo patrón de desviación declarada que 2.D ya usa para el valor de la
 * celda de diagnóstico: se declara entera en la ficha del componente, con su motivo,
 * y no sube a I.1.4 mientras tenga un solo consumidor. Si un segundo componente
 * pidiera estos valores, entonces sí serían roles y subirían con nombre propio.
 *
 * Solo se declara lo que SE DESVÍA. Familia, peso, tracking y color siguen saliendo
 * del rol por `estiloTipografico()`, que es la única puerta a la escala.
 *
 * `satisfies` y no `as const`: son MEDIDAS, no discriminantes. Congeladas al tipo
 * literal, el estilo de la celda se lleva un `fontSize: 11.5` literal y `2.D` deja
 * de poder construir encima su excepción de diagnóstico, que va a 11.
 */
const DESVIACION = {
  rotulo: { interlineado: 10 },
  valor: { cuerpo: 11.5, interlineado: 13 },
} satisfies Record<'rotulo' | 'valor', DesviacionRol>

/**
 * EL PESO DEL VALOR DE CELDA EN LA LÁMINA DE RECETA — **500, no 400**.
 *
 * Esa lámina declara UN SOLO tratamiento para el valor de celda: Archivo 11.5 / 13
 * en peso **500**, `tinta.negra`. El chasis compone 400 —el del rol `dato`— y sube
 * a 500 una sola celda, el nombre del paciente, que 2.D declara como «el único
 * destaque del riel» (`GEOMETRIA.pesoAncla`).
 *
 * ⚠ **CONSECUENCIA VISIBLE, Y QUEDA REPORTADA: en este formato el destaque de 2.D
 * desaparece.** Con las siete celdas a 500, el nombre del paciente ya no pesa más
 * que la edad ni que el expediente. No es que 2.D deje de aplicarse: es que su
 * excepción y el valor por defecto de esta lámina coinciden, así que no hay nada
 * que añadir encima. Si al mirar el impreso resulta que el nombre SÍ destacaba en
 * la lámina, entonces lo medido es la celda del nombre y no la celda genérica, y la
 * corrección es volver este 500 a 400 — no tocar 2.D.
 *
 * Vive aquí y no en 2.D por lo mismo que las dos desviaciones de arriba: es el valor
 * por DEFECTO de toda celda de este riel, no la excepción de una celda concreta.
 */
const PESO_VALOR_RECETA: Peso = 500

const estilos = StyleSheet.create({
  /**
   * El riel abre y cierra con `filete.fino` en `tinta.negra`. Los dos filetes son
   * del riel entero, no de sus filas: por eso van aquí y no en `fila`.
   */
  riel: {
    width: CAJA.ancho,
    borderTopColor: TINTA.negra,
    borderBottomColor: TINTA.negra,
  },
  fila: {
    flexDirection: 'row',
    // Por defecto, y a propósito: las celdas se estiran al alto de la más alta
    // para que las reglas verticales lleguen de arriba abajo de la fila.
    alignItems: 'stretch',
  },
  /** Regla superior de toda fila que no sea la primera VIVA. */
  filaSiguiente: {
    borderTopColor: TINTA.hairline,
  },
  /**
   * ANCHO NOMINAL POR `width`, REDISTRIBUCIÓN POR `flexGrow`. Los dos juntos, y
   * en ese orden, son lo que cumple las dos exigencias a la vez:
   *
   * - `width: columnas × riel.celda` da el ancho declarado (regla 1). Con todas
   *   las celdas presentes los anchos suman la caja, no sobra espacio y cada
   *   celda mide exactamente sus columnas de riel.
   * - `flexGrow: columnas` solo entra en juego cuando una celda COLAPSA: entonces
   *   sobra espacio y las restantes se lo reparten en la misma proporción, hasta
   *   ocupar el riel completo (regla 3). Un riel con un agujero delata que
   *   faltaba un dato, que es justo lo que el colapso evita.
   *
   * NO LO SUSTITUYAS POR `flexBasis: 0`. Es la forma «obvia» de repartir en
   * proporción y da mal el caso nominal: en este renderer el flex-basis es de
   * CAJA DE CONTENIDO, así que el padding y la regla se suman por fuera del
   * reparto y las celdas salen más estrechas de lo declarado. Está en I.3.8 con
   * su síntoma y su medida.
   */
  celda: {
    paddingTop: GEOMETRIA.padding.superior,
    paddingBottom: GEOMETRIA.padding.inferior,
    paddingLeft: GEOMETRIA.padding.lateral,
    paddingRight: GEOMETRIA.padding.lateral,
  },
  /** Regla izquierda salvo en la primera celda de cada fila. */
  celdaConRegla: {
    borderLeftColor: TINTA.hairline,
  },
  /**
   * EL RENGLÓN DE RÓTULOS, cuando la celda lleva dos. Con uno solo el `Text` va suelto
   * y esta fila no se monta: un contenedor de más por celda, en un riel de siete, es
   * árbol que nadie necesita.
   *
   * `alignItems: 'flex-end'` apoya las dos cajas de línea por su borde INFERIOR, que
   * es lo único que se puede alinear aquí: react-pdf no le da a Yoga una función de
   * línea base (ver la nota larga de `cajaFecha` en 2.C). Con los dos rótulos al mismo
   * interlineado —10 pt en la celda de peso— el borde inferior y la base coinciden y
   * la distinción no llega a existir.
   *
   * El medianil es `reticula.medianil`, que es el separador de columnas del sistema:
   * la lámina no lo mide, y es el mismo criterio con que 2.C separa el título de la
   * fecha y 2.G la marca del ancla en vez de inventar una cifra.
   */
  filaRotulos: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rotuloSecundario: {
    marginLeft: RETICULA.medianil,
  },
  /**
   * Versalita: mayúsculas con tracking, no versalitas reales de la fuente
   * (I.1.4). La transformación a mayúsculas ocurre en el render.
   *
   * Con la desviación de interlineado del riel encima del rol. El cuerpo no se
   * desvía, así que el `letterSpacing` que trae `estiloTipografico()` sigue siendo
   * el bueno y NO hay que recalcularlo.
   */
  etiqueta: {
    ...estiloTipografico('etiqueta'),
    lineHeight: DESVIACION.rotulo.interlineado / TIPOGRAFIA.etiqueta.cuerpo,
  },
  /**
   * El valor por defecto de toda celda del riel, con la desviación de cuerpo e
   * interlineado encima del rol `dato`.
   *
   * Este es el segundo sitio de v2 donde se divide por el cuerpo a mano, y por el
   * mismo motivo que el primero (la celda de diagnóstico de 2.D):
   * `estiloTipografico()` es la puerta a la ESCALA, y una desviación declarada no
   * está en la escala. El `letterSpacing` no se recalcula porque el tracking de
   * `dato` es 0: cambiar el cuerpo no lo mueve.
   */
  valor: {
    ...estiloTipografico('dato'),
    fontSize: DESVIACION.valor.cuerpo,
    lineHeight: DESVIACION.valor.interlineado / DESVIACION.valor.cuerpo,
  },
  /**
   * LA LÍNEA DE ESCRITURA DE UNA CELDA — el estado «vacío requerido» de 2.E, dentro
   * del riel.
   *
   * ⚠ **NO LA COMPONE 2.E Y NO PUEDE COMPONERLA**, aunque sea su estado y aunque su
   * regla 1 sea la que manda aquí —rótulo y línea, sin leyenda de error—. Aquel
   * componente monta su propio rótulo en `etiqueta` sin la desviación del riel y su
   * línea mide `manuscrito.ancho` × `manuscrito.alto` (246 × 20), que es más ancha que
   * varias celdas y más alta que la celda entera. Lo que se comparte con 2.E es lo que
   * ya se compartía: la REGLA de qué cuenta como dato ausente (`tieneValor`), y ahora
   * también la de qué se imprime cuando falta.
   *
   * El alto y el grosor los declara el CONSUMIDOR, como la excepción de valor: 2.F no
   * sabe qué celda de qué formato se llena a pluma. Hoy solo una — la del paciente en
   * el recibo mínimo, 16.47 × 0.63 —, y con ella la celda pasa de 30 a **33.47** pt.
   *
   * ⚠ **`D27` SE COMPONE Y NO SE RESUELVE.** `manuscrito.alto` son 20 pt medidos
   * contra el pautado de un cuaderno (I.1.5) y esta lámina dibuja 16.47; ya había un
   * tercer valor de 16 en el espécimen y uno de 11 en Receta. Se compone el de la
   * lámina y queda reportado.
   */
  escritura: {
    borderBottomColor: TINTA.negra,
  },
  /**
   * EL RIEL DEL CATÁLOGO. Abre y cierra con el hairline de su lámina en `tinta.negra`,
   * como el de identificación, y no comparte con él ni el grosor ni el padding.
   */
  catalogo: {
    width: CAJA.ancho,
    borderTopColor: TINTA.negra,
    borderBottomColor: TINTA.negra,
    borderTopWidth: FILETE_INTERNAMIENTO.regla,
    borderBottomWidth: FILETE_INTERNAMIENTO.regla,
  },
  /**
   * LA REGLA ENTRE FILAS DEL CATÁLOGO — `filete.regla` en `tinta.reglaFila`, que es el
   * tono con el que I.1.8 separa las filas de una tabla larga.
   *
   * ⚠ **EL PASO 4.6 NO LA ENUMERA Y B.6 §5 SÍ LA MIDE** —«Regla entre filas 0.5 pt
   * `#EDEAE4`»—. Se compone la medida: un catálogo de tres columnas que envuelve a tres
   * renglones sin ninguna separación horizontal se lee como una sola tirada. Reportado.
   */
  filaCatalogo: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  filaCatalogoSiguiente: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.reglaFila,
  },
  celdaCatalogo: {
    paddingTop: GEOMETRIA.catalogo.superior,
    paddingBottom: GEOMETRIA.catalogo.inferior,
    paddingRight: GEOMETRIA.catalogo.derecha,
  },
  /** La regla vertical del catálogo: su propio hairline, nunca el del riel. */
  celdaCatalogoConRegla: {
    borderLeftWidth: FILETE_INTERNAMIENTO.regla,
    borderLeftColor: TINTA.hairline,
  },
  requerimiento: { ...estiloTipografico('requerimiento.texto') },
  /** El mismo valor un peso por encima. Ver `PESO_VALOR_RECETA`. */
  valorReceta: {
    ...estiloTipografico('dato'),
    fontSize: DESVIACION.valor.cuerpo,
    lineHeight: DESVIACION.valor.interlineado / DESVIACION.valor.cuerpo,
    fontWeight: PESO_VALOR_RECETA,
  },
})

/**
 * Estilo del valor de una celda.
 *
 * El tipo sale de `estilos.valor` y NO de una interfaz declarada: el tipo `Style`
 * de react-pdf lleva un índice de media queries, y TypeScript se lo presta a un
 * tipo de objeto inferido pero nunca a una interfaz. Mismo motivo que en 2.B y en
 * 2.D.
 */
export type EstiloValorCelda = typeof estilos.valor

/**
 * El valor de celda ya desviado, para que un consumidor pueda construir SU
 * excepción encima en vez de partir del rol `dato` crudo.
 *
 * Existe por un defecto concreto: el nombre del paciente es «`dato`, peso 500»
 * (2.D) y se componía esparciendo `estiloTipografico('dato')`, así que se quedaba
 * en 12 / 16 y estiraba la fila del riel mientras las demás celdas iban a
 * 11.5 / 13. Una desviación declarada solo sirve si TODO el riel parte de ella.
 */
export const VALOR_CELDA: EstiloValorCelda = estilos.valor

/** Estilo del rótulo de una celda. Mismo motivo de tipos que `EstiloValorCelda`. */
export type EstiloEtiquetaCelda = typeof estilos.etiqueta

/**
 * El rótulo de celda YA DESVIADO —`etiqueta` a interlineado 10—, para que un consumidor
 * construya SU excepción encima en vez de partir del rol crudo. Es la misma puerta que
 * `VALOR_CELDA` y existe por el mismo defecto: partiendo del rol, el rótulo volvería a
 * los 11 pt de interlineado y estiraría la celda.
 */
export const ETIQUETA_CELDA: EstiloEtiquetaCelda = estilos.etiqueta

/**
 * El valor por defecto de cada lámina. Lo consulta 2.D para saber si su excepción
 * de peso —el nombre del paciente— añade algo o ya está puesta.
 */
export function valorDeCelda(lamina: Lamina): EstiloValorCelda {
  return lamina === 'receta' ? estilos.valorReceta : estilos.valor
}

export interface CeldaRiel {
  /** Identidad estable de la celda dentro del riel. */
  readonly clave: string
  /** Se compone en versalita aquí: no la pases ya en mayúsculas. */
  readonly etiqueta: string
  /** Ausente o vacío es lo mismo: la celda colapsa y las demás redistribuyen. */
  readonly valor?: string
  /** Columnas de `riel.celda`. Entero, nunca un ancho arbitrario (regla 1). */
  readonly columnas: number
  /**
   * SEGUNDO RÓTULO, EN EL MISMO RENGLÓN QUE EL PRIMERO Y A SU DERECHA.
   *
   * Una sola celda del sistema lo lleva hoy: la de peso de 2.D, que rotula `PESO` y
   * califica `BASE DEL CÁLCULO`. Colapsa con la celda, como todo lo suyo.
   *
   * ⚠ **VA EN EL RENGLÓN DEL RÓTULO Y NO EN UNO PROPIO, Y ESO ES UNA LECTURA DE LA
   * LÁMINA, NO UN CAPRICHO DE MAQUETACIÓN.** El archivo enumera *tres* textos en esa
   * celda y a la vez la mide en **33.71 pt**, y las dos cosas no caben juntas: apilados
   * son 3 + 10 + 10 + 16 + 4 = 43. Con los dos rótulos compartiendo renglón son
   * **33** —3 + 10 + 16 + 4— y el residuo de 0.71 es el de la caja de línea del HTML,
   * el mismo que en Receta valía 0.56. La otra medida de la lámina lo confirma por su
   * cuenta: **su encabezado de 232.51 pt solo cuadra con 33**, y con 43 se pasa diez.
   * Dos cotas medidas contra una frase. Reportado.
   *
   * El estilo lo entrega el CONSUMIDOR, como la excepción de valor: 2.F no sabe qué
   * es una base de cálculo ni con qué se compone.
   */
  readonly etiquetaSecundaria?: {
    readonly texto: string
    readonly estilo: EstiloValorCelda
  }
  /**
   * REGLA IZQUIERDA PROPIA, cuando la celda no se separa de su vecina con el hairline
   * del riel. Hoy solo el borde de acento de 1.9 pt que la lámina de Suplementación
   * dibuja entre la celda de peso y la de diagnóstico.
   *
   * ⚠ **LA LÁMINA LO DECLARA COMO BORDE *DERECHO* DE LA CELDA DE PESO Y AQUÍ ES EL
   * *IZQUIERDO* DE LA SIGUIENTE.** Es la misma línea en el mismo sitio —una celda
   * acaba donde empieza la otra— y el riel compone TODAS sus reglas verticales como
   * borde izquierdo de la celda que sigue (ver `celdaConRegla`). Ponerlo del otro lado
   * dibujaría dos: la de acento y el hairline que la vecina trae por defecto.
   *
   * Sin ella, el hairline del riel. Y en la primera celda viva de la fila no se dibuja
   * ninguna de las dos, que es lo que hace que el colapso de la celda de peso no deje
   * un filete de acento colgando en el margen.
   */
  readonly reglaIzquierda?: {
    readonly grosor: number
    readonly color: string
  }
  /**
   * Padding izquierdo propio, en pt. Sin él, los 10 de `GEOMETRIA.padding.lateral`.
   *
   * Existe por un solo dato medido: la celda de peso compone `padding: 3 10 4 0`, con
   * el lado izquierdo a CERO, así que su rótulo y su cifra arrancan pegados al margen
   * de la caja en vez de a 10 pt como las de la fila de arriba. Es de la lámina y se
   * compone tal cual.
   */
  readonly paddingIzquierdo?: number
  /**
   * FONDO DE LA CELDA. Hoy uno solo en todo el sistema: la celda de vigencia de II.5,
   * que la lámina rellena con el acento al 8 % (`veloDeAcento` en la capa de tokens).
   *
   * ⚠ **ES EL ÚNICO FONDO DE CELDA DE LOS CINCO FORMATOS EXTRAÍDOS Y QUEDA REPORTADO**
   * (`D25`). Se compone porque el color **no es el único portador de significado**
   * (I.3.3): esa celda se distingue además por el peso de su cifra y por la tinta de su
   * rótulo, así que sobrevive a la fotocopia. Quien quite cualquiera de los dos deja el
   * color solo y rompe la regla.
   *
   * Entra como hex ya resuelto y no como proporción: 2.F no deriva colores.
   */
  readonly fondo?: string
  /**
   * Excepción tipográfica del RÓTULO, con la misma forma que la del valor. Hoy una
   * sola: el rótulo `Vigencia`, que la lámina compone en `tinta.secundaria` y no en el
   * `tinta.etiqueta` de todas las demás etiquetas del sistema.
   *
   * Es media distinción de las dos que salvan el fondo de la regla 3 de I.3.3, así que
   * **no es cosmética**: quitarla deja la vigencia distinguida solo por color.
   */
  readonly estiloEtiqueta?: EstiloEtiquetaCelda
  /**
   * LÍNEA DE ESCRITURA cuando la celda no trae valor: el estado «vacío requerido» de
   * 2.E. **Con ella la celda NO colapsa** — conserva su rótulo y deja el hueco donde se
   * escribe a pluma.
   *
   * Sin ella, una celda sin dato desaparece y las demás redistribuyen, que es lo que
   * hacen las siete celdas de los cuatro formatos anteriores. Ver `escritura` en la
   * hoja de estilos.
   */
  readonly escritura?: {
    /** Alto del espacio de escritura, en pt. La lámina de II.5 mide 16.47. */
    readonly alto: number
    /** Grosor de la línea. La lámina de II.5 mide 0.63. */
    readonly grosor: number
  }
  /**
   * Excepción tipográfica del valor, cuando el consumidor declara una en su
   * propia ficha. Sin ella, el valor va en el rol `dato`, que es el caso normal.
   *
   * Entra por aquí y no como una variante de este componente porque la excepción
   * la declara la ficha del CONSUMIDOR —el diagnóstico y el nombre del paciente
   * son geometría de 2.D— y `RielDatos` no tiene por qué conocerlas. Lo que este
   * componente declara es que existe una ranura para ellas.
   */
  readonly estiloValor?: EstiloValorCelda
}

/**
 * `sin contador` — LA PROPIEDAD ORTOGONAL DE LA FICHA, QUE NO COMPONE NADA.
 *
 * No es una tercera variante: un riel puede ser `celdas` **y** `sin contador` a
 * la vez. Declara que el riel no participa del conteo de `ContadorLista` (2.K
 * regla 3), porque el catálogo que presenta es abierto —el médico agrega y quita
 * requerimientos especiales de Internamiento— y «3 de 7» sería una cifra falsa.
 *
 * **No cambia nada del render**, y por eso no se leerá en este archivo: aquí no
 * hay ningún `if` que la consulte y no debe haberlo.
 *
 * QUIÉN LA LEE, YA CON 2.K CONSTRUIDO. No 2.K: ese componente recibe cifras ya
 * contadas —`enEstaHoja` y `total`— y no ve los rieles de la hoja, así que no
 * puede consultar esta prop ni aunque quisiera. La lee **el sitio que compone el
 * documento**, que es quien tiene delante los dos: el riel y el contador. Es la
 * misma forma que tomó el consultorio activo en P2-3 —la lectura vive en el sitio
 * que construye el documento, no dentro del componente que imprime—. Queda
 * registrado en el anexo A (P2-18).
 */
interface SinContador {
  readonly sinContador?: boolean
}

/** Qué lámina fija los dos grosores del riel. Sin ella, la del chasis. */
interface ConLamina {
  readonly lamina?: Lamina
}

export type RielDatosProps =
  /** Varias filas de celdas. El número de celdas por fila lo declara el formato. */
  | ({ variante: 'celdas'; filas: readonly (readonly CeldaRiel[])[] } & SinContador &
      ConLamina)
  /** Riel comprimido de una sola fila. Hoy: `BloquePaciente` reducido. */
  | ({ variante: 'unaLinea'; celdas: readonly CeldaRiel[] } & SinContador & ConLamina)
  /**
   * CATÁLOGO ABIERTO: una retícula de celdas SIN RÓTULO, que envuelve a tantas filas como
   * haga falta. Hoy la usa un formato y un bloque: los requerimientos especiales de II.6.
   *
   * **No es la variante `celdas` con la etiqueta vacía.** Aquella compone un par rótulo +
   * valor por celda —es su anatomía entera, y de ahí salen sus 30 pt— y aquí no hay
   * rótulos que poner: lo que se enumera es el catálogo mismo. Con una etiqueta en blanco
   * la celda seguiría midiendo los 10 pt del renglón del rótulo y el riel saldría al doble
   * de alto, con un hueco gris encima de cada requerimiento.
   *
   * **Y no participa del contador** (`sinContador`, 2.K regla 3): el médico agrega y quita
   * requerimientos, así que «3 de 7» sería una cifra falsa. Ver `SinContador`.
   */
  | ({
      variante: 'catalogo'
      readonly items: readonly string[]
      /**
       * Columnas de la retícula. Divide a `reticula.columnas`, no es un ancho: con 3, cada
       * celda mide 4 × `riel.celda` = 162 pt y las tres cierran la caja.
       */
      readonly columnas: number
    } & SinContador &
      ConLamina)

/**
 * Una fila del riel, con sus celdas YA filtradas por el componente: aquí no llega
 * ninguna celda muerta. `primera` marca la que no lleva regla horizontal encima.
 */
function Fila({
  celdas,
  primera,
  regla,
  valor,
}: {
  celdas: readonly CeldaRiel[]
  primera: boolean
  /** Grosor de las reglas de esta lámina: la de arriba y las verticales. */
  regla: number
  /** Estilo del valor de celda de esta lámina, cuando la celda no trae excepción. */
  valor: EstiloValorCelda
}): ReactElement {
  return (
    <View
      style={[
        estilos.fila,
        primera ? {} : { ...estilos.filaSiguiente, borderTopWidth: regla },
      ]}
    >
      {celdas.map((celda, indice) => (
        <View
          key={celda.clave}
          style={[
            estilos.celda,
            {
              width: celda.columnas * RIEL_CELDA,
              flexGrow: celda.columnas,
              paddingLeft: celda.paddingIzquierdo ?? GEOMETRIA.padding.lateral,
            },
            celda.fondo === undefined ? {} : { backgroundColor: celda.fondo },
            /*
              LA REGLA VERTICAL, Y NUNCA EN LA PRIMERA CELDA VIVA. Las celdas llegan
              aquí ya filtradas, así que `indice === 0` es la primera que SOBREVIVE al
              colapso: cuando la celda de peso se va, la de diagnóstico pasa a ser la
              primera y su regla de acento se va con ella, en vez de quedar dibujada
              contra el margen.
            */
            indice === 0
              ? {}
              : celda.reglaIzquierda === undefined
                ? { ...estilos.celdaConRegla, borderLeftWidth: regla }
                : {
                    borderLeftWidth: celda.reglaIzquierda.grosor,
                    borderLeftColor: celda.reglaIzquierda.color,
                  },
          ]}
        >
          {celda.etiquetaSecundaria === undefined ? (
            <Text style={[estilos.etiqueta, celda.estiloEtiqueta ?? {}]}>
              {celda.etiqueta.toUpperCase()}
            </Text>
          ) : (
            <View style={estilos.filaRotulos}>
              <Text style={[estilos.etiqueta, celda.estiloEtiqueta ?? {}]}>
                {celda.etiqueta.toUpperCase()}
              </Text>
              <Text
                style={[celda.etiquetaSecundaria.estilo, estilos.rotuloSecundario]}
              >
                {celda.etiquetaSecundaria.texto.toUpperCase()}
              </Text>
            </View>
          )}
          {/*
            LOS DOS ESTADOS CON TINTA DE 2.E, DENTRO DE LA CELDA. Con dato, el valor;
            sin dato y con espacio de escritura declarado, la línea. El tercer estado
            —vacío opcional— no llega hasta aquí: la celda se filtró antes de montarse.
          */}
          {tieneValor(celda.valor) || celda.escritura === undefined ? (
            <Text style={celda.estiloValor ?? valor}>{celda.valor}</Text>
          ) : (
            <View
              style={[
                estilos.escritura,
                {
                  height: celda.escritura.alto,
                  borderBottomWidth: celda.escritura.grosor,
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  )
}

/**
 * Parte el catálogo en filas de `columnas`. Es la única variante que reparte por su
 * cuenta: en las otras dos, cuántas celdas van en cada fila lo declara el consumidor.
 */
function enFilas(items: readonly string[], columnas: number): readonly (readonly string[])[] {
  const filas: string[][] = []
  items.forEach((item, indice) => {
    if (indice % columnas === 0) filas.push([item])
    else filas[filas.length - 1].push(item)
  })
  return filas
}

/**
 * El riel del catálogo. Sin rótulos, sin colapso de celda y sin redistribución: **una
 * celda vacía no existe** —el catálogo son los ítems que hay— y la última fila puede
 * quedar corta, que es lo que hace una retícula que envuelve.
 */
function Catalogo({
  items,
  columnas,
}: {
  items: readonly string[]
  columnas: number
}): ReactElement {
  /*
    EL ANCHO SALE DE LA RETÍCULA DEL RIEL Y NO DE UNA DIVISIÓN DE LA CAJA. Con 3
    columnas son 4 × `riel.celda` = 162 pt, que es lo que mide la lámina. Escribir
    `CAJA.ancho / columnas` daría lo mismo hoy y dejaría de estar atado a la retícula el
    día que alguien pida 4 o 6 columnas.
  */
  const ancho = (RETICULA.columnas / columnas) * RIEL_CELDA

  return (
    <View style={estilos.catalogo}>
      {enFilas(items, columnas).map((fila, indiceFila) => (
        <View
          key={fila[0]}
          style={[
            estilos.filaCatalogo,
            indiceFila === 0 ? {} : estilos.filaCatalogoSiguiente,
          ]}
        >
          {fila.map((item, indice) => (
            <View
              key={item}
              style={[
                estilos.celdaCatalogo,
                {
                  width: ancho,
                  // La primera de cada fila arranca pegada al margen; las demás sangran
                  // los 10 pt que las separan de su regla. Ver `GEOMETRIA.catalogo`.
                  paddingLeft: indice === 0 ? 0 : GEOMETRIA.catalogo.izquierda,
                },
                indice === 0 ? {} : estilos.celdaCatalogoConRegla,
              ]}
            >
              <Text style={estilos.requerimiento}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

/** 2.F · `RielDatos`. */
export default function RielDatos(props: RielDatosProps): ReactElement {
  if (props.variante === 'catalogo') {
    return <Catalogo items={props.items} columnas={props.columnas} />
  }

  const declaradas =
    props.variante === 'unaLinea' ? [props.celdas] : props.filas

  /**
   * El colapso se resuelve ANTES de montar nada, y en dos pasos, porque son dos
   * cosas distintas: una celda sin dato desaparece de su fila, y una fila que se
   * queda sin celdas desaparece entera. Sin el segundo paso quedaría una regla
   * horizontal flotando sobre nada.
   *
   * Filtrar aquí y no dentro de `Fila` es lo que permite saber cuál es la primera
   * fila VIVA. Marcar la primera por su índice declarado pondría la regla
   * superior en la fila de arriba del todo en cuanto colapsara la fila 1.
   */
  const vivas = declaradas
    .map((fila) =>
      fila.filter(
        // Una celda con espacio de escritura declarado SOBREVIVE sin dato: es el
        // estado «vacío requerido» de 2.E, y colapsarla sería el defecto §8.8 al
        // revés — quitar el hueco donde hay que escribir.
        (celda) => tieneValor(celda.valor) || celda.escritura !== undefined,
      ),
    )
    .filter((fila) => fila.length > 0)

  const lamina = props.lamina ?? 'chasis'
  const trazo = TRAZO[lamina]
  const valor = valorDeCelda(lamina)

  return (
    <View
      style={[
        estilos.riel,
        { borderTopWidth: trazo.filete, borderBottomWidth: trazo.filete },
      ]}
    >
      {vivas.map((celdas, indice) => (
        <Fila
          key={celdas[0].clave}
          celdas={celdas}
          primera={indice === 0}
          regla={trazo.regla}
          valor={valor}
        />
      ))}
    </View>
  )
}
