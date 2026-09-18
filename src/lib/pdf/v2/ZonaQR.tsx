/**
 * Sistema de documentos v3 — 2.R · **ZonaQR**. «Verificación por terceros — farmacia,
 * hospital, aseguradora.»
 *
 * CAMBIOS v3 (brief 00 §6.3):
 *
 *   lado del código    56 → **48**
 *   marco              `MarcoParcial` de dos lados → **ninguno**
 *   consumidores       Receta · Suplementación · Cotización → **Receta y Suplementación**
 *   orden              código a la derecha del texto → **texto a la izquierda, código
 *                      a la derecha** (sin cambio de orden, con medianil de 12)
 *
 * **SIN QR EN RECIBO NI EN COTIZACIÓN.** Decisión de producto: no hay ventanilla que
 * verifique un importe, y el hueco de 230 pt que el código dejaba sobre la banda de
 * cierre de la Cotización era el defecto §9.4. Verificación sólo donde un tercero
 * dispensa algo contra el papel.
 *
 * Regla 3, sin cambio: **sin ráster no se monta nada**. En una vista previa todavía no
 * hay token que codificar, y la banda de cierre se queda con la firma sola — que es lo
 * correcto, no un estado degradado.
 */

import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ESPACIO, estiloTipografico, type AcentoResuelto } from './tokens'

const LADO = 48
const MEDIANIL = 12

const estilos = StyleSheet.create({
  zona: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  texto: {
    alignItems: 'flex-end',
    marginRight: MEDIANIL,
  },
  etiqueta: {
    ...estiloTipografico('etiqueta'),
    textAlign: 'right',
  },
  codigo: {
    width: LADO,
    height: LADO,
    flexShrink: 0,
  },
  aire: { height: ESPACIO[2] },
})

export interface ZonaQRProps {
  /** El ráster del código, ya generado y normalizado a PNG o JPG por quien llama. */
  readonly qr: string
  /** `Verificación`. Se compone en versalita. */
  readonly rotulo: string
  /** El folio que codifica el QR, impreso al lado para poder teclearlo a mano. */
  readonly folio: string
  readonly acento: AcentoResuelto
}

/** 2.R · `ZonaQR`. */
export default function ZonaQR({ qr, rotulo, folio, acento }: ZonaQRProps): ReactElement {
  return (
    <View style={estilos.zona} wrap={false}>
      <View style={estilos.texto}>
        <Text style={estilos.etiqueta}>{rotulo.toUpperCase()}</Text>
        <View style={estilos.aire} />
        <Text style={{ ...estiloTipografico('folio', acento), textAlign: 'right' }}>
          {folio}
        </Text>
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={qr} style={estilos.codigo} />
    </View>
  )
}
