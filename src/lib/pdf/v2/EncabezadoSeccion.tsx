/**
 * Sistema de documentos v2 — componente 2.P · `EncabezadoSeccion`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.P. Transcripción, no diseño.
 *
 * Propósito: abrir una sección numerada de texto corrido. Lo usan Consentimiento
 * e Internamiento.
 *
 * REGLA 1 — NO ES UNA `EntradaNumerada`, AUNQUE SE LE PAREZCA
 *
 * Las dos cuelgan un número del riel y ponen texto al lado, y ahí acaba el
 * parecido. Esta **no participa de `ContadorLista`**, su número es de SECCIÓN y no
 * de entrada, y no tiene ranuras de ancla ni de marca. La ficha de I.2 dice además
 * que se evaluó meter 2.P dentro de 2.G y se descartó: sería un uso forzado que
 * arrastraría el contador detrás. Si alguna vez ves aquí un `01` con cero a la
 * izquierda, alguien confundió los dos componentes — ese cero es de 2.G, y es de
 * un identificador de ítem, no de un ordinal de sección.
 *
 * REGLA 2 — BANDERA IZQUIERDA, Y NO ES PREFERENCIA
 *
 * El párrafo va en `texto.corrido` **sin justificar**. El espécimen lo tiene
 * justificado con partición y queda superado por I.3.2, que prohíbe el texto
 * justificado sin excepción de formato. En este renderer el justificado además
 * traería de vuelta la partición con guion, que I.3.8 desactiva por un motivo que
 * no es estético (el gate de I.3.1).
 *
 * No hay ningún `textAlign` en este archivo: el valor por defecto de react-pdf ya
 * es bandera izquierda. **Si alguna vez aparece un `textAlign: 'justify'` aquí, es
 * el espécimen volviendo.**
 *
 * EL TEXTO NO PASA POR `ParserBloques`
 *
 * 2.J declara qué bloques del sistema usan su sintaxis de viñetas y el texto de
 * sección **no está en esa lista**: es prosa larga y prellenada por plantilla, no
 * una lista con encabezados. Los saltos de línea de la cadena se respetan tal cual.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  CAJA,
  FILETE,
  RETICULA,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría interna, de la composición de la ficha: el aire entre el filete que
 * abre y la cabecera. No es miembro de la escala de espaciado (I.1.7).
 */
const GEOMETRIA = {
  fileteCabecera: 8,
} as const

const estilos = StyleSheet.create({
  seccion: {
    width: CAJA.ancho,
  },
  /**
   * Aire entre secciones. `transicion.entreSecciones` y **no `espacio.24`**, que
   * mide lo mismo: I.1.7 avisa expresamente contra esa confusión y esta ficha es
   * la que la sufrió (anexo A, P2-11). Mover `espacio.24` para ajustar el aire
   * entre secciones movería con él todo lo demás del sistema que hoy mide 24.
   */
  siguiente: {
    marginTop: TRANSICION.entreSecciones,
  },
  /** La sección abre con regla de `filete.fino` a todo el ancho de la caja. */
  filete: {
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
    paddingTop: GEOMETRIA.fileteCabecera,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /** Riel del número: la misma anatomía que 2.G y 2.J, una columna exacta. */
  riel: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  /**
   * El título va tal como llega: **no se transforma a mayúsculas**. La regla de
   * componer en versalita es de las dos versalitas de I.1.4 —`etiqueta` y
   * `firma.rol`—, y la de componer en mayúsculas es del TÍTULO DEL DOCUMENTO
   * (preámbulo de II, `CONCILIA D1`). `titulo.seccion` no es ninguna de las dos:
   * su tracking de 0.14 em no es el 0.22 de la versalita del sistema.
   */
  titulo: { ...estiloTipografico('titulo.seccion'), flex: 1 },
  /**
   * Aire título → párrafo: `transicion.seccionParrafo`, el token que I.1.7 nombró
   * para esta ficha. Mide lo mismo que `espacio.8` y no es el mismo token.
   */
  parrafo: {
    ...estiloTipografico('texto.corrido'),
    marginTop: TRANSICION.seccionParrafo,
  },
})

export interface EncabezadoSeccionProps {
  /**
   * Ordinal de la sección. **Sin cero a la izquierda**: el cero es de 2.G y es de
   * un identificador de ítem, no de un ordinal de sección (regla 1).
   */
  numero: number
  titulo: string
  /**
   * El texto corrido de la sección, como una cadena. Los saltos de línea se
   * respetan; no se parsea (ver cabecera).
   */
  texto: string
  /** ¿Es la primera sección? La primera no lleva el aire entre secciones. */
  primera: boolean
  /** El número va en `acento.tinta`. */
  acento: AcentoResuelto
}

/** 2.P · `EncabezadoSeccion`. */
export default function EncabezadoSeccion({
  numero,
  titulo,
  texto,
  primera,
  acento,
}: EncabezadoSeccionProps): ReactElement {
  return (
    <View style={[estilos.seccion, primera ? {} : estilos.siguiente]}>
      <View style={estilos.filete}>
        <View style={estilos.cabecera}>
          <View style={estilos.riel}>
            <Text style={{ ...estiloTipografico('seccion.numero', acento) }}>
              {numero}
            </Text>
          </View>
          <Text style={estilos.titulo}>{titulo}</Text>
        </View>

        <Text style={estilos.parrafo}>{texto}</Text>
      </View>
    </View>
  )
}
