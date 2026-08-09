/**
 * Sistema de documentos v2 — componente 2.R · `ZonaQR`.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada de Receta**,
 * con `DOCUMENTOS_SPEC.md` I.2 · 2.R como ficha de referencia. Donde las dos dicen
 * cosas distintas manda la lámina, y son tres sitios: el marco, el medianil y el
 * ancho de la caja de texto. Están listados abajo.
 *
 * Propósito: verificación por terceros — farmacia, hospital, aseguradora.
 *
 * LAS TRES REGLAS DE LA FICHA, Y CUÁL DE ELLAS SE IMPLEMENTA AQUÍ
 *
 * 1. **La zona de QR vive en el cuerpo de la última hoja, no en el pie.** El pie
 *    lleva el folio como texto (2.M); el QR es un bloque de contenido. Aquí eso es
 *    una ausencia: este archivo no tiene `position: absolute`, no tiene `fixed` y
 *    no sabe nada de la banda. Lo coloca el formato, en su fila de cierre.
 * 2. **Solo en la última hoja, una vez por documento.** No se implementa aquí y no
 *    se puede: este componente no sabe en qué hoja está. Lo garantiza el formato al
 *    instanciarlo una sola vez y al final del flujo, que es donde el renderer lo
 *    deja caer.
 * 3. **En el QR va únicamente el token de acceso, nunca el folio ni datos del
 *    paciente.** Tampoco se implementa aquí: el ráster llega ya generado, igual que
 *    el logo del panel en 2.A (regla 2 de aquella ficha). Este componente coloca una
 *    imagen; **quien la genera es responsable de qué codifica**. Si algún día ves un
 *    `QRCode.toDataURL()` en este archivo, la regla 3 dejó de tener un solo sitio
 *    donde vigilarse.
 *
 * LO QUE LA LÁMINA CONTRADICE DE 2.R, Y GANA LA LÁMINA
 *
 * a. ⚠ **SIN MARCO.** La ficha compone la zona dentro de un `MarcoParcial` (2.U) con
 *    padding `12 14 14`, y la lámina aprobada **no dibuja ningún filete alrededor**:
 *    el QR va suelto sobre el papel y el texto a su izquierda. Se compone sin marco
 *    y queda **reportado**, porque la contradicción no es menor: 2.U declara que su
 *    verificación visible es «poner juntas la `ZonaQR` de una receta y la caja de
 *    aseguradora de un recibo: el marco es idéntico en las dos». Con esta lámina esa
 *    comprobación no se puede hacer — la receta no tiene marco que comparar. Si la
 *    decisión de producto repone el marco, vuelve envolviendo este componente desde
 *    fuera y sin tocar su geometría interna.
 * b. **Medianil 12, no 14.** Entre la caja de texto y el QR.
 * c. **La caja de texto no lleva ancho declarado**, ni el 132 de la ficha ni el 86.27
 *    que mide la lámina: mide su contenido y se ancla por la derecha. Ver la nota
 *    larga junto a `estilos.texto` — el 86.27 es más estrecho que el folio que tiene
 *    que contener, y con él el folio se metía debajo del QR en el impreso.
 * d. **Sin leyenda.** La ficha declara una leyenda en IBM Plex Sans 9 / 13 pt bajo la
 *    etiqueta, y la lámina no la imprime. La ranura no se construye: un miembro sin
 *    consumidor es deuda. Cuando aparezca una lámina que la componga, se mide y se
 *    abre. **Reportado.**
 *
 * LA DECISIÓN DE ANGEL, QUE VA CONTRA LO MEDIDO
 *
 * ⚠ **EL FILETE CORTO SE RETIRA.** Entre el rótulo y el folio, este bloque componía
 * un filete corto en acento. Lo declara la ficha de 2.R —«filete corto sobre el
 * folio: 40 × `filete.cita`, `acento.base`, margen superior 10 pt»— y lo compone el
 * archivo de diseño de Claude Design. La lámina que Angel tiene delante no lo lleva y
 * el bloque se lee más limpio sin él.
 *
 * Queda escrito con su valor, que es todo lo que hace falta para reponerlo:
 *
 *     ancho    40 pt
 *     grosor   `filete.cita` (1.6 pt)
 *     color    `acento.base`
 *     margen   `espacio.10` por arriba
 *
 * **Y CON ÉL SE VA SU MARGEN, QUE ERA SUYO Y NO DEL PAR.** Es la mitad de la
 * corrección y la que no se ve en la ficha: esos 10 pt eran el aire que el filete
 * guardaba con el rótulo, no una separación declarada entre los dos renglones.
 * Quitar el filete conservando el margen habría dejado 10 pt sosteniendo algo que ya
 * no está — dos renglones sueltos donde tiene que haber un bloque.
 *
 * Lo que queda entre los dos es **cero**, y no es una cifra elegida: es lo que el
 * sistema compone para un par rótulo + valor en los tres sitios donde ya existe —la
 * celda de 2.F, el campo de 2.E y, **con estos dos mismos roles y en este mismo
 * orden**, la celda del riel de folio de 2.C—. Aquella mide 25 pt en las dos láminas
 * medidas —11 de rótulo más 14 de valor—, que es exactamente lo que mide este bloque
 * ahora. `DERIVADO POR PRECEDENTE`, no medido en esta zona.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { estiloTipografico, type AcentoResuelto, type Lamina } from './tokens'

/**
 * Geometría de ESTE componente, medida en la lámina. I.1.7: la geometría interna
 * vive en la ficha del componente y no en la escala.
 *
 * **La posición del QR sale sola y no se escribe.** La lámina lo sitúa en `x = 502`
 * y el borde derecho de la caja de texto está en 558 —`papel.ancho − margen.derecho`—,
 * así que 502 + 56 = 558 exacto. Alineando el grupo a la derecha de la fila de
 * cierre, el 502 aparece sin declararlo: escribirlo sería fijar una posición
 * absoluta que ya está determinada por el margen y por los dos anchos.
 */
const GEOMETRIA = {
  qr: 56,
  /** Caja de texto → QR. La ficha declara 14. */
  medianil: 12,
  /**
   * LA DISPOSICIÓN DE LA LÁMINA DE HONORARIOS — **AL REVÉS, Y CON ANCHO**.
   *
   * Allí el QR va a la IZQUIERDA y el texto a su derecha, en una caja de 146 pt. Las
   * tres cifras cierran la columna estrecha de su fila de cierre sin declararla:
   * 56 + 14 + 146 = **216** = `cierre.derecha`, que es donde vive la firma de ese
   * formato y bajo la que se apoya esta zona.
   *
   * **No es una variante de diseño: es que en esa hoja la zona no cuelga del borde
   * derecho de la caja.** En Receta el grupo se ancla a la derecha del papel y por eso
   * el texto crece hacia la izquierda sin ancho declarado; aquí abre una columna, así
   * que lo que se ancla es el borde IZQUIERDO y el texto necesita medida propia o se
   * comería el hueco de la firma.
   *
   * ⚠ El medianil son 14 y no los 12 de Receta. Es lo que mide B.5 §5 —y, otra vez, lo
   * que la ficha de 2.R declaraba antes de que Receta lo desmintiera—. Reportado.
   */
  honorarios: { medianil: 14, texto: 146 },
} as const

const estilos = StyleSheet.create({
  /**
   * `alignItems: 'flex-end'` apoya el texto y el QR por su BORDE INFERIOR, que es
   * como la fila de cierre apoya sus dos columnas. El bloque de texto mide 25 pt y
   * el QR 56: sin esto el texto quedaría flotando arriba, contra nada.
   *
   * `DERIVADO, NO MEDIDO` — la lámina declara el reparto horizontal (medianil 12) y
   * el vertical no. Se toma el mismo que la fila que los contiene, que es la única
   * alineación que el documento ya declara para esta zona. Reportado.
   */
  zona: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  /**
   * EL BLOQUE DE TEXTO NO DECLARA ANCHO, Y ES LA CORRECCIÓN DE UN DEFECTO IMPRESO.
   *
   * ⚠ **DECÍA 86.27 pt Y EL FOLIO NO CABE EN ESO.** El folio de la propia lámina,
   * `P-B8570E3FA164`, compone **94.56 pt** en el rol `folio` —Archivo 11 pt, peso
   * 500, tracking 0.03 em—, medido sobre el PDF real. Son **8.29 pt de más** que la
   * caja. Y como es un identificador sin espacios y la hifenación está desactivada
   * (`fonts.ts`), no hay dónde romperlo: el renglón no envuelve, **desborda por la
   * derecha y se mete debajo del QR**, que empieza 12 pt más allá.
   *
   * **El dato no es el problema:** el folio del taller tiene los mismos 14
   * caracteres y compone 97.14 pt, así que fijar la caja en 94.56 solo movería el
   * defecto al siguiente folio. Un ancho fijo es la construcción equivocada aquí.
   *
   * Sin `width`, el bloque mide lo que mida su pieza más ancha —hoy el folio— y crece
   * hacia la IZQUIERDA, porque su borde derecho está anclado por lo que tiene a la
   * derecha: `caja.ancho − qr − medianil`. **El QR no se mueve**: sigue abriendo
   * donde la lámina lo mide.
   *
   * Holgura antes de tocar la firma: `caja.ancho − cierre.izquierda − medianil − qr`
   * = 172 pt, contra los 94.56 que ocupa hoy. Un folio tendría que doblar su largo
   * para agotarla, y entonces lo que hay que revisar es el generador de folios.
   *
   * ⚠ **DE DÓNDE SALÍA EL 86.27, Y QUEDA SIN EXPLICAR.** Es una medida de la lámina y
   * no una cifra elegida —lo dice su fracción—, pero **no puede ser el ancho de un
   * bloque que contiene este folio**, porque es menor que él. O la lámina compone ese
   * folio a un cuerpo por debajo del rol `folio` que 2.R le asigna —a 11 pt no cabe,
   * a 10 sí—, o lo medido fue otro elemento. Reportado.
   *
   * ALINEACIÓN A LA DERECHA — hacen falta las dos declaraciones y no una.
   *
   * `alignItems: 'flex-end'` alinea las CAJAS: con el bloque midiendo su contenido,
   * cada renglón es tan ancho como su texto y es esto lo que los pega al borde
   * derecho. Es la que actúa hoy, y la que actuaba sobre el filete corto cuando
   * existía —una caja de 40 pt a la que `textAlign` no le decía nada—.
   *
   * `textAlign: 'right'` en los dos renglones es para el día en que uno envuelva a
   * dos líneas: entonces su caja ocupa el bloque entero y es él quien alinea los
   * glifos dentro. **No sobra por no actuar hoy** — sin él, un folio que envolviera
   * saldría con la segunda línea pegada a la izquierda.
   */
  texto: {
    marginRight: GEOMETRIA.medianil,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  /**
   * La caja de texto de Honorarios: ancho declarado, a la derecha del QR y alineada
   * por la izquierda. Es la imagen especular de la de arriba, y por eso sus dos
   * declaraciones también lo son. Ver `GEOMETRIA.honorarios`.
   */
  textoHonorarios: {
    width: GEOMETRIA.honorarios.texto,
    marginLeft: GEOMETRIA.honorarios.medianil,
    flexShrink: 0,
    alignItems: 'flex-start',
  },
  rotulo: { ...estiloTipografico('etiqueta'), textAlign: 'right' },
  rotuloHonorarios: { textAlign: 'left' },
  /**
   * El folio va PEGADO a su rótulo, sin margen. Los 11.6 pt que había entre los dos
   * —10 de margen más 1.6 de filete— eran del filete y se fueron con él; ver la
   * cabecera. Si alguien vuelve a poner un margen aquí, que sea porque midió algo.
   */
  folio: { textAlign: 'right' },
  folioHonorarios: { textAlign: 'left' },
  /**
   * El ráster, sin marco y sin fondo. `objectFit: 'contain'` conserva la proporción
   * del código: un QR estirado deja de leerse, que es lo único que este bloque tiene
   * que hacer.
   */
  qr: {
    width: GEOMETRIA.qr,
    height: GEOMETRIA.qr,
    flexShrink: 0,
    objectFit: 'contain',
  },
})

export interface ZonaQRProps {
  /**
   * El ráster del código, ya generado y normalizado a PNG o JPG por quien llama
   * (I.3.8, y regla 2 de 2.A por analogía). **Lo que codifica es cosa suya**: la
   * regla 3 de la ficha exige que sea el token de acceso y nada más.
   */
  readonly qr: string
  /** `Verificación`. En capitalización de oración: la versalita la pone el render. */
  readonly rotulo: string
  /** El folio del documento, ya compuesto. Este componente no decide su forma. */
  readonly folio: string
  /** El filete corto y el folio van en acento. */
  readonly acento: AcentoResuelto
  /** Qué lámina fija la disposición. Sin ella, la de Receta: texto a la izquierda. */
  readonly lamina?: Lamina
}

/** 2.R · `ZonaQR`. */
export default function ZonaQR({
  qr,
  rotulo,
  folio,
  acento,
  lamina = 'chasis',
}: ZonaQRProps): ReactElement {
  const honorarios = lamina === 'honorarios'

  /* `Image` de react-pdf: no admite `alt` y su salida es un PDF, no un DOM. */
  /* eslint-disable-next-line jsx-a11y/alt-text */
  const codigo = <Image src={qr} style={estilos.qr} />

  const texto = (
    <View style={honorarios ? estilos.textoHonorarios : estilos.texto}>
      <Text style={[estilos.rotulo, honorarios ? estilos.rotuloHonorarios : {}]}>
        {rotulo.toUpperCase()}
      </Text>
      {/*
        AQUÍ IBA EL FILETE CORTO. Ver `FILETE_RETIRADO` antes de reponerlo: la ficha
        de 2.R lo declara, la lámina de Honorarios lo compone —40 × 1.6 en acento— y
        la de Receta no lo lleva. **Se mantiene retirado en las dos**: es decisión de
        Angel sobre el bloque, no sobre un formato. Reportado.
      */}
      {/*
        El folio va en el rol `folio`, que es `acento.tinta`: se resuelve en el
        render y se esparce en un literal, por la misma razón de tipos que en 2.B,
        2.C, 2.D, 2.F y 2.G.

        ⚠ La lámina de Honorarios lo compone a **10 / 14** y el rol va a 11 / 14. Se
        compone el rol —es el mismo folio que imprime la banda de pie y el riel del
        título de esa misma hoja— y queda reportado.
      */}
      <Text
        style={{
          ...estiloTipografico('folio', acento),
          ...(honorarios ? estilos.folioHonorarios : estilos.folio),
        }}
      >
        {folio}
      </Text>
    </View>
  )

  return (
    <View style={estilos.zona} wrap={false}>
      {/* Las dos disposiciones son el mismo par en el orden inverso. */}
      {honorarios ? (
        <>
          {codigo}
          {texto}
        </>
      ) : (
        <>
          {texto}
          {codigo}
        </>
      )}
    </View>
  )
}
