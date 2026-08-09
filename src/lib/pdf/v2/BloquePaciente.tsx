/**
 * Sistema de documentos v2 — componente 2.D · `BloquePaciente`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.D. Transcripción, no diseño.
 *
 * Propósito: identificar al paciente en la hoja. Es un requisito de SEGURIDAD, no
 * de maquetación: en el hospital las hojas se separan.
 *
 * UN SOLO RIEL DE SIETE CELDAS EN DOS FILAS, NO DOS RIELES
 *
 * `CONCILIA D6` — una versión anterior del spec declaraba dos componentes,
 * `BloquePaciente` y un `RielDatos` con fecha y diagnóstico. El diseño tiene uno
 * solo. Si aparece la tentación de partirlo en dos, es D6 volviendo.
 *
 * QUÉ HACE ESTE ARCHIVO Y QUÉ NO
 *
 * La composición del riel —anchos, reglas, filetes, padding, redistribución al
 * colapsar— vive en `RielDatos` (2.F). Aquí se declara SOLO lo que es del
 * paciente: qué siete celdas hay, cuántas columnas de `riel.celda` ocupa cada
 * una, en qué fila va, y las dos excepciones tipográficas de sus valores.
 *
 * Esta separación es la sustitución que quedó anunciada al construir 2.D antes
 * que 2.F: el riel se compuso aquí de forma provisional con la nota de que al
 * llegar 2.F se sustituiría y no se duplicaría (I.3.5). Ya está hecha. Si vuelves
 * a ver `View` con `borderLeftWidth` en este archivo, la duplicación volvió.
 *
 * LO QUE ESTE ARCHIVO SIGUE SIN SER
 *
 * a. `Campo` (2.E) no compone estas celdas, y no es un olvido: de los tres
 *    consumidores de riel del sistema solo este tiene celdas con rótulo, y la
 *    decisión de colapsar pertenece a quien posee la geometría que colapsa, que
 *    es 2.F. Lo que sí se comparte con 2.E es la regla de qué cuenta como dato
 *    ausente, que 2.F importa de ahí.
 * b. 2.D **no decide qué campo es requerido y cuál opcional**: lo declara el
 *    formato en la Sección II (2.E regla 3). Por eso todo lo que no sea el nombre
 *    entra como opcional y colapsa si no viene.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import type { ReactElement } from 'react'
import { StyleSheet } from '@react-pdf/renderer'
import RielDatos, {
  ETIQUETA_CELDA,
  VALOR_CELDA,
  type CeldaRiel,
  type EstiloValorCelda,
} from './RielDatos'
import {
  FILETE_HONORARIOS,
  FILETE_SUPLEMENTACION,
  FUENTE,
  TINTA,
  veloDeAcento,
  type AcentoResuelto,
  type Lamina,
} from './tokens'

/**
 * Geometría interna de ESTE componente, de la ficha de 2.D. I.1.7 declara que la
 * geometría interna vive en la ficha del componente y no en la escala.
 *
 * Las dos entradas son las dos excepciones tipográficas del riel del paciente. El
 * padding de celda, las reglas y los filetes NO están aquí: son del riel, y el
 * riel es 2.F.
 */
const GEOMETRIA = {
  /**
   * Peso del valor del nombre. La tabla de la ficha lo declara «`dato`, peso
   * 500»: mismo rol que los demás valores, un peso por encima. Es el único
   * destaque del riel y no se replica en ninguna otra celda.
   */
  pesoAncla: 500,
  /**
   * VALOR DE LA CELDA DE DIAGNÓSTICO — IBM Plex Sans 11 / 13 pt, peso 400,
   * tracking 0, `tinta.negra`.
   *
   * ⚠ **INTERLINEADO 13, NO 16.** A.8 lo declara en 11 / 16, heredando el 16 del
   * valor de riel que la lámina desmiente. Las tres celdas de la fila inferior del
   * riel miden 30.5 pt en la lámina, exactamente igual que las cuatro de arriba más
   * su regla, y con 16 esta celda sola estiraría la fila a 33.5: las reglas
   * verticales del riel llegan de arriba abajo de la fila, así que la celda más alta
   * manda sobre las otras dos. El 13 es el mismo interlineado que 2.F declara como
   * desviación del valor de celda, no un valor nuevo — lo que sigue siendo excepción
   * de ESTA celda es la FAMILIA y el cuerpo de 11 pt, que es lo que A.8 declara de
   * propio.
   *
   * Es la ÚNICA excepción de familia del riel y la ficha de 2.D la declara
   * entera. No la «unifiques» con el resto del riel ni la subas a I.1.4: no es un
   * miembro de la escala tipográfica —no aparece en su tabla— sino geometría
   * interna de este componente, y ese es justo el caso que I.1.7 manda declarar
   * aquí. Si algún día 11 / 16 en humanista aparece en un segundo componente,
   * entonces sí es un rol y sube a I.1.4 con nombre propio.
   *
   * Por eso este es también el único sitio de v2 donde se divide por el cuerpo a
   * mano en vez de pedirle el estilo a `estiloTipografico()`: esa función es la
   * puerta a la ESCALA, y esto no está en la escala.
   */
  diagnostico: {
    cuerpo: 11,
    interlineado: 13,
    peso: 400,
    tracking: 0,
    color: TINTA.negra,
  },
  /**
   * EL MISMO VALOR CUANDO EL DIAGNÓSTICO OCUPA LA FILA ENTERA — 11 / **15**.
   *
   * Medido en las láminas de Imagenología y de Receta, que coinciden hasta la
   * centésima: en las dos el diagnóstico va a `span 12` y no comparte renglón con
   * fecha ni hora, así que nada le obliga a caber en los 13 pt de las otras celdas.
   * La fila inferior mide **32.375** —0.375 de regla + 3 + 10 + **15** + 4— y es la
   * única del riel que no mide 30. Es el mismo caso que arriba visto por el otro
   * lado: aquel 13 salía de que la celda compartía fila con dos celdas más.
   */
  interlineadoDiagnosticoFilaPlena: 15,
  /**
   * LA CELDA DE PESO, de la lámina de Suplementación. Es la octava celda del
   * inventario de 2.D y la única que el chasis no tenía.
   *
   * `padding: 3 10 4 0` — el lateral IZQUIERDO a cero, contra los 10 de todas las
   * demás. Se compone tal cual: el rótulo y la cifra de esta celda arrancan pegados al
   * margen de la caja y no alineados con `PACIENTE`, que está justo encima a 10 pt.
   * **Es lo que mide la lámina** y encaja con lo que la celda es —la base del cálculo
   * de todas las dosis de la hoja, y la única cifra del riel a cuerpo 14—, así que se
   * imprime así y queda anotado por si al mirar el papel resulta un descuido del
   * archivo y no una decisión.
   *
   * Sus dos tipografías viven aquí y no en I.1.4 por lo mismo que la del diagnóstico:
   * son de ESTA celda, con un solo consumidor, y I.1.7 manda declararlas en la ficha
   * del componente. Solo se escribe lo que se desvía —el rótulo `PESO` es el
   * `etiqueta` del riel sin tocar, y por eso no aparece.
   *
   *   `base`   el calificador `BASE DEL CÁLCULO`: 6.5 / 10, 600, 0.18 em, tinta plena
   *   `valor`  la cifra: 14 / 16, 600, tinta plena
   *
   * ⚠ **EL CALIFICADOR VA EN TINTA PLENA Y ES UN RÓTULO**, que es lo contrario de lo
   * que hace el resto del riel —toda etiqueta del sistema va en `tinta.etiqueta`—. Es
   * de la lámina y no un descuido de transcripción: el rótulo dice qué es la celda y
   * el calificador dice qué se hace con ella, y el segundo pesa más.
   *
   * El tracking sale del píxel, como el del ancla de Receta: 1.56 px a 6.5 pt —8.667
   * px— son 0.18 em.
   */
  peso: {
    base: { cuerpo: 6.5, interlineado: 10, peso: 600, tracking: 0.18 },
    valor: { cuerpo: 14, interlineado: 16, peso: 600 },
    /** El `0` del `padding: 3 10 4 0`. Ver arriba: es de la lámina. */
    paddingIzquierdo: 0,
  },
  /**
   * LAS DOS CELDAS PROPIAS DE LA LÁMINA DE HONORARIOS.
   *
   * `escritura` — la celda de paciente de este formato **no colapsa cuando falta el
   * dato**: conserva su rótulo y deja una línea para llenar a pluma. Es el estado
   * «vacío requerido» de 2.E y **el único sitio del sistema que lo usa**, porque este
   * es el único formato donde el paciente no es obligatorio (II.5 §2) y a la vez el
   * único donde alguien puede escribirlo a mano en el mostrador. Con la línea, la celda
   * pasa de 30 a **33.47** pt: 3 + 10 + 16.47 + 4.
   *
   * ⚠ **II.5 §5 DICE QUE COLAPSA Y LA LÁMINA DIBUJA LA LÍNEA.** La ficha razona que
   * «no imprime un guion ni una línea, porque nadie va a llenarlo a mano»; la lámina
   * del recibo mínimo la compone. Manda la lámina. Reportado.
   *
   * `vigencia` — la única celda con FONDO de los cinco formatos extraídos: el acento al
   * **8 %**, que es un velo nuevo —el chasis declara el 6 %— dentro del máximo del 12 %
   * que I.1.8 admite. Su rótulo va en `tinta.secundaria` y su cifra en peso 600, y esas
   * dos desviaciones **no son cosméticas**: son las que hacen que la celda siga
   * distinguiéndose en fotocopia, donde el velo desaparece (I.3.3). Reportado como
   * `D25`.
   */
  honorarios: {
    escritura: { alto: 16.47, grosor: FILETE_HONORARIOS.regla },
    vigencia: { velo: 0.08, peso: 600 },
  },
} as const

/**
 * Los datos del riel. **Eran siete y son ocho**: `peso` entra con la lámina de
 * Suplementación, que es el único formato del sistema donde el peso no es un dato
 * clínico más sino la base de todo lo que la hoja calcula (II.4 §5).
 *
 * No lo lleva ningún otro formato y no colapsa nada de los tres ya construidos: quien
 * no lo pasa no monta la celda, que es como se comporta cualquier campo de este riel.
 */
export type CampoPaciente =
  | 'paciente'
  | 'edad'
  | 'sexo'
  | 'expediente'
  | 'peso'
  | 'diagnostico'
  | 'fecha'
  | 'hora'
  /** La novena, y solo de la cotización de II.5. Ver `GEOMETRIA.honorarios`. */
  | 'vigencia'

/** Cómo se compone el VALOR de una celda. La etiqueta es igual en las ocho. */
type TrazoValor =
  /** Rol `dato` tal cual: edad, sexo, expediente, fecha y hora. Es el de 2.F. */
  | 'dato'
  /** Rol `dato` en peso 500. Solo el nombre del paciente, que es el ancla. */
  | 'datoAncla'
  /** La excepción de familia. Solo diagnóstico. */
  | 'diagnostico'
  /** La cifra a 14 / 16. Solo peso. Ver `GEOMETRIA.peso`. */
  | 'peso'
  /** El valor de celda en peso 600. Solo vigencia. Ver `GEOMETRIA.honorarios`. */
  | 'vigencia'

interface DescriptorCelda {
  readonly campo: CampoPaciente
  readonly etiqueta: string
  /** Columnas de `riel.celda` que ocupa. */
  readonly columnas: number
  readonly trazo: TrazoValor
}

// Las siete celdas de la tabla de la ficha, una constante cada una para poder
// componer las filas sin repetir anchos ni etiquetas.
const PACIENTE: DescriptorCelda = { campo: 'paciente', etiqueta: 'Paciente', columnas: 5, trazo: 'datoAncla' }
const EDAD: DescriptorCelda = { campo: 'edad', etiqueta: 'Edad', columnas: 2, trazo: 'dato' }
const SEXO: DescriptorCelda = { campo: 'sexo', etiqueta: 'Sexo', columnas: 2, trazo: 'dato' }
const EXPEDIENTE: DescriptorCelda = { campo: 'expediente', etiqueta: 'Expediente', columnas: 3, trazo: 'dato' }
const DIAGNOSTICO: DescriptorCelda = { campo: 'diagnostico', etiqueta: 'Diagnóstico', columnas: 5, trazo: 'diagnostico' }
const FECHA: DescriptorCelda = { campo: 'fecha', etiqueta: 'Fecha', columnas: 4, trazo: 'dato' }
const HORA: DescriptorCelda = { campo: 'hora', etiqueta: 'Hora', columnas: 3, trazo: 'dato' }

/**
 * El diagnóstico de las láminas de Imagenología y de Receta ocupa la fila ENTERA.
 * Es la misma celda con otro ancho: en las dos, la fecha no vive en este riel —va
 * como `Emisión` en el riel derecho del bloque de título— y la hora tampoco, así
 * que no hay con quién compartir el renglón.
 */
const DIAGNOSTICO_PLENO: DescriptorCelda = { ...DIAGNOSTICO, columnas: 12 }

/**
 * LA FILA INFERIOR DE SUPLEMENTACIÓN: peso (4) + diagnóstico (8) = 12.
 *
 * El diagnóstico no ocupa la fila entera como en las otras dos láminas de riel doble
 * —cede cuatro columnas—, y por eso es su propio descriptor y no `DIAGNOSTICO_PLENO`.
 * Lo que NO cambia es su composición: sigue siendo la excepción de familia a 11 / 15,
 * porque lo que fijaba aquel 15 no era el `span 12` sino que la celda no comparte
 * renglón con `Fecha` y `Hora`, que son las que lo apretaban a 13 en el chasis.
 *
 * `BASE DEL CÁLCULO` no es una celda: es el segundo rótulo de la de peso (2.F).
 */
const PESO: DescriptorCelda = { campo: 'peso', etiqueta: 'Peso', columnas: 4, trazo: 'peso' }
const DIAGNOSTICO_CON_PESO: DescriptorCelda = { ...DIAGNOSTICO, columnas: 8 }

/** El calificador del rótulo de la celda de peso. Lo declara 2.D, no el formato. */
const ROTULO_BASE_CALCULO = 'Base del cálculo'

/** Fila superior: 5 + 2 + 2 + 3 = 12 columnas de `riel.celda`. */
const FILA_SUPERIOR: readonly DescriptorCelda[] = [PACIENTE, EDAD, SEXO, EXPEDIENTE]
/** Fila inferior: 5 + 4 + 3 = 12. */
const FILA_INFERIOR: readonly DescriptorCelda[] = [DIAGNOSTICO, FECHA, HORA]
/** Fila inferior de Imagenología y de Receta: una sola celda de 12. */
const FILA_INFERIOR_PLENA: readonly DescriptorCelda[] = [DIAGNOSTICO_PLENO]
/** Fila inferior de Suplementación: 4 + 8 = 12. */
const FILA_INFERIOR_CON_PESO: readonly DescriptorCelda[] = [PESO, DIAGNOSTICO_CON_PESO]
/** Variante `reducido`: una sola línea con nombre y expediente, con sus anchos. */
const FILA_REDUCIDA: readonly DescriptorCelda[] = [PACIENTE, EXPEDIENTE]

/**
 * LAS DOS FILAS DE LA LÁMINA DE HONORARIOS, Y SON UNA FILA CADA UNA.
 *
 * Es el único riel del sistema de una sola fila: no hay diagnóstico —el documento no lo
 * lleva—, ni edad, ni sexo, ni expediente. Lo que hay es quién paga, cuándo se emite y
 * —solo en la cotización— hasta cuándo vale.
 *
 * **Las dos reparten las mismas doce columnas de otra manera**, y ese reparto no se
 * puede derivar del colapso: sin vigencia, el reparto proporcional daría 6.67 y 5.33
 * columnas donde la lámina mide 7 y 5. Por eso son dos filas declaradas y por eso la
 * elige el FORMATO con `rielHonorarios`, nunca la presencia del dato en tiempo de
 * render (I.3.4).
 *
 * `Fecha de emisión` es su propio descriptor y no `FECHA`: la etiqueta es otra. En los
 * cuatro formatos anteriores la fecha se rotula `Fecha` —o sube al riel del título como
 * `Emisión`— y aquí la lámina la escribe entera.
 */
const PACIENTE_COTIZACION: DescriptorCelda = { ...PACIENTE, columnas: 5 }
const PACIENTE_RECIBO: DescriptorCelda = { ...PACIENTE, columnas: 7 }
const EMISION_COTIZACION: DescriptorCelda = { campo: 'fecha', etiqueta: 'Fecha de emisión', columnas: 4, trazo: 'dato' }
const EMISION_RECIBO: DescriptorCelda = { ...EMISION_COTIZACION, columnas: 5 }
const VIGENCIA: DescriptorCelda = { campo: 'vigencia', etiqueta: 'Vigencia', columnas: 3, trazo: 'vigencia' }

/** Cotización: 5 + 4 + 3 = 12. */
const FILA_COTIZACION: readonly DescriptorCelda[] = [
  PACIENTE_COTIZACION,
  EMISION_COTIZACION,
  VIGENCIA,
]
/** Recibo: 7 + 5 = 12. */
const FILA_RECIBO: readonly DescriptorCelda[] = [PACIENTE_RECIBO, EMISION_RECIBO]

/**
 * Cuál de las dos filas de Honorarios se compone. **Lo declara el formato**, que es
 * quien sabe si está emitiendo una cotización o un recibo — el mismo criterio con el
 * que `CalibracionEntrada` la declara en 2.G y `Lamina` en todo el chasis.
 */
export type RielHonorarios = 'cotizacion' | 'recibo'

/**
 * Valores del riel. Solo `paciente` es obligatorio.
 *
 * Regla 1 de la ficha: el nombre nunca está ausente —los 8 formularios lo
 * bloquean, salvo Honorarios y Escrito Médico, donde es opcional por decisión de
 * producto—. En esos dos el bloque entero no se emite: la composición de II.8 dice
 * «`BloquePaciente` completo, SI HAY PACIENTE». Por eso aquí no hay una variante
 * sin nombre: quien no tiene paciente no monta el componente.
 *
 * REGLA 3 DE LA FICHA — `sexo`, `numero_expediente` y `hora` NO LLEGAN HOY desde
 * ningún formulario. El expediente se consulta en el hub y no se pasa; la hora
 * existe en el nombre del archivo y no en el documento. Es cableado pendiente
 * (Paso 5 del plan), NO un campo nuevo. Hasta que exista el cable, los tres se
 * comportan como campo vacío opcional y colapsan. Cuando el cable exista, se pasan
 * y el riel los muestra sin tocar este archivo.
 */
export interface ValoresPaciente {
  readonly paciente: string
  readonly edad?: string
  readonly sexo?: string
  readonly expediente?: string
  /**
   * Peso, **ya con su unidad**, compuesto por quien llama —la lámina imprime
   * `72.5 kg`—. Mismo criterio que la emisión y las cédulas: este componente coloca,
   * no rotula ni convierte.
   *
   * Lo lleva un solo formato, y en él su ausencia colapsa dos cosas a la vez: la
   * celda del riel y el rótulo `Dosis calculada para NN kg` de la cabecera de la
   * lista (II.4 §6). La segunda no es de aquí — la resuelve el formato, que es quien
   * tiene delante los dos.
   */
  readonly peso?: string
  readonly diagnostico?: string
  readonly fecha?: string
  readonly hora?: string
  /**
   * Vigencia de la cotización, YA redactada por quien llama —la lámina imprime
   * `30 días naturales`—. Mismo criterio que el peso y la emisión: este componente
   * coloca, no rotula ni calcula.
   *
   * La lleva un solo formato y solo uno de sus dos casos. En el recibo no existe: un
   * recibo no caduca.
   */
  readonly vigencia?: string
}

export type BloquePacienteProps =
  /**
   * Hoja 1. `lamina` decide dos cosas a la vez, y las dos son del mismo riel: el
   * trazo de sus filetes (2.F) y si la fila inferior lleva tres celdas o una.
   */
  | ({
      variante: 'completo'
      lamina?: Lamina
      /**
       * EL ACENTO, Y SOLO PARA UNA REGLA DEL RIEL.
       *
       * Es lo único de este bloque que no es neutro: la lámina de Suplementación
       * separa la celda de peso de la de diagnóstico con un filete de 1.9 pt en
       * `acento.base` en vez de con el hairline de las demás. Ninguna otra celda de
       * ninguna otra lámina lo usa.
       *
       * Opcional a propósito, y sin fallback inventado: sin acento esa regla se
       * compone como el hairline del riel, que es lo que hace el resto del bloque.
       * Es la misma degradación que I.3.7 declara para el render —nunca colapsa, cae
       * a lo neutro—, y es lo que permite que la hoja de chasis del taller siga
       * montando este componente sin pasarlo.
       *
       * **En la lámina de Honorarios hace falta además para el fondo de la celda de
       * vigencia**, y ahí la degradación es la misma: sin acento, la celda va sin velo
       * y se sigue distinguiendo por el peso de su cifra y por la tinta de su rótulo,
       * que es lo que I.3.3 exige de todas formas.
       */
      acento?: AcentoResuelto
      /**
       * Cuál de las dos filas de Honorarios. **Solo se lee con `lamina="honorarios"`**;
       * en las otras cuatro láminas no hay dos anatomías entre las que elegir.
       */
      rielHonorarios?: RielHonorarios
    } & ValoresPaciente)
  /**
   * Hojas de continuación. Regla 2 de la ficha: NO ES OPCIONAL cuando el documento
   * tiene más de una hoja. Una hoja de indicaciones sin nombre de paciente es un
   * riesgo clínico.
   */
  | { variante: 'reducido'; paciente: string; expediente?: string }

const estilos = StyleSheet.create({
  /**
   * Único valor del riel en peso 500: el nombre, que es el ancla de la hoja.
   *
   * Parte de `VALOR_CELDA` —el valor de celda YA DESVIADO por 2.F— y no del rol
   * `dato`: la ficha lo declara «`dato`, peso 500», es decir el mismo valor que las
   * demás celdas un peso por encima. Partiendo del rol crudo se quedaría en 12 / 16
   * y estiraría la fila entera, que es justo lo que la desviación del riel corrige.
   */
  valorAncla: { ...VALOR_CELDA, fontWeight: GEOMETRIA.pesoAncla },
  valorDiagnostico: {
    fontFamily: FUENTE.humanista,
    fontSize: GEOMETRIA.diagnostico.cuerpo,
    lineHeight: GEOMETRIA.diagnostico.interlineado / GEOMETRIA.diagnostico.cuerpo,
    fontWeight: GEOMETRIA.diagnostico.peso,
    letterSpacing: GEOMETRIA.diagnostico.tracking,
    color: GEOMETRIA.diagnostico.color,
  },
  valorDiagnosticoPleno: {
    fontFamily: FUENTE.humanista,
    fontSize: GEOMETRIA.diagnostico.cuerpo,
    lineHeight:
      GEOMETRIA.interlineadoDiagnosticoFilaPlena / GEOMETRIA.diagnostico.cuerpo,
    fontWeight: GEOMETRIA.diagnostico.peso,
    letterSpacing: GEOMETRIA.diagnostico.tracking,
    color: GEOMETRIA.diagnostico.color,
  },
  /**
   * LAS DOS COMPOSICIONES DE LA CELDA DE PESO. Parten del valor de celda YA DESVIADO
   * por 2.F —igual que `valorAncla`— y no del rol crudo: lo único que esta celda
   * cambia del riel es el cuerpo, el interlineado y el peso, y partir de `dato` le
   * devolvería el 12 / 16 que la desviación del riel corrige.
   */
  valorPeso: {
    ...VALOR_CELDA,
    fontSize: GEOMETRIA.peso.valor.cuerpo,
    lineHeight: GEOMETRIA.peso.valor.interlineado / GEOMETRIA.peso.valor.cuerpo,
    fontWeight: GEOMETRIA.peso.valor.peso,
  },
  /**
   * El calificador `BASE DEL CÁLCULO`. El tracking se declara en em, como todo el
   * spec, y se convierte a pt aquí con la misma multiplicación que hace
   * `estiloTipografico()` — que no sirve para esto porque una desviación declarada no
   * está en la escala.
   */
  rotuloBase: {
    ...VALOR_CELDA,
    fontSize: GEOMETRIA.peso.base.cuerpo,
    lineHeight: GEOMETRIA.peso.base.interlineado / GEOMETRIA.peso.base.cuerpo,
    fontWeight: GEOMETRIA.peso.base.peso,
    letterSpacing: GEOMETRIA.peso.base.tracking * GEOMETRIA.peso.base.cuerpo,
  },
  /**
   * LAS DOS DESVIACIONES DE LA CELDA DE VIGENCIA. Parten de los valores YA DESVIADOS
   * del riel —`VALOR_CELDA` y `ETIQUETA_CELDA`— y no de los roles crudos: lo único que
   * esta celda cambia es el peso de la cifra y la tinta del rótulo, y partir de
   * `dato` o de `etiqueta` le devolvería el 12 / 16 y el interlineado 11 que la
   * desviación del riel corrige.
   *
   * Las dos existen para que el fondo no sea el único portador de significado (I.3.3).
   */
  valorVigencia: { ...VALOR_CELDA, fontWeight: GEOMETRIA.honorarios.vigencia.peso },
  etiquetaVigencia: { ...ETIQUETA_CELDA, color: TINTA.secundaria },
})

/**
 * `undefined` para el trazo normal: así la celda se queda con el rol `dato` que
 * 2.F aplica por defecto, en vez de que 2.D lo repita por su cuenta. Solo se
 * entrega estilo cuando hay una excepción DECLARADA que entregar.
 */
function estiloValor(trazo: TrazoValor, lamina: Lamina): EstiloValorCelda | undefined {
  if (trazo === 'datoAncla') {
    /*
      EN LA LÁMINA DE RECETA EL DESTAQUE NO AÑADE NADA, y por eso aquí no se
      compone: ese riel lleva TODAS sus celdas en peso 500 (ver `PESO_VALOR_RECETA`
      en 2.F), así que la excepción del nombre y el valor por defecto coinciden.
      Devolver `estilos.valorAncla` volvería a partir de `VALOR_CELDA`, que es el
      valor del chasis, y bajaría el resto del renglón a 400 sin querer.

      **Lo que NO cambia es la regla:** el nombre sigue siendo el ancla del riel. Si
      esa lámina se corrige y su valor de celda vuelve a 400, este `if` sobra y el
      destaque reaparece solo.
    */
    return lamina === 'receta' ? undefined : estilos.valorAncla
  }
  if (trazo === 'peso') return estilos.valorPeso
  if (trazo === 'vigencia') return estilos.valorVigencia
  if (trazo === 'diagnostico') {
    /*
      La excepción de fila plena vale igual con `span 8`: lo que le da los 15 pt de
      interlineado es no compartir renglón con `Fecha` y `Hora`, no ocupar las doce
      columnas. Ver `FILA_INFERIOR_CON_PESO`.
    */
    return lamina === 'chasis'
      ? estilos.valorDiagnostico
      : estilos.valorDiagnosticoPleno
  }
  return undefined
}

/** Traduce un descriptor de la ficha a la celda que 2.F consume. */
function celdas(
  descriptores: readonly DescriptorCelda[],
  valores: Partial<Record<CampoPaciente, string>>,
  lamina: Lamina,
  acento?: AcentoResuelto,
): readonly CeldaRiel[] {
  return descriptores.map((d) => ({
    clave: d.campo,
    etiqueta: d.etiqueta,
    valor: valores[d.campo],
    columnas: d.columnas,
    estiloValor: estiloValor(d.trazo, lamina),
    /*
      LAS TRES COSAS QUE SOLO TIENE LA CELDA DE PESO, y las tres entran por las ranuras
      que 2.F declara en vez de por una variante suya: el riel no sabe qué es una base
      de cálculo.

      La regla de acento va en la celda de la DERECHA porque el riel compone todas sus
      reglas como borde izquierdo (ver `reglaIzquierda` en 2.F). Aquí eso se lee al
      revés de lo que dice la lámina y dibuja la misma línea.
    */
    ...(d.campo === 'peso'
      ? {
          etiquetaSecundaria: {
            texto: ROTULO_BASE_CALCULO,
            estilo: estilos.rotuloBase,
          },
          paddingIzquierdo: GEOMETRIA.peso.paddingIzquierdo,
        }
      : {}),
    ...(d.campo === 'diagnostico' &&
    lamina === 'suplementacion' &&
    acento !== undefined
      ? {
          reglaIzquierda: {
            grosor: FILETE_SUPLEMENTACION.acento,
            color: acento.base,
          },
        }
      : {}),
    /*
      LAS DOS COSAS QUE SOLO TIENE LA LÁMINA DE HONORARIOS, y las dos entran por las
      ranuras que 2.F declara: el riel no sabe qué es una vigencia ni por qué el
      paciente de un recibo se puede llenar a mano.

      El velo se deriva aquí y no en la capa de tokens porque el 8 % es de ESTA celda:
      `resolverAcento()` deriva el 6 % del chasis, que es el de todos los demás fondos
      tenues del sistema.
    */
    ...(d.campo === 'paciente' && lamina === 'honorarios'
      ? { escritura: GEOMETRIA.honorarios.escritura }
      : {}),
    ...(d.campo === 'vigencia'
      ? {
          estiloEtiqueta: estilos.etiquetaVigencia,
          ...(acento === undefined
            ? {}
            : {
                fondo: veloDeAcento(
                  acento.base,
                  GEOMETRIA.honorarios.vigencia.velo,
                ),
              }),
        }
      : {}),
  }))
}

/** 2.D · `BloquePaciente`. */
export default function BloquePaciente(props: BloquePacienteProps): ReactElement {
  if (props.variante === 'reducido') {
    return (
      <RielDatos
        variante="unaLinea"
        celdas={celdas(
          FILA_REDUCIDA,
          { paciente: props.paciente, expediente: props.expediente },
          'chasis',
        )}
      />
    )
  }

  const lamina = props.lamina ?? 'chasis'

  /**
   * EL ÚNICO RIEL DE UNA SOLA FILA DEL SISTEMA. No es una fila superior sin inferior:
   * es otra anatomía, con otras etiquetas y otro reparto de las doce columnas. Ver
   * `FILA_COTIZACION` y `FILA_RECIBO`.
   */
  if (lamina === 'honorarios') {
    const fila =
      props.rielHonorarios === 'recibo' ? FILA_RECIBO : FILA_COTIZACION
    return (
      <RielDatos
        variante="celdas"
        lamina={lamina}
        filas={[celdas(fila, props, lamina, props.acento)]}
      />
    )
  }

  /**
   * Las TRES anatomías de la fila inferior, una por lo que el formato mete en ella:
   * tres celdas en el chasis —diagnóstico, fecha y hora—, una sola de doce donde la
   * fecha sube al riel del título, y dos donde además hay peso que declarar.
   */
  const inferior =
    lamina === 'chasis'
      ? FILA_INFERIOR
      : lamina === 'suplementacion'
        ? FILA_INFERIOR_CON_PESO
        : FILA_INFERIOR_PLENA

  return (
    <RielDatos
      variante="celdas"
      lamina={lamina}
      filas={[
        celdas(FILA_SUPERIOR, props, lamina, props.acento),
        celdas(inferior, props, lamina, props.acento),
      ]}
    />
  )
}
