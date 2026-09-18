/**
 * Sistema de documentos v3 — **FileteGruesoFino**. «El filete estructural del sistema.»
 *
 * Un segmento grueso en `acento.base` seguido de una línea fina negra a todo el ancho.
 *
 * CAMBIO v3 (brief 00 §3.4): la medida `principal` pasa de **96 × 2.5** a **72 × 2**.
 * Las otras dos no se tocan. Con la caja en 540 el segmento de 96 empezaba a leerse
 * como una barra, que es lo que I.3.2 prohíbe.
 *
 * ⚠ **LA MEDIDA `principal` YA NO SE USA EN LA FILA DE TÍTULO.** El filete que cierra
 * el bloque de título en v3 es una línea de 0.8 negro a todo el ancho, sin segmento
 * grueso: el grueso se gasta una vez por hoja y se gasta en el membrete (brief 00 §4).
 * Quien componga los dos verá dos acentos compitiendo a 14 pt de distancia.
 */

import { StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { FILETE, TINTA, type AcentoResuelto } from './tokens'

/**
 * Las tres medidas del sistema.
 *
 * `transicion` la estrena la apertura de sección de Internamiento y no la usa nadie
 * más (2.Q, regla 2).
 */
export type MedidaFilete = 'principal' | 'lista' | 'transicion'

const GROSOR: Record<MedidaFilete, number> = {
  principal: FILETE.acento,
  lista: FILETE.acento,
  transicion: FILETE.transicion,
}

const ANCHO: Record<MedidaFilete, number> = {
  principal: 72,
  lista: 64,
  transicion: 144,
}

const estilos = StyleSheet.create({
  /**
   * El grueso se dibuja ENCIMA del fino y no a su lado: los dos arrancan en el
   * margen izquierdo y el fino cruza la hoja entera por debajo. Se compone con un
   * contenedor de posición relativa y el segmento en absoluta, que es la única forma
   * de superponer dos trazos en el subconjunto de flexbox de Yoga.
   */
  contenedor: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  fino: {
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  segmento: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
})

export interface FileteGruesoFinoProps {
  /** El segmento grueso va en `acento.base`, en su forma pura (regla 3). */
  readonly acento: AcentoResuelto
  readonly medida?: MedidaFilete
}

/** 2.O · `FileteGruesoFino`. */
export default function FileteGruesoFino({
  acento,
  medida = 'principal',
}: FileteGruesoFinoProps): ReactElement {
  const grosor = GROSOR[medida]

  return (
    <View style={[estilos.contenedor, { height: grosor + FILETE.fino }]}>
      <View style={estilos.fino} />
      <View
        style={[
          estilos.segmento,
          { width: ANCHO[medida], height: grosor, backgroundColor: acento.base },
        ]}
      />
    </View>
  )
}
