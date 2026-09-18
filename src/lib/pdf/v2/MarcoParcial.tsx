/**
 * Sistema de documentos v3 — 2.U · **MarcoParcial**. «Enmarcar sin encerrar… sin
 * barra, sin fondo y sin caja cerrada.»
 *
 * Dos lados —superior de acento y lateral izquierdo— y nunca los cuatro: una caja
 * cerrada dice «formulario», y lo que estos bloques dicen es «lee esto aparte».
 *
 * CAMBIO v3: el grosor se unifica en `FILETE.acento` (2) para los dos consumidores. La
 * lámina de Honorarios medía 2.53 y `FILETE_HONORARIOS` se retira entero (brief 00 §11).
 *
 * Regla 3, sin cambio: **enmarca, no compone**. La tipografía de lo que va dentro la
 * declara quien lo mete. Regla 4: el ancho lo declara el consumidor — este componente
 * no sabe en qué columna vive.
 */

import { StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import { ESPACIO, FILETE, TINTA } from './tokens'

export interface PaddingMarco {
  readonly superior: number
  readonly lateral: number
  readonly inferior: number
}

/**
 * Los dos marcos del sistema, con su padding medido. Viven aquí y no en el formato por
 * la razón de §0: dos consumidores, un solo sitio de definición.
 */
export const MARCO = {
  /** Caja de aseguradora de la Cotización. Envuelve una ficha de tres celdas. */
  aseguradora: { superior: ESPACIO[8], lateral: 12, inferior: ESPACIO[10] } as PaddingMarco,
  /** Leyenda no fiscal del Recibo y de la Cotización. */
  leyenda: { superior: ESPACIO[6], lateral: 12, inferior: ESPACIO[8] } as PaddingMarco,
} as const

const estilos = StyleSheet.create({
  marco: {
    borderTopWidth: FILETE.acento,
    borderTopColor: TINTA.negra,
    borderLeftWidth: FILETE.acento,
    borderLeftColor: TINTA.negra,
  },
})

export interface MarcoParcialProps {
  /** Ancho del marco, declarado por el consumidor (regla 4). */
  readonly ancho?: number
  readonly padding: PaddingMarco
  /** Color de los dos trazos. Sin él, `tinta.negra`. La Cotización pasa el acento. */
  readonly color?: string
  readonly children: ReactNode
}

/** 2.U · `MarcoParcial`. */
export default function MarcoParcial({
  ancho,
  padding,
  color,
  children,
}: MarcoParcialProps): ReactElement {
  return (
    <View
      style={[
        estilos.marco,
        {
          paddingTop: padding.superior,
          paddingLeft: padding.lateral,
          paddingBottom: padding.inferior,
        },
        ancho === undefined ? {} : { width: ancho },
        color === undefined ? {} : { borderTopColor: color, borderLeftColor: color },
      ]}
      wrap={false}
    >
      {children}
    </View>
  )
}
