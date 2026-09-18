/**
 * Sistema de documentos v3 — 2.Q · **AperturaSeccion**. «La transición entre las dos
 * secciones de Internamiento… cambia de LECTOR, no de tema.»
 *
 * Un solo consumidor, y por eso su geometría vive aquí y no en la escala (I.1.7).
 *
 * CAMBIOS v3 (brief 00 §14): número a **20**, alto **66**, y el rótulo del lector en
 * **versalita real** —mayúsculas con tracking, como toda versalita del sistema—. En v2
 * el rol `seccion.lector` llevaba el tracking de la versalita y la lámina escribía la
 * cadena en capitalización de oración: se componía «Para personal de enfermería…» con
 * el espaciado de una versalita, que es lo peor de las dos opciones.
 *
 * ⚠ **EL NÚMERO NO ES `seccion.numero`.** Ese rol vale 11/13 en v3 y aquí el dígito
 * mide 20: es la pieza que anuncia que la hoja cambia de lector, y a 11 pt no se ve
 * desde el otro lado de un mostrador. `APUESTA` sobre el alto total de 66 — es la suma
 * de sus partes, y lo que hay que mirar si no cuadra es el interlineado del título.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import { ESPACIO, RETICULA, estiloTipografico, type AcentoResuelto } from './tokens'

const SECCION = 'Sección'
const DE = 'de'

/** `APUESTA`. Ver la cabecera. */
const CUERPO_NUMERO = 20

const estilos = StyleSheet.create({
  apertura: {
    marginTop: ESPACIO[16],
    marginBottom: ESPACIO[12],
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: ESPACIO[8],
  },
  riel: { width: RETICULA.riel + 12, flexShrink: 0 },
  numero: {
    ...estiloTipografico('seccion.numero'),
    fontSize: CUERPO_NUMERO,
    lineHeight: 1.1,
  },
  cuerpo: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  rotulo: { ...estiloTipografico('etiqueta') },
  titulo: { ...estiloTipografico('cuerpo.encabezado1'), maxLines: 2 },
  lector: { ...estiloTipografico('seccion.lector') },
})

export interface AperturaSeccionProps {
  /** Cuál sección abre. Es el dígito que cuelga del riel, sin cero a la izquierda. */
  readonly numero: number
  readonly de: number
  readonly titulo: string
  /** Quién lee esta sección. Se compone en versalita. Colapsa solo. */
  readonly lector?: string
  readonly acento: AcentoResuelto
}

/** 2.Q · `AperturaSeccion`. */
export default function AperturaSeccion({
  numero,
  de,
  titulo,
  lector,
  acento,
}: AperturaSeccionProps): ReactElement {
  return (
    // No se parte: una apertura al pie de hoja anuncia una sección que no está.
    <View style={estilos.apertura} wrap={false}>
      <FileteGruesoFino acento={acento} medida="transicion" />
      <View style={estilos.fila}>
        <View style={estilos.riel}>
          <Text style={{ ...estilos.numero, color: acento.tinta }}>{numero}</Text>
        </View>
        <View style={estilos.cuerpo}>
          <Text style={estilos.rotulo}>
            {`${SECCION} ${numero} ${DE} ${de}`.toUpperCase()}
          </Text>
          <Text style={estilos.titulo}>{titulo}</Text>
          {lector === undefined || lector.trim() === '' ? null : (
            <Text style={estilos.lector}>{lector.toUpperCase()}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
