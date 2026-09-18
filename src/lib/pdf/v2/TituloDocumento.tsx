/**
 * Sistema de documentos v3 — 2.C · **TituloDocumento**. «Nombrar el documento. Es la
 * primera lectura del receptor —farmacia, admisión, laboratorio.»
 *
 * CAMBIO v3 (brief 00 §4): el bloque de título deja de ser una partición de la caja
 * —`ZONA.texto` + `ZONA.riel`, con ocho repartos por lámina— y pasa a ser **una fila
 * de tres celdas** con anchos declarados para las dos de folio y `flex: 1` para el
 * título:
 *
 *     título        flex: 1, mínimo 300     `titulo.documento` 15/18, 0.04 em, maxLines 2
 *     medianil       16
 *     EMISIÓN        74                     rótulo `etiqueta` + valor `titulo.valor`
 *     medianil       16
 *     FOLIO          90                     rótulo `etiqueta` + valor rol `folio`
 *
 * Aire hasta el filete **4**; filete **0.8 negro a todo el ancho, sin segmento
 * grueso**; aire bajo el filete **8** (`transicion.tituloFicha`).
 *
 * ⚠ **EL SEGMENTO GRUESO NO SE REPITE AQUÍ, Y EN v2 SÍ.** El grueso se gasta una vez
 * por hoja y se gasta en el membrete: dos acentos a 14 pt de distancia compiten, y el
 * de arriba es el que identifica al médico. Es lo que hace que la fila de título mida
 * 23 + 4 + 0.8 en vez de 25 + 5 + 2.5.
 *
 * ── LAS TRES VARIANTES DE v2 SE FUSIONAN EN UNA, Y NO SE PIERDE NADA ─────────
 *
 * `fijo`, `variable` y `ausente` se distinguían por **de dónde sale la cadena**
 * —constante del formato, editor del médico, o ninguna—, no por cómo se compone. En
 * v3 el título es una prop opcional: si no viene, su celda no se monta y la fila se
 * queda con las de folio, que es exactamente lo que la variante `ausente` medía (20
 * pt con la fecha sola a la derecha, conservando su filete). Un discriminante que no
 * cambia la composición es ceremonia.
 *
 * ── EL RECORTE NO ES OPCIONAL ────────────────────────────────────────────────
 *
 * `maxLines: 2` + elipsis en el título cierra dos defectos a la vez: el **§7** —la
 * Denegación, cuyo título de dos renglones la echaba de su hoja única— y el **§5.1
 * del Escrito**, con un título de 104 caracteres compuesto a cuatro renglones. Los
 * dos van **dentro del objeto de estilo**: como prop JSX el motor los ignora sin
 * lanzar nada, y el documento sale sin recorte y sin error.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  CAJA,
  FILETE,
  TINTA,
  TITULO_FILA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/** Los dos rótulos del riel, constantes del sistema. Exportados para 2.V. */
export const ETIQUETA_FOLIO = 'Folio'
export const ETIQUETA_EMISION = 'Emisión'

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    /**
     * Por ARRIBA y no por la base. Las celdas de folio arrancan con un rótulo de 9 pt
     * y el título con una caja de 18: alinear por la base dejaría el rótulo del folio
     * 9 pt por debajo del título y la fila mediría 31 en vez de 22.
     */
    alignItems: 'flex-start',
  },
  /**
   * ⚠⚠ **EL ANCHO SE DECLARA, NO SE DEJA A `flexShrink`. MEDIDO.**
   *
   * Un `Text` no encoge por flexbox en este motor: Yoga lo mide por su ancho natural y
   * el reparto no lo reduce, así que `maxLines` no tiene contra qué recortar. Con
   * `flexGrow` + `flexShrink` + `minWidth: 0`, el título de 104 caracteres del Escrito
   * Médico **se imprimía ENCIMA de la celda de emisión**. Lo mismo pasa en la banda de
   * pie; ver `PIE.documento`.
   *
   * El ancho lo calcula el componente restando las celdas que de verdad se montan, así
   * que un formato sin folio le da al título los 540 enteros.
   */
  titulo: {
    flexShrink: 0,
  },
  tituloTexto: {
    ...estiloTipografico('titulo.documento'),
    maxLines: 2,
    textOverflow: 'ellipsis',
  },
  subtitulo: {
    ...estiloTipografico('titulo.subtitulo'),
    marginTop: 1.33,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  celda: {
    flexShrink: 0,
    marginLeft: TITULO_FILA.medianil,
  },
  etiqueta: {
    ...estiloTipografico('etiqueta'),
    textAlign: 'right',
  },
  valor: {
    ...estiloTipografico('titulo.valor'),
    textAlign: 'right',
  },
  aireFilete: { height: TRANSICION.tituloFilete },
  filete: {
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  aireFicha: { height: TRANSICION.tituloFicha },
})

/**
 * Una celda del riel de folio: rótulo en versalita y valor alineado a la derecha.
 *
 * Exportada porque el encabezado de continuación compone la misma pareja a la derecha
 * de su rótulo (2.V), y **la pareja tiene que tener un solo sitio de definición**: son
 * dos roles y una transformación a versalita, y con dos copias bastaría tocar una para
 * que el folio de la hoja 1 y el de la 2 dejaran de parecerse.
 *
 * El rol `folio` va en `acento.tinta`, así que se resuelve en el render y no en la
 * hoja de estilos: misma razón que en 2.B y 2.F.
 *
 * ⚠ **`desviacion` SE RETIRA.** La declaraba una lámina para componer sus dos celdas
 * con otro cuerpo, y en v3 el encabezado de continuación tiene su propio rol
 * (`continuacion.dato`) en vez de desviar este.
 */
export function CeldaFolio({
  etiqueta,
  valor,
  ancho,
  acento,
  esFolio = true,
}: {
  readonly etiqueta: string
  readonly valor: string
  readonly ancho: number
  readonly acento: AcentoResuelto
  /**
   * `true` compone el valor en el rol `folio` —`acento.tinta`, 500—, que es lo que
   * marca un identificador en este sistema. `false` lo compone en `titulo.valor`
   * —negro, 400—, que es lo que pide una fecha: **una emisión no es un folio**, y
   * darle el acento haría que la hoja tuviera dos identificadores.
   */
  readonly esFolio?: boolean
}): ReactElement {
  return (
    <View style={[estilos.celda, { width: ancho }]}>
      <Text style={estilos.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <Text
        style={
          esFolio
            ? { ...estiloTipografico('folio', acento), textAlign: 'right' }
            : estilos.valor
        }
      >
        {valor}
      </Text>
    </View>
  )
}

export interface TituloDocumentoProps {
  /**
   * El nombre del documento, en capitalización de oración: se compone en mayúsculas
   * aquí. Sin él, su celda no se monta y la fila se queda con el riel — que es la
   * variante `ausente` del Escrito médico. Ver la cabecera.
   */
  readonly titulo?: string
  /**
   * Subtítulo. **Dos formatos y sólo dos**: Cotización y Denegación, donde nombra el
   * procedimiento cotizado o revocado. El Consentimiento ya no lo compone —su
   * procedimiento vive en la ficha— y con eso se recuperan 13 pt en el formato más
   * largo del sistema.
   */
  readonly subtitulo?: string
  /** Fecha y hora de emisión, YA compuestas por quien llama. Colapsa si no viene. */
  readonly emision?: string
  /** Folio del documento. Colapsa si no viene — una vista previa aún no lo tiene. */
  readonly folio?: string
  readonly acento: AcentoResuelto
}

/** 2.C · `TituloDocumento`. */
export default function TituloDocumento({
  titulo,
  subtitulo,
  emision,
  folio,
  acento,
}: TituloDocumentoProps): ReactElement {
  const hayTitulo = titulo !== undefined && titulo.trim() !== ''
  const hayEmision = emision !== undefined && emision.trim() !== ''
  const hayFolio = folio !== undefined && folio.trim() !== ''

  /**
   * DERIVADO: la caja menos las celdas que de verdad se montan, con su medianil. Con
   * las dos, 540 − 104 − 112 = 324, por encima del mínimo de 300 que declara el brief.
   */
  const anchoTitulo =
    CAJA.ancho -
    (hayEmision ? TITULO_FILA.medianil + TITULO_FILA.emision : 0) -
    (hayFolio ? TITULO_FILA.medianil + TITULO_FILA.folio : 0)

  return (
    <View>
      <View style={estilos.fila}>
        {/*
          La celda del título lleva `minWidth` por el mínimo de 300 del brief y no una
          anchura fija: con las dos celdas de folio montadas le quedan 334 pt, y sin
          ninguna se queda con los 540. Declarar el ancho la ataría a que las dos
          celdas existan.
        */}
        {hayTitulo ? (
          <View style={[estilos.titulo, { width: anchoTitulo }]}>
            <Text style={[estilos.tituloTexto, { width: anchoTitulo }]}>
              {titulo!.toUpperCase()}
            </Text>
            {subtitulo === undefined || subtitulo.trim() === '' ? null : (
              <Text style={[estilos.subtitulo, { width: anchoTitulo }]}>{subtitulo}</Text>
            )}
          </View>
        ) : (
          // Sin título, la celda sigue existiendo como espaciador flexible: es lo que
          // empuja el riel al borde derecho en vez de dejarlo pegado al margen izquierdo.
          <View style={estilos.titulo} />
        )}

        {!hayEmision ? null : (
          <CeldaFolio
            etiqueta={ETIQUETA_EMISION}
            valor={emision!}
            ancho={TITULO_FILA.emision}
            acento={acento}
            esFolio={false}
          />
        )}

        {!hayFolio ? null : (
          <CeldaFolio
            etiqueta={ETIQUETA_FOLIO}
            valor={folio!}
            ancho={TITULO_FILA.folio}
            acento={acento}
          />
        )}
      </View>

      <View style={estilos.aireFilete} />
      <View style={estilos.filete} />
      <View style={estilos.aireFicha} />
    </View>
  )
}
