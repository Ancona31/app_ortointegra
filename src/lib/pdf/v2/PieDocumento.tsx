/**
 * Sistema de documentos v3 — 2.M · **PieDocumento**. «Atar cada hoja al documento
 * del que salió.» Va en todas las hojas, con `fixed`.
 *
 * CAMBIOS v3 (brief 00 §7):
 *
 *   posición    `left: 72, right: 54, bottom: 36` → **36 / 36 / 36**
 *   zonas       folio · paginación · leyenda → folio · paginación · **nombre del
 *               documento** · leyenda
 *
 * **LA ZONA DE NOMBRE DEL DOCUMENTO ES NUEVA Y CIERRA EL DEFECTO §9.5**: la variante
 * `sinFolio` —Internamiento y Escrito— dejaba media barra vacía, con la paginación
 * sola a la izquierda y la leyenda a la derecha. Ahora las dos variantes componen
 * cuatro zonas o tres, y ninguna deja hueco.
 *
 * LO QUE NO CAMBIA: el alto de 16, el relleno lateral de 8, el fondo en
 * `acento.banda` —derivado a 7 : 1 sobre blanco, que es lo que hace legible el
 * `tinta.papel` de encima—, la leyenda constante del sistema y el `fixed` de la
 * regla 1. Sin `fixed` el pie sale sólo en la hoja donde se declaró.
 *
 * ⚠ **EL ALTO Y EL ANCLAJE VIVEN AHORA EN `tokens.ts`** (`PIE`, `PIE_ANCLAJE`), y no
 * es cosmético: de ellos sale `MARGEN.inferior`. Con las cifras escritas aquí, mover
 * el pie dejaba el margen apuntando a un hueco que ya no existía.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  PAPEL,
  PIE,
  PIE_ANCLAJE,
  ZONA_SEGURA,
  estiloTipografico,
  type AcentoResuelto,
  SIN_ENCOGER,
} from './tokens'

/** Constantes del sistema. Las tres son textuales y ninguna se parametriza. */
const LEYENDA = 'Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx'
const ROTULO_FOLIO = 'Folio'
const ROTULO_PAGINA = 'Página'
const DE = 'de'

const estilos = StyleSheet.create({
  banda: {
    position: 'absolute',
    left: ZONA_SEGURA,
    right: ZONA_SEGURA,
    bottom: PIE_ANCLAJE.banda,
    height: PIE.alto,
    paddingHorizontal: PIE.relleno,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Folio y paginación no encogen: son los dos datos que se citan por teléfono. */
  fijo: {
    ...estiloTipografico('pie'),
    flexShrink: SIN_ENCOGER,
  },
  /** La caja de la paginación: es la que lleva la geometría, porque es dinámica. */
  celdaPaginacion: {
    flexShrink: SIN_ENCOGER,
    marginLeft: PIE.medianil,
  },
  paginacion: { ...estiloTipografico('pie') },
  /**
   * La zona nueva. Es la ÚNICA que encoge, y las tres claves del §15 del brief están
   * las tres: `flexGrow` para que ocupe el sobrante, `flexShrink` + `minWidth: 0`
   * para que Yoga la deje encoger por debajo de su ancho natural, y el recorte por
   * elipsis DENTRO del objeto de estilo — como prop se ignora en silencio.
   */
  documento: {
    ...estiloTipografico('pie'),
    /**
     * ⚠ **ANCHO DECLARADO, Y NO `flexGrow` + `flexShrink` + `minWidth: 0`. MEDIDO.**
     *
     * Las tres claves del §15 del brief no acotan un `Text` en este motor: Yoga lo mide
     * por su ancho NATURAL y el reparto no lo encoge, así que `maxLines` no tiene contra
     * qué recortar. Comprobado con las cuatro formas —`flexShrink`, `flexBasis: 0`,
     * envoltorio con `overflow: hidden`, y `width`—: **sólo recorta con `width`.**
     *
     * Sin esto, en el Consentimiento el nombre del documento se imprimía ENCIMA de la
     * leyenda. Ver `PIE.documento`.
     */
    width: PIE.documento,
    flexShrink: SIN_ENCOGER,
    marginLeft: PIE.medianil,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  /** Absorbe el sobrante de la banda y se queda pegada al borde derecho. */
  leyenda: {
    ...estiloTipografico('pie.leyenda'),
    flexGrow: 1,
    flexShrink: SIN_ENCOGER,
    marginLeft: PIE.medianil,
    textAlign: 'right',
  },
})

export type PieDocumentoProps =
  /**
   * Folio · paginación · nombre · leyenda. **Tres formatos**: Receta, Recibo de
   * honorarios y Cotización — las tres ventanillas que verifican de forma rutinaria
   * y que citan el número cuando algo no cuadra.
   */
  | {
      variante: 'completo'
      folio: string
      /** Nombre del documento, en capitalización de oración. Lo redacta el formato. */
      documento: string
      acento: AcentoResuelto
    }
  /**
   * Paginación · nombre · leyenda. Los formatos cuyo folio no se cita en ninguna
   * ventanilla: Internamiento y Escrito médico.
   */
  | {
      variante: 'sinFolio'
      documento: string
      acento: AcentoResuelto
    }

/** 2.M · `PieDocumento`. */
export default function PieDocumento(props: PieDocumentoProps): ReactElement {
  return (
    // `fixed`: regla 1. La banda es del DOCUMENTO, no de la hoja donde se declaró.
    <View style={[estilos.banda, { backgroundColor: props.acento.banda }]} fixed>
      {props.variante === 'completo' ? (
        <Text style={estilos.fijo}>{`${ROTULO_FOLIO} ${props.folio}`}</Text>
      ) : null}

      {/*
        LA PAGINACIÓN SE COMPONE CON `render` Y NO CON UN CONTADOR PROPIO.

        `subPageNumber` / `subPageTotalPages` cuentan las hojas de ESTE elemento de
        página; `pageNumber` / `totalPages` las del `Document` entero. Aquí se usan las
        primeras cuando existen, que es lo que hace que un `Page` de testigos o de
        anexo —que son elementos propios, brief 00 §9.5— no reinicie la cuenta del
        documento: los dos formatos que los componen quieren la numeración GLOBAL, y
        `pageNumber` es la que la da.

        ⚠ El brief §15 pide `render` en el CONTENEDOR y las zonas también como hijos
        estáticos. No se compone así: en este motor `render` **sustituye** a los hijos,
        de modo que un `View` con las dos cosas imprime sólo lo que devuelve `render` y
        las zonas estáticas se pierden en silencio. Se pone `render` en el `Text` que
        de verdad depende de la hoja, que es el patrón que el motor documenta. Ver
        `dudas.md` §6.
      */}
      {/*
        ⚠ EL `Text` EXTERIOR NO LLEVA ROL: un nodo dinámico con `lineHeight` no compone
        nada y no avisa. El rol va en el `Text` que devuelve. Ver la nota de 2.K.
      */}
      <Text
        style={estilos.celdaPaginacion}
        render={({ pageNumber, totalPages }) => (
          <Text style={estilos.paginacion}>
            {`${ROTULO_PAGINA} ${pageNumber} ${DE} ${totalPages}`.toUpperCase()}
          </Text>
        )}
      />

      <Text
        style={[
          estilos.documento,
          // La variante sin folio no compone esa celda: su ancho pasa al nombre.
          props.variante === 'completo' ? {} : { width: PIE.documentoSinFolio },
        ]}
      >
        {props.documento}
      </Text>

      <Text style={estilos.leyenda}>{LEYENDA}</Text>
    </View>
  )
}

/**
 * El ancho vivo de la banda, para quien tenga que medir contra ella.
 *
 * DERIVADO y exportado por la misma razón que `PANEL_DIAMETRO`: si alguien lo
 * recalcula por su cuenta y el anclaje cambia, mide contra un pie que ya no existe.
 */
export const PIE_ANCHO = PAPEL.ancho - 2 * ZONA_SEGURA - 2 * PIE.relleno
