/**
 * Sistema de documentos v2 — componente 2.H · `BloqueNegativo`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.H. Transcripción, no diseño.
 *
 * Propósito: marcar un dato crítico de modo que sobreviva a la fotocopia, al fax
 * y a la lectura de reojo en un mostrador.
 *
 * LAS CUATRO REGLAS SON EL COMPONENTE
 *
 * 1. **Nunca se abrevia.** No hay `I.M.` ni `SUBCUT.`. El bloque crece hasta que
 *    la palabra cabe entera.
 * 2. **No se escala el texto ni se reduce el tracking para que quepa.** El ancho
 *    es la variable; el cuerpo no.
 * 3. **No se trunca ni se pone elipsis.** Un dato de vía truncado es un error de
 *    administración.
 * 4. **`urgente` marca el documento, no un ítem de la lista.**
 *
 * ⚠ **LO QUE GARANTIZA CADA REGLA, Y LO QUE NO PUEDE GARANTIZAR NINGUNA DECLARACIÓN**
 *
 * Las reglas 2 y 3 se cumplen por AUSENCIA, y eso sí es firme: en este archivo no hay
 * ninguna escritura de `fontSize` ni de `letterSpacing` fuera del rol, y **no aparecen
 * `maxLines` ni `textOverflow`**, que son las dos props con las que react-pdf trunca. El
 * renderer nunca escala tipografía por su cuenta. Si alguna de esas cuatro cosas aparece
 * aquí, la regla correspondiente se rompió.
 *
 * La regla 1 se apoya en `alignSelf: 'flex-start'`: el ancho lo pone la palabra y no el
 * padre.
 *
 * ⚠ **AQUÍ HABÍA UN `flexShrink: 0` Y NO HACÍA NADA. QUEDA RETIRADO.**
 *
 * Decía impedir «que un contenedor estrecho comprima la caja», y `@react-pdf/layout` compone
 * `setFlexShrink` como `setYogaValue('flexShrink')(value || 1)`: **el 0 declarado se
 * convierte en 1**. Medido con dos cajas de 80 en una fila de 100, una de ellas con
 * `flexShrink: 0`: salen las dos a 50. Una declaración que se lee como garantía y no lo es
 * es peor que no tenerla.
 *
 * **Lo que de verdad protege a este bloque es su CONTENIDO.** Yoga no encoge una caja de
 * texto por debajo de su *min-content*, así que en un contenedor estrecho el bloque **rompe
 * a más renglones** en vez de apretar la palabra. Medido en II.4 con una marca comercial de
 * 73 caracteres: en la columna de 453.75 pt el negativo compone 432.9 × 24.5 —dos renglones—
 * y no se sale ni recorta.
 *
 * **Y eso es correcto según las reglas 2 y 3, pero tiene una consecuencia que hay que
 * mirar:** un negativo de dos renglones deja de leerse como etiqueta y empieza a leerse como
 * un párrafo con fondo. No se resuelve en este archivo —el dispositivo hace lo que debe—,
 * sino partiendo el dato en el formato que lo entrega.
 *
 * `minWidth` **no sirve aquí**, aunque Yoga sí lo respete: el ancho de este bloque lo pone
 * la palabra y no hay ninguna cifra estática que declarar. Donde sí la hay —los 77 pt del
 * espacio de firma en 2.L, el ancho declarado del marco en 2.U, la caja de la fecha en
 * 2.C— la protección se ha convertido en un `minHeight` o un `minWidth` de verdad.
 *
 * EL COLOR DEL TEXTO SE SUSTITUYE A MANO, Y ES LO ÚNICO QUE SE TOCA DEL ROL
 *
 * El rol `etiqueta` trae `tinta.etiqueta`, un gris de 7 : 1 pensado para papel
 * blanco. Aquí el texto va sobre fondo negro, así que el color pasa a
 * `tinta.papel`. Es la desviación declarada «`etiqueta` sobre negativo» de la
 * tabla de I.1.4: se cambia el color y nada más — familia, cuerpo, interlineado,
 * peso y tracking los sigue poniendo el rol. Pedir el rol tal cual imprimiría
 * gris sobre negro, que es lo contrario de para lo que existe el componente.
 *
 * LA CADENA `URGENTE` ES DEL COMPONENTE, NO DEL FORMATO
 *
 * A diferencia del título de 2.C, que el formato entrega como cadena, aquí el
 * formato entrega un booleano: II.2 §2 y II.6 §2 declaran el campo `urgente`
 * como «No requerido · si viene vacío, sin badge». No hay ningún sitio donde un
 * formato declare el texto del badge, y hacerlo entrar por prop sería abrir la
 * puerta a que una hoja de continuación imprimiera `URG.`, que es exactamente lo
 * que prohíbe la regla 1.
 *
 * La palabra de la variante `via` sí viene del formato: son las trece de II.3 §5
 * y el componente no las conoce.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ESPACIO, TINTA, estiloTipografico, type Lamina } from './tokens'

/**
 * Geometría interna del bloque, de la ficha de 2.H.
 *
 * La ficha cita `espacio.4` y `espacio.8` sin decir cuál va dónde, y declara una
 * variante `urgente reducido` sin decir qué reduce. Las dos se cierran con lo
 * único que las reglas dejan libre:
 *
 * - **Qué reduce `urgente reducido`: el padding.** El cuerpo y el tracking están
 *   congelados por la regla 2, y el texto entero por la 1, así que la única
 *   dimensión que una variante puede reducir es el aire alrededor de la palabra.
 *   No es una reducción del cuerpo: la palabra se imprime al mismo tamaño en las
 *   hojas de continuación que en la hoja 1.
 * - **Cuál va dónde:** el horizontal es el mayor de los dos miembros que la ficha
 *   cita, porque es el eje en el que el bloque crece con la palabra (reglas 1 a
 *   3); el vertical es el menor y no cambia entre variantes, o el badge reducido
 *   cambiaría de alto y dejaría de alinearse con lo que tiene al lado.
 *
 * Queda registrado en el anexo A (P2-15).
 */
const GEOMETRIA = {
  /** `via` y `urgente`: 4 pt arriba y abajo, 8 pt a los lados. */
  padding: { vertical: ESPACIO[4], horizontal: ESPACIO[8] },
  /** `urgente reducido`: los 4 pt de la escala por los cuatro lados. */
  paddingHorizontalReducido: ESPACIO[4],
  /**
   * LA CALIBRACIÓN MEDIDA — 14.5 pt de alto, no 19.
   *
   * La ficha cerró su geometría por deducción, con lo único que las reglas 1 a 3
   * dejaban libre: el padding, tomado de `espacio.4` y `espacio.8` (anexo A,
   * P2-15). Las láminas la miden, y miden otra cosa —también el cuerpo, que la
   * deducción daba por congelado en el rol `etiqueta`:
   *
   *     hoja 1        8 / 10 pt, 0.18 em, padding `2 6 2.5`   → 14.5 de alto
   *     continuación  7 /  9 pt, 0.18 em, padding `1.5 5 2`   → 12.5 de alto
   *
   * ⚠ **NO ES «LA CALIBRACIÓN DE IMAGENOLOGÍA», Y ASÍ SE LLAMABA.** Las dos láminas
   * que componen un bloque en negativo lo componen con estas mismas seis cifras, y
   * lo componen sobre objetos DISTINTOS: en Imagenología es el badge `URGENTE` que
   * cuelga del título, y en Receta es la vía de administración dentro de la entrada.
   * Que coincidan hasta la centésima es el argumento más fuerte que hay para pensar
   * que **esta es la geometría real del componente y el 19 pt deducido es el que
   * sobra**. No se sube a la ficha por decisión propia: eso movería el badge de los
   * ocho formatos. Reportado, con una lámina más de respaldo que antes.
   *
   * **La regla 2 no se rompe:** dice que no se escala el texto PARA QUE QUEPA, y
   * esto no es un ajuste al ancho disponible — el ancho lo sigue poniendo la
   * palabra. Es que las láminas componen el bloque un punto por debajo de la
   * versalita de rótulo, y `urgente reducido` reduce además el cuerpo, no solo el
   * aire.
   *
   * Que las dos variantes tengan altos distintos era justo lo que la deducción
   * quiso evitar —«o el badge reducido dejaría de alinearse con lo que tiene al
   * lado»—, y en la lámina no se alinean con nada: en continuación el badge va a la
   * derecha de la línea de paciente, que es otro bloque. Reportado.
   */
  medida: {
    normal: { cuerpo: 8, interlineado: 10, vertical: 2, verticalInferior: 2.5, horizontal: 6 },
    reducido: { cuerpo: 7, interlineado: 9, vertical: 1.5, verticalInferior: 2, horizontal: 5 },
    /**
     * LA TERCERA CALIBRACIÓN — `receta`, Y ES LA ÚNICA QUE NO SALE DE UNA LÁMINA.
     *
     * ⚠ **ES UNA DECISIÓN DE DISEÑO DE ANGEL, NO UNA MEDICIÓN.** Las dos de arriba
     * se leen de las láminas aprobadas; esta se declara. Va marcada para que nadie
     * la «concilie» contra un archivo de diseño que no la contiene.
     *
     * LA CAUSA. Desde la densificación de la receta la vía comparte renglón con el
     * ancla, y ahí las dos piezas se comparan de un vistazo. Con la calibración
     * `normal` —8 pt en versalita, sobre negro y a 0.18 em— el bloque pesa casi
     * tanto como el nombre comercial que califica: la versalita en negativo suma
     * fondo, tracking y caja al cuerpo, así que 8 pt contra los 12 del ancla no se
     * leen como cuatro puntos de diferencia. **El nombre comercial tiene que ganar
     * de un vistazo, y no ganaba.**
     *
     * LA CIFRA. Cuerpo 6.5 sobre los 12 del ancla: poco más de la mitad, que es la
     * proporción a la que el bloque deja de disputarle la jerarquía y pasa a leerse
     * como lo que es —una marca, no un título—. El aire acompaña al cuerpo con las
     * mismas proporciones que separan `normal` de `reducido`, así que el bloque
     * mide **11 pt de alto** y sigue cabiendo holgado en el renglón de 16 del ancla.
     *
     * ⚠ **NO LA HEREDA NADIE MÁS, Y ESO ES EL PUNTO.** El badge `URGENTE` de
     * Imagenología comparte componente y seguiría en `normal`: cuelga de un título
     * de 17 pt y no compite con nada. Por eso esta calibración entra por lámina y
     * no sustituye a `normal` — hacerlo movería el badge de los ocho formatos, que
     * es justo lo que la cabecera de `medida` advierte de no hacer.
     */
    receta: { cuerpo: 6.5, interlineado: 8, vertical: 1.25, verticalInferior: 1.75, horizontal: 4.5 },
    /** En em, como lo declara el diseño. La conversión a pt va abajo. */
    tracking: 0.18,
  },
} as const

/**
 * La palabra del badge. En capitalización de oración: la transformación a
 * versalita ocurre en el render, igual que en 2.C, 2.E y 2.F. No la escribas ya
 * en mayúsculas aquí, o el sistema tendría dos convenciones.
 */
const CADENA_URGENTE = 'Urgente'

const estilos = StyleSheet.create({
  /**
   * `alignSelf: 'flex-start'` es la regla 1 hecha estilo: sin él, un `View` dentro
   * de una columna se estira al ancho del padre por defecto y los dos bloques de
   * la verificación visible saldrían idénticos —que es justo el síntoma que la
   * ficha manda buscar—. Con él, el ancho lo pone la palabra.
   *
   * **Aquí NO hay `flexShrink: 0`**, y su ausencia es deliberada: el renderer lo convertía
   * en 1 y no protegía nada. Ver la nota larga de la cabecera antes de reponerlo.
   *
   * Sin `borderRadius`: I.3.2 prohíbe las esquinas muy redondeadas y la ficha no
   * declara ninguna, así que el bloque es rectangular.
   */
  bloque: {
    backgroundColor: TINTA.negra,
    alignSelf: 'flex-start',
    paddingVertical: GEOMETRIA.padding.vertical,
    paddingHorizontal: GEOMETRIA.padding.horizontal,
  },
  /** Único cambio de `urgente reducido`. El vertical se queda como está. */
  bloqueReducido: {
    paddingHorizontal: GEOMETRIA.paddingHorizontalReducido,
  },
  /** La desviación declarada: el rol `etiqueta` con el color sustituido. */
  texto: { ...estiloTipografico('etiqueta'), color: TINTA.papel },
  /** Las dos calibraciones que las láminas miden. Ver `GEOMETRIA.medida`. */
  bloqueMedido: {
    paddingTop: GEOMETRIA.medida.normal.vertical,
    paddingBottom: GEOMETRIA.medida.normal.verticalInferior,
    paddingHorizontal: GEOMETRIA.medida.normal.horizontal,
  },
  bloqueMedidoReducido: {
    paddingTop: GEOMETRIA.medida.reducido.vertical,
    paddingBottom: GEOMETRIA.medida.reducido.verticalInferior,
    paddingHorizontal: GEOMETRIA.medida.reducido.horizontal,
  },
  /** La de Receta. Ver `GEOMETRIA.medida.receta`. */
  bloqueMedidoReceta: {
    paddingTop: GEOMETRIA.medida.receta.vertical,
    paddingBottom: GEOMETRIA.medida.receta.verticalInferior,
    paddingHorizontal: GEOMETRIA.medida.receta.horizontal,
  },
  textoMedido: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    fontSize: GEOMETRIA.medida.normal.cuerpo,
    lineHeight:
      GEOMETRIA.medida.normal.interlineado / GEOMETRIA.medida.normal.cuerpo,
    // El tracking se recalcula porque cambia el cuerpo Y cambia el em: la lámina
    // compone 0.18, no el 0.22 de la versalita del sistema.
    letterSpacing: GEOMETRIA.medida.tracking * GEOMETRIA.medida.normal.cuerpo,
  },
  textoMedidoReducido: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    fontSize: GEOMETRIA.medida.reducido.cuerpo,
    lineHeight:
      GEOMETRIA.medida.reducido.interlineado /
      GEOMETRIA.medida.reducido.cuerpo,
    letterSpacing:
      GEOMETRIA.medida.tracking * GEOMETRIA.medida.reducido.cuerpo,
  },
  textoMedidoReceta: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    fontSize: GEOMETRIA.medida.receta.cuerpo,
    lineHeight:
      GEOMETRIA.medida.receta.interlineado / GEOMETRIA.medida.receta.cuerpo,
    letterSpacing: GEOMETRIA.medida.tracking * GEOMETRIA.medida.receta.cuerpo,
  },
})

export type BloqueNegativoProps =
  /**
   * Vía de administración dentro de una `EntradaNumerada` (2.G, ranura `marca`).
   * La palabra la declara el formato: son las trece vías de II.3 §5.
   *
   * ⚠ **SOLO LAS NO ORALES LLEGAN AQUÍ, Y LO DECIDE EL FORMATO.** La lámina de
   * Receta compone la vía oral como texto plano y la sublingual como bloque, y el
   * archivo lo resuelve con un `via === 'Oral'`. II.3 §5 declaraba las trece en
   * negativo; manda la lámina. El catálogo no lo conoce este componente ni 2.G:
   * ver `MarcaVia` en la ficha de 2.G.
   */
  | { variante: 'via'; via: string; lamina?: Lamina }
  /** Badge del documento, bajo el título. Uno por documento (regla 4). */
  | { variante: 'urgente'; lamina?: Lamina }
  /** Repetición del badge en hojas de continuación. Misma palabra, menos aire. */
  | { variante: 'urgenteReducido'; lamina?: Lamina }

/** 2.H · `BloqueNegativo`. */
export default function BloqueNegativo(props: BloqueNegativoProps): ReactElement {
  const palabra = props.variante === 'via' ? props.via : CADENA_URGENTE
  const reducido = props.variante === 'urgenteReducido'
  /**
   * Cualquier lámina distinta del chasis compone la calibración medida, y las tres
   * variantes la aceptan: la miden dos láminas sobre dos objetos distintos y no hay
   * motivo para que el badge la tenga y la vía no. Ver `GEOMETRIA.medida`.
   */
  const medido = (props.lamina ?? 'chasis') !== 'chasis'
  /**
   * ⚠ **LA PRIMERA VEZ QUE ESTE COMPONENTE DISTINGUE ENTRE LÁMINAS**, y la ficha lo
   * anticipaba: 2.G ya venía pasando la lámina de cada formato «para que el día que
   * 2.H distinga entre láminas esto no se quede componiendo la equivocada». Es ese
   * día. Ver `GEOMETRIA.medida.receta`.
   *
   * Solo la vía de Receta: el badge `URGENTE` de Imagenología comparte componente y
   * se queda en `normal`.
   */
  const receta = medido && props.lamina === 'receta' && props.variante === 'via'

  const caja = receta
    ? estilos.bloqueMedidoReceta
    : medido
      ? reducido
        ? estilos.bloqueMedidoReducido
        : estilos.bloqueMedido
      : reducido
        ? estilos.bloqueReducido
        : {}

  const texto = receta
    ? estilos.textoMedidoReceta
    : medido
      ? reducido
        ? estilos.textoMedidoReducido
        : estilos.textoMedido
      : estilos.texto

  return (
    <View style={[estilos.bloque, caja]}>
      <Text style={texto}>{palabra.toUpperCase()}</Text>
    </View>
  )
}
