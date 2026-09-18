/**
 * Sistema de documentos v3 — 2.K · **ContadorLista**. «Que quien recibe una hoja
 * suelta sepa si le falta otra.»
 *
 * CAMBIO v3: **las dos formas se deciden en el render y no en el formato.**
 *
 * En v2 el contador era una unión de dos variantes —`intermedia` con `hoja` y `de`,
 * `final` sin ellas— y quien las elegía tenía que saber dónde corta la lista. Ningún
 * formato lo sabe: react-pdf reparte en hojas DESPUÉS de que el árbol esté escrito,
 * así que los tres formatos con lista larga pasaban siempre `final` y el contador
 * mentía en las hojas intermedias. Está reportado en la cabecera de la Receta de v2 —
 * «el contador en forma intermedia sale de saber dónde corta la lista, que es lo
 * mismo que falta en (a) y (b)»— y es lo que esta versión cierra.
 *
 * `render` recibe la hoja y el total **de este elemento de página**, que es
 * exactamente el dato que faltaba:
 *
 *     hojas intermedias   `MEDICAMENTOS · HOJA 1 DE 2 · TOTAL 7`
 *     última hoja         `TOTAL DE MEDICAMENTOS · 7`
 *
 * ⚠ **`subPage*` Y NO `page*`.** `subPageNumber` cuenta las hojas de este `Page`;
 * `pageNumber` las del `Document`. El contador habla de la LISTA, y la lista vive en
 * un elemento de página: en un Consentimiento con hoja de anexo, `pageNumber` diría
 * «hoja 4 de 6» de una lista que acabó en la 3.
 */

import { StyleSheet, Text } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { TINTA, estiloTipografico } from './tokens'

const SEPARADOR = ' · '
const HOJA = 'hoja'
const DE = 'de'
const TOTAL = 'total'
const TOTAL_DE = 'Total de'

const estilos = StyleSheet.create({
  contador: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.etiqueta,
  },
})

export interface ContadorListaProps {
  /** El sustantivo de la lista, en plural y en capitalización de oración. */
  readonly items: string
  /** Cuántos hay en el DOCUMENTO, no en la hoja. */
  readonly total: number
}

/*
 * ⚠⚠ **EL NODO DINÁMICO NO PUEDE LLEVAR `lineHeight`. NO LO «SIMPLIFIQUES».**
 *
 * Medido sobre el render, no deducido: **un `Text` con `render` y un `lineHeight` en su
 * propio estilo no compone NADA** —ni tinta ni capa de texto— y no lanza ningún error.
 * El motor resetea la caja del nodo dinámico a `height: 0` antes de recalcularla
 * (`resolveDynamicNodes` de `@react-pdf/layout`), y con un interlineado declarado esa
 * altura de cero deja el párrafo sin renglones. Sin `lineHeight` sí compone, que es por
 * qué el patrón parece correcto en una prueba de juguete.
 *
 * Todos los roles de I.1.4 declaran interlineado, así que **todo texto dinámico del
 * sistema cae en el defecto**. La forma que sí compone, y la que se usa en los tres
 * sitios donde el sistema compone texto por hoja, es ésta:
 *
 *     nodo EXTERIOR con `render`  →  sólo geometría, nunca un rol tipográfico
 *     nodo INTERIOR que devuelve  →  el `Text` con su `estiloTipografico()`
 *
 * Se conserva `Text` por fuera —y no `View`— porque `TextProps.render` es el único de
 * los dos que declara `totalPages` y `subPageTotalPages` en sus tipos. Con `View`
 * compone igual, pero hace falta un `as` para leer las dos cifras.
 */
/** 2.K · `ContadorLista`. */
export default function ContadorLista({ items, total }: ContadorListaProps): ReactElement {
  return (
    <Text
      render={({ subPageNumber, subPageTotalPages }) => {
        const hoja = subPageNumber ?? 1
        const hojas = subPageTotalPages ?? 1
        const texto =
          hojas > 1 && hoja < hojas
            ? [items, `${HOJA} ${hoja} ${DE} ${hojas}`, `${TOTAL} ${total}`].join(SEPARADOR)
            : [`${TOTAL_DE} ${items}`, String(total)].join(SEPARADOR)
        return <Text style={estilos.contador}>{texto.toUpperCase()}</Text>
      }}
    />
  )
}
