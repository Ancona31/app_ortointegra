/**
 * Sistema de documentos v3 — 2.H · **BloqueNegativo**. «Marcar un dato crítico de modo
 * que sobreviva a la fotocopia, al fax y a la lectura de reojo en un mostrador.»
 *
 * Cuadro sólido `tinta.negra` con el texto en `tinta.papel`. **No es color**: en
 * fotocopia y en fax un cuadro negro sigue siendo un cuadro negro, que es la razón por
 * la que I.3.3 lo prefiere a cualquier fondo de acento.
 *
 * CAMBIO v3: el cuerpo baja al de `etiqueta` (6.5/9) y el relleno se declara aquí. El
 * bloque medía 14.5 pt de alto en v2 y mide **13** en v3 —9 de renglón más 2 + 2—, que
 * es lo que lo deja a la altura del ancla de 14 sin empujarla.
 *
 * ⚠ **LAS TRECE VÍAS VAN EN NEGATIVO, INCLUIDA LA ORAL.** Decisión de Angel contra lo
 * medido: la lámina compone la oral como texto plano y las otras doce en bloque. Se
 * compone el bloque para las trece, y por eso este archivo no compara contra ninguna
 * vía — el catálogo vive fuera del render, en II.3 §5.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { TINTA, estiloTipografico, SIN_ENCOGER } from './tokens'

/** La cadena del documento urgente, constante del sistema. */
const URGENTE = 'Urgente'

const RELLENO = { vertical: 2, horizontal: 5 } as const

const estilos = StyleSheet.create({
  bloque: {
    backgroundColor: TINTA.negra,
    paddingVertical: RELLENO.vertical,
    paddingHorizontal: RELLENO.horizontal,
    flexShrink: SIN_ENCOGER,
    // Sin esto el bloque se estira al ancho de su contenedor en una columna.
    alignSelf: 'flex-start',
  },
  texto: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.papel,
    maxLines: 1,
  },
})

export type BloqueNegativoProps =
  /** La vía de administración dentro de una entrada (2.G, ranura `marca`). */
  | { variante: 'via'; via: string }
  /** El documento urgente: Imagenología e Internamiento. */
  | { variante: 'urgente' }

/** 2.H · `BloqueNegativo`. */
export default function BloqueNegativo(props: BloqueNegativoProps): ReactElement {
  const texto = props.variante === 'via' ? props.via : URGENTE
  return (
    <View style={estilos.bloque}>
      <Text style={estilos.texto}>{texto.toUpperCase()}</Text>
    </View>
  )
}
