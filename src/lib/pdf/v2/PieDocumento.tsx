/**
 * Sistema de documentos v2 — componente 2.M · `PieDocumento`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.M. Transcripción, no diseño.
 *
 * Propósito: atar cada hoja al documento del que salió.
 *
 * REGLA 1 — EN TODAS LAS HOJAS, SIN EXCEPCIÓN
 *
 * Es el hallazgo más grave de la auditoría del sistema viejo: un consentimiento
 * de cuatro hojas firmado solo en la última no tenía nada que atara la hoja 1 a
 * la de firmas. Aquí se implementa con `fixed`, que hace que react-pdf repita el
 * nodo en cada hoja del documento. **No lo quites para «ahorrar» en la última.**
 *
 * DÓNDE VIVE LA BANDA — LO QUE MÁS SE EQUIVOCA
 *
 * **Fuera de la caja de texto y dentro de la zona segura.** No se mide desde el
 * borde de la caja: se ancla al papel —`left: margen.izquierdo`,
 * `right: margen.derecho`, `bottom: zona.segura`— y por eso vive en el hueco que
 * el margen inferior reserva y ningún bloque de contenido ocupa.
 *
 * El desglose está en I.1.2 y es lo que hace verdadera la regla 5:
 *
 *     margen.inferior = 68 = 36 (papel intocable) + 16 (banda) + 16 (aire)
 *
 * Es decir: la banda ocupa de 36 a 52 pt del borde inferior, el contenido se
 * detiene a 68, y entre los dos quedan 16 pt de aire — `transicion.contenidoPie`.
 * **La página tiene que declarar `paddingBottom: margen.inferior`** o la garantía
 * se cae y el pie se solapa con lo último que haya, que es el bug §8.1.
 *
 * REGLA 3 — LA ÚNICA BARRA SÓLIDA ADMITIDA EN EL SISTEMA
 *
 * I.3.2 prohíbe las barras de color sólido a todo lo ancho. Esta es la excepción
 * declarada, y lo es **por sus tres cotas**: 16 pt de alto, `acento.banda`
 * calculado a 7 : 1 sobre blanco, y no cruza la zona segura. Quitarle cualquiera
 * de las tres la convierte en lo que I.3.2 prohíbe.
 *
 * ⚠️ POR QUÉ EL `render` VA EN LA BANDA Y NO SOLO EN LA PAGINACIÓN
 *
 * Porque sin él la zona 2 sale VACÍA, sin error y sin aviso. Está medido
 * descomprimiendo el flujo de contenido de un PDF real, no supuesto:
 *
 * 1. Un `lineHeight` numérico es un MULTIPLICADOR del cuerpo, y react-pdf lo
 *    resuelve a puntos al montar la página: 11 / 7 → 11 pt.
 * 2. Cada nodo con `render` obliga al renderer a **recomponer la página entera**
 *    —una vez por corte de hoja y otra al saber el total—, y en cada pasada
 *    vuelve a resolver estilos YA resueltos. El multiplicador se aplica otra vez:
 *    11 → 77 → 539 pt.
 * 3. Los demás nodos no lo notan porque conservan sus líneas ya maquetadas. El
 *    nodo con `render` es el único al que se le tiran para recomponerlas, y a
 *    539 pt de interlineado **su línea ya no cabe en una banda de 16**: el
 *    maquetador devuelve cero líneas y la zona queda muda.
 *
 * Poniendo el `render` en la BANDA, sus tres zonas se vuelven a crear desde cero
 * en cada pasada, con el estilo literal sin resolver: se resuelve una sola vez
 * por pasada y el multiplicador nunca se acumula. La alternativa —quitarle el
 * interlineado a la paginación— también imprime, pero la deja 1.65 pt más abajo
 * que el folio, que está a su lado y en el mismo rol.
 *
 * **Vale para cualquier componente del chasis que use `render`.** 2.N lo va a
 * necesitar para sus tres avisos de pie.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  MARGEN,
  TIPOGRAFIA,
  ZONA_SEGURA,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría de la banda, de la ficha de 2.M. Ninguno de los tres es miembro de
 * una escala y los tres son `COINCIDENCIA` con tokens que valen lo mismo:
 *
 * - `alto` 16 pt coincide con `espacio.16` y con `reticula.lineaBase`. Es una de
 *   las tres cotas que hacen admisible la barra (regla 3): mover la escala de
 *   espaciado no debe poder engordar la banda.
 * - `medianil` 10 pt y `paddingLateral` 8 pt no son miembros de nada.
 */
const GEOMETRIA = {
  alto: 16,
  medianil: 10,
  paddingLateral: 8,
} as const

/**
 * Zona 3, invariable en los ocho formatos (ficha de 2.M, tabla de cadenas).
 *
 * **No entra por prop.** Si la declarara cada formato, el sistema acabaría con
 * ocho leyendas distintas — que es exactamente la deriva que 2.N concilia en los
 * avisos de pie (`CONCILIA D5, D22`). Se guarda como se imprime.
 */
const LEYENDA =
  'Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx'

/**
 * La versalita del sistema, leída de `etiqueta` en vez de escrita como cifra. Es
 * la desviación declarada **`pie` en versalita** (I.1.4), la misma que consume
 * 2.K — con el color puesto por el sitio, que aquí es `tinta.papel` porque el
 * texto va sobre la banda de acento.
 */
const VERSALITA = {
  peso: TIPOGRAFIA.etiqueta.peso,
  tracking: TIPOGRAFIA.etiqueta.tracking,
} as const

const estilos = StyleSheet.create({
  banda: {
    position: 'absolute',
    left: MARGEN.izquierdo,
    right: MARGEN.derecho,
    bottom: ZONA_SEGURA,
    height: GEOMETRIA.alto,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GEOMETRIA.paddingLateral,
  },
  /** Zona 1 y zona 2 miden lo que su contenido: la retícula es `auto auto 1fr`. */
  zonaAuto: {
    flexShrink: 0,
  },
  /**
   * El medianil lo lleva SIEMPRE la zona que va segunda, nunca la primera: en
   * `sin folio` la paginación pasa a la zona 1 y ahí no tiene nada a la
   * izquierda de lo que separarse.
   */
  separacion: {
    marginLeft: GEOMETRIA.medianil,
  },
  folio: { ...estiloTipografico('pie') },
  /** Zona 2: `pie` en versalita, aquí en `tinta.papel`. */
  paginacion: {
    ...estiloTipografico('pie'),
    fontWeight: VERSALITA.peso,
    letterSpacing: VERSALITA.tracking * TIPOGRAFIA.pie.cuerpo,
  },
  /** Zona 3: `1fr`, alineada a la derecha. */
  leyenda: {
    ...estiloTipografico('pie.leyenda'),
    flex: 1,
    textAlign: 'right',
    marginLeft: GEOMETRIA.medianil,
  },
})

interface Comun {
  /** La banda va en `acento.banda`, derivado a 7 : 1 sobre blanco. */
  acento: AcentoResuelto
}

export type PieDocumentoProps =
  /**
   * Folio · paginación · leyenda. **Tres formatos**: Receta (II.3), Recibo de
   * Honorarios / Cotización (II.5) y Consentimiento (II.7) — los tres que
   * circulan hacia un tercero que puede citar el número.
   *
   * El `folio` entra ya compuesto: **2.M no decide su forma** y no la valida.
   */
  | ({ variante: 'completo'; folio: string } & Comun)
  /**
   * Paginación · título del documento · leyenda. **Cinco formatos**, que son
   * mayoría: Laboratorio (II.1), Imagenología (II.2), Suplementación (II.4),
   * Internamiento (II.6) y Escrito Médico (II.8).
   *
   * No es la excepción de un formato raro: es el caso corriente. Un folio solo
   * sirve donde alguien de fuera lo cita, y estos cinco no salen a esa
   * circulación (regla 4).
   */
  | ({ variante: 'sinFolio'; titulo: string } & Comun)

/**
 * `Página X de Y` (regla 2), compuesta en mayúsculas por la versalita del rol —
 * la misma convención que 2.C, 2.H y 2.K: la cadena se guarda en capitalización
 * de oración y la transformación ocurre aquí.
 *
 * **Las cifras las pone el renderer, no quien llama:** el total de hojas no
 * existe hasta que el flujo ha terminado de repartir. Se leen de `subPage*`, que
 * cuenta las hojas de ESTE documento; `pageNumber` cuenta las del PDF entero y
 * solo coincide porque **un formato se compone con un único elemento `Page`**.
 * Si algún día uno declara dos, esta cuenta es la correcta y la otra mentiría.
 */
function paginacion({
  subPageNumber,
  subPageTotalPages,
}: {
  subPageNumber: number
  subPageTotalPages: number
}): string {
  return `Página ${subPageNumber} de ${subPageTotalPages}`.toUpperCase()
}

/**
 * Las tres zonas en el orden que declara cada variante. Lo que cambia entre las
 * dos es **qué ocupa cada zona**, no cómo se compone: la paginación conserva su
 * versalita al pasar a la zona 1, y el título ocupa la zona que el folio deja
 * libre con el rol que el folio usaba, `pie`.
 */
function zonas(props: PieDocumentoProps): ReactElement[] {
  const leyenda = (
    <Text key="leyenda" style={estilos.leyenda}>
      {LEYENDA}
    </Text>
  )

  if (props.variante === 'completo') {
    return [
      <Text
        key="folio"
        style={[estilos.folio, estilos.zonaAuto]}
      >{`Folio ${props.folio}`}</Text>,
      <Text
        key="paginacion"
        style={[estilos.paginacion, estilos.zonaAuto, estilos.separacion]}
        render={paginacion}
      />,
      leyenda,
    ]
  }

  return [
    <Text
      key="paginacion"
      style={[estilos.paginacion, estilos.zonaAuto]}
      render={paginacion}
    />,
    <Text key="titulo" style={[estilos.folio, estilos.zonaAuto, estilos.separacion]}>
      {props.titulo}
    </Text>,
    leyenda,
  ]
}

/** 2.M · `PieDocumento`. */
export default function PieDocumento(props: PieDocumentoProps): ReactElement {
  return (
    // `fixed`: regla 1. Sin él, el pie sale solo en la hoja donde se declaró.
    //
    // `render` MÁS los mismos hijos declarados, y las dos cosas hacen falta:
    //
    // - El `render` es lo que imprime. Ver la nota larga de la cabecera.
    // - Los hijos NO se componen —el renderer los descarta y se queda con lo que
    //   devuelve el `render`—, pero son lo único que ve el **prebúsqueda de
    //   tipografías**, que recorre el árbol declarado ANTES de que ningún
    //   `render` haya corrido y carga las familias que encuentra. Sin ellos, las
    //   tres zonas piden una familia que nadie cargó y el maquetador cae a la
    //   tipografía por defecto del renderer: la banda sale en Helvetica, con las
    //   demás anchuras, y **sin lanzar nada**. Medido leyendo el `/BaseFont` del
    //   PDF (I.3.8).
    //
    // El relleno es `acento.banda`, derivado a 7 : 1 sobre blanco (I.1.8), y
    // entra aquí y no en la hoja de estilos porque depende del acento del médico.
    <View
      style={[estilos.banda, { backgroundColor: props.acento.banda }]}
      fixed
      render={() => zonas(props)}
    >
      {zonas(props)}
    </View>
  )
}
