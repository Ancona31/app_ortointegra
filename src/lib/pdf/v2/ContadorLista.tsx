/**
 * Sistema de documentos v2 — componente 2.K · `ContadorLista`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.K. Transcripción, no diseño.
 *
 * Propósito: que quien recibe una hoja suelta sepa si le falta otra.
 *
 * LAS DOS FORMAS
 *
 *   intermedia   `<ÍTEMS> EN ESTA HOJA · NN DE MM`   NN es lo impreso en ESA hoja
 *   final        `TOTAL DE <ÍTEMS> · MM`
 *
 * La diferencia no es cosmética: si la hoja 1 muestra el total, está contando el
 * documento y no la hoja, y quien la recibe no puede saber que le falta la 2.
 *
 * `<ÍTEMS>` LO DECLARA EL FORMATO, NO ESTE COMPONENTE (regla 1)
 *
 * Estudios, medicamentos, suplementos, conceptos. La palabra entra por prop en
 * capitalización de oración y se compone en versalita aquí, igual que toda
 * etiqueta del sistema.
 *
 * EL ROL ES UNA DESVIACIÓN DECLARADA, Y EL COLOR NO VIAJA CON ELLA
 *
 * Se compone con **`pie` en versalita**: el rol `pie` con peso 600 y tracking
 * `0.22 em`, que son los de la versalita del sistema —los de `etiqueta` y
 * `firma.rol`—, y de ahí se leen aquí en vez de repetirlos como cifras.
 *
 * **El color es del sitio, no de la desviación.** El rol `pie` va en
 * `tinta.papel` porque vive sobre la banda de acento de 2.M; este contador NO
 * vive ahí —vive al pie del ÁREA DE CONTENIDO—, así que pedir el rol tal cual lo
 * imprimiría blanco sobre blanco. Aquí es `tinta.secundaria`. Es el mismo cuidado
 * que 2.H, por la razón inversa: allí se aclara el texto para que se vea sobre
 * negro, aquí se oscurece para que se vea sobre papel.
 *
 * Los tres avisos de 2.N comparten este tratamiento exacto —misma posición, mismo
 * registro, misma forma de cadena— y pueden salir en la misma hoja. Si algún día
 * divergen, compiten por la misma mirada sin que la diferencia signifique nada.
 *
 * DÓNDE SE DECIDE QUÉ FORMA VA (regla 2)
 *
 * «Un documento de una sola hoja cuenta como FINAL». Este componente no sabe
 * cuántas hojas tiene el documento ni dónde cae el corte: eso lo sabe el motor de
 * flujo (2.N). La forma entra por prop y quien la elige es el sitio que compone
 * el documento.
 *
 * REGLA 3 — DÓNDE NO SE INSTANCIA
 *
 * No aplica a listas no paginables ni a un `RielDatos` marcado `sin contador`:
 * un catálogo abierto —el médico agrega y quita requerimientos de Internamiento—
 * no tiene total verdadero, y «3 de 7» sería una cifra falsa. La regla se cumple
 * NO INSTANCIANDO el contador y no contando esos ítems en `total`. No hay aquí
 * una prop para desactivarlo: un contador que se pinta a sí mismo vacío seguiría
 * ocupando sitio y afirmando algo.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { TINTA, TIPOGRAFIA, estiloTipografico, type Lamina } from './tokens'

/**
 * La versalita del sistema, leída de `etiqueta` en vez de escrita como cifra.
 *
 * I.1.4 lo dice con todas las letras: los dos valores que la desviación `pie` en
 * versalita comparte son «los de la versalita del sistema: peso 600 y tracking
 * `0.22 em`, que son los de `etiqueta` y `firma.rol`». Tomarlos de ahí es lo que
 * impide que este archivo tenga un 600 y un 0.22 sueltos que nadie pueda cruzar
 * contra I.1.4 el día que la versalita cambie.
 */
const VERSALITA = {
  peso: TIPOGRAFIA.etiqueta.peso,
  /** En em, como lo declara el spec. La conversión a pt va abajo. */
  tracking: TIPOGRAFIA.etiqueta.tracking,
} as const

const estilos = StyleSheet.create({
  /**
   * `pie` en versalita, en `tinta.secundaria`.
   *
   * Es el único sitio de v2 donde se multiplica por el cuerpo fuera de
   * `estiloTipografico()`, y tiene motivo: esa función es la puerta a la ESCALA y
   * devuelve el rol entero: el tracking que trae es el de `pie` (0.1 em), no el
   * de la desviación. La conversión em → pt es la misma que hace la función
   * —`tracking × cuerpo`—, aplicada al tracking que sustituye. No es una regla de
   * tres suelta: sin ella, el tracking se escribiría en pt como literal y dejaría
   * de ser el de la versalita del sistema.
   *
   * Sin margen de ninguna clase: la separación respecto del contenido es del
   * contenedor. La ficha no la declara, y este componente no la inventa.
   */
  contador: {
    ...estiloTipografico('pie'),
    fontWeight: VERSALITA.peso,
    letterSpacing: VERSALITA.tracking * TIPOGRAFIA.pie.cuerpo,
    color: TINTA.secundaria,
  },
  /**
   * El mismo contador en las láminas de Imagenología y de Receta:
   * **`tinta.etiqueta`**, un gris más claro que el `tinta.secundaria` del chasis.
   * Cuerpo, interlineado, peso y tracking no se mueven —7 / 11 en 600—, así que el
   * alto sigue siendo 11 pt.
   *
   * El color es del SITIO, que es lo que declara la cabecera: aquí el sitio no
   * cambia —sigue al pie del área de contenido— pero las dos láminas lo componen un
   * tono por encima. Dos de tres. Reportado.
   *
   * ⚠ **LO QUE ESTE COMPONENTE NO COMPONE DE LA LÁMINA DE RECETA: SUS DOS ZONAS.**
   * Esa lámina reparte el contador en un flex de dos zonas —el rótulo y la cifra—
   * en vez de una sola cadena unida por la raya, y sus cifras llevan cero a la
   * izquierda: `04 de 07`, `07`. Aquí no se compone ninguna de las dos cosas. El
   * cero a la izquierda está decidido en contra por la ficha (anexo A, P2-17: es la
   * regla 1 de 2.G y es del número de ENTRADA, no de un conteo), y el reparto en
   * dos zonas no se puede escribir sin inventar el medianil, que la medición no da.
   * Reportado, no compuesto.
   */
  contadorMedido: {
    color: TINTA.etiqueta,
  },
})

interface Comun {
  /**
   * El sustantivo que declara el formato en la Sección II: estudios,
   * medicamentos, suplementos, conceptos. En capitalización de oración — se
   * compone en versalita aquí, no lo pases ya en mayúsculas.
   */
  items: string
  /** Total de ítems del DOCUMENTO, el `MM` de las dos formas. */
  total: number
  /** Qué lámina fija el color. Sin ella, la del chasis. */
  lamina?: Lamina
}

export type ContadorListaProps =
  /** Hoja intermedia: lo que lleva ESA hoja, y de cuántas. */
  | ({ forma: 'intermedia'; enEstaHoja: number } & Comun)
  /** Hoja final. Un documento de una sola hoja usa esta forma (regla 2). */
  | ({ forma: 'final' } & Comun)

/**
 * Las dos cadenas de la ficha, montadas antes de componer.
 *
 * **Las cifras van sin cero a la izquierda.** El cero a la izquierda es la regla
 * 1 de 2.G y es del número de ENTRADA, que es un identificador de dos dígitos;
 * aquí `NN` y `MM` son marcadores de posición de un conteo, no un formato fijo.
 * Un `07 DE 13` en el contador imitaría el número de entrada y haría creer que
 * señala a un ítem concreto de la lista. Queda registrado en el anexo A (P2-17).
 */
function cadena(props: ContadorListaProps): string {
  if (props.forma === 'intermedia') {
    return `${props.items} en esta hoja · ${props.enEstaHoja} de ${props.total}`
  }
  return `Total de ${props.items} · ${props.total}`
}

/** 2.K · `ContadorLista`. */
export default function ContadorLista(props: ContadorListaProps): ReactElement {
  return (
    <Text
      style={[
        estilos.contador,
        props.lamina !== undefined && props.lamina !== 'chasis'
          ? estilos.contadorMedido
          : {},
      ]}
    >
      {cadena(props).toUpperCase()}
    </Text>
  )
}
