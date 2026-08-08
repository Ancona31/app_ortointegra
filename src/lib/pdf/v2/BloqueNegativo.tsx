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
 * Las tres se implementan aquí en tres líneas de estilo y una ausencia:
 * `alignSelf: 'flex-start'` hace que el ancho lo ponga la palabra y no el padre;
 * `flexShrink: 0` impide que un contenedor estrecho comprima la caja; y en este
 * archivo **no aparecen `maxLines` ni `textOverflow`**, que son las dos props con
 * las que react-pdf trunca. Si alguna vez aparecen, la regla 3 se rompió.
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
   * EL BADGE DE LA LÁMINA DE IMAGENOLOGÍA — 14.5 pt de alto, no 19.
   *
   * La ficha cerró su geometría por deducción, con lo único que las reglas 1 a 3
   * dejaban libre: el padding, tomado de `espacio.4` y `espacio.8` (anexo A,
   * P2-15). La lámina de este formato lo mide, y mide otra cosa —también el
   * cuerpo, que la deducción daba por congelado en el rol `etiqueta`:
   *
   *     hoja 1        8 / 10 pt, 0.18 em, padding `2 6 2.5`   → 14.5 de alto
   *     continuación  7 /  9 pt, 0.18 em, padding `1.5 5 2`   → 12.5 de alto
   *
   * **La regla 2 no se rompe:** dice que no se escala el texto PARA QUE QUEPA, y
   * esto no es un ajuste al ancho disponible — el ancho lo sigue poniendo la
   * palabra. Es que la lámina compone el badge un punto por debajo de la versalita
   * de rótulo, y `urgente reducido` reduce además el cuerpo, no solo el aire.
   *
   * Que las dos variantes tengan altos distintos era justo lo que la deducción
   * quiso evitar —«o el badge reducido dejaría de alinearse con lo que tiene al
   * lado»—, y en la lámina no se alinean con nada: en continuación el badge va a la
   * derecha de la línea de paciente, que es otro bloque. Reportado.
   */
  imagenologia: {
    normal: { cuerpo: 8, interlineado: 10, vertical: 2, verticalInferior: 2.5, horizontal: 6 },
    reducido: { cuerpo: 7, interlineado: 9, vertical: 1.5, verticalInferior: 2, horizontal: 5 },
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
   * `flexShrink: 0` cubre el otro lado: dentro de una fila estrecha, Yoga
   * comprimiría la caja y partiría la palabra. Reglas 2 y 3.
   *
   * Sin `borderRadius`: I.3.2 prohíbe las esquinas muy redondeadas y la ficha no
   * declara ninguna, así que el bloque es rectangular.
   */
  bloque: {
    backgroundColor: TINTA.negra,
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingVertical: GEOMETRIA.padding.vertical,
    paddingHorizontal: GEOMETRIA.padding.horizontal,
  },
  /** Único cambio de `urgente reducido`. El vertical se queda como está. */
  bloqueReducido: {
    paddingHorizontal: GEOMETRIA.paddingHorizontalReducido,
  },
  /** La desviación declarada: el rol `etiqueta` con el color sustituido. */
  texto: { ...estiloTipografico('etiqueta'), color: TINTA.papel },
  /** Las dos calibraciones de la lámina de Imagenología. Ver `GEOMETRIA`. */
  bloqueImagenologia: {
    paddingTop: GEOMETRIA.imagenologia.normal.vertical,
    paddingBottom: GEOMETRIA.imagenologia.normal.verticalInferior,
    paddingHorizontal: GEOMETRIA.imagenologia.normal.horizontal,
  },
  bloqueImagenologiaReducido: {
    paddingTop: GEOMETRIA.imagenologia.reducido.vertical,
    paddingBottom: GEOMETRIA.imagenologia.reducido.verticalInferior,
    paddingHorizontal: GEOMETRIA.imagenologia.reducido.horizontal,
  },
  textoImagenologia: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    fontSize: GEOMETRIA.imagenologia.normal.cuerpo,
    lineHeight:
      GEOMETRIA.imagenologia.normal.interlineado / GEOMETRIA.imagenologia.normal.cuerpo,
    // El tracking se recalcula porque cambia el cuerpo Y cambia el em: la lámina
    // compone 0.18, no el 0.22 de la versalita del sistema.
    letterSpacing: GEOMETRIA.imagenologia.tracking * GEOMETRIA.imagenologia.normal.cuerpo,
  },
  textoImagenologiaReducido: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    fontSize: GEOMETRIA.imagenologia.reducido.cuerpo,
    lineHeight:
      GEOMETRIA.imagenologia.reducido.interlineado /
      GEOMETRIA.imagenologia.reducido.cuerpo,
    letterSpacing:
      GEOMETRIA.imagenologia.tracking * GEOMETRIA.imagenologia.reducido.cuerpo,
  },
})

export type BloqueNegativoProps =
  /**
   * Vía de administración dentro de una `EntradaNumerada` (2.G, ranura `marca`).
   * La palabra la declara el formato: son las trece vías de II.3 §5.
   */
  | { variante: 'via'; via: string }
  /** Badge del documento, bajo el título. Uno por documento (regla 4). */
  | { variante: 'urgente'; lamina?: Lamina }
  /** Repetición del badge en hojas de continuación. Misma palabra, menos aire. */
  | { variante: 'urgenteReducido'; lamina?: Lamina }

/** 2.H · `BloqueNegativo`. */
export default function BloqueNegativo(props: BloqueNegativoProps): ReactElement {
  const palabra = props.variante === 'via' ? props.via : CADENA_URGENTE
  const reducido = props.variante === 'urgenteReducido'
  const imagen = props.variante !== 'via' && props.lamina === 'imagenologia'

  const caja = imagen
    ? reducido
      ? estilos.bloqueImagenologiaReducido
      : estilos.bloqueImagenologia
    : reducido
      ? estilos.bloqueReducido
      : {}

  const texto = imagen
    ? reducido
      ? estilos.textoImagenologiaReducido
      : estilos.textoImagenologia
    : estilos.texto

  return (
    <View style={[estilos.bloque, caja]}>
      <Text style={texto}>{palabra.toUpperCase()}</Text>
    </View>
  )
}
