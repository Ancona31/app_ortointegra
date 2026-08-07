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
 * La paginación se compone con la función `render` del renderer, que es lo único
 * que conoce la Y real: el total de hojas no se sabe hasta que el motor de flujo
 * ha terminado de repartir (regla 2).
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
  /** Cadena corta de cierre. La declara el formato. */
  leyenda: string
  /** La banda va en `acento.banda`, derivado a 7 : 1 sobre blanco. */
  acento: AcentoResuelto
}

export type PieDocumentoProps =
  /** Folio · paginación · leyenda. Siete de los ocho formatos. */
  | ({ variante: 'completo'; folio: string } & Comun)
  /**
   * Paginación · título del documento · leyenda. **Solo Escrito Médico**, que no
   * es un documento seriado: sin folio no hay identificador humano que mostrar en
   * la página de verificación, y por eso tampoco lleva QR.
   *
   * Está declarada para que **nadie reponga el folio por consistencia mal
   * entendida** (regla 4). Si ves un folio en un Escrito Médico, alguien inventó
   * una serie que no existe.
   */
  | ({ variante: 'sinFolio'; titulo: string } & Comun)

/**
 * `PÁGINA X DE Y` (regla 2). La Y la pone el renderer, no quien llama: es el
 * único que sabe en cuántas hojas acabó repartido el contenido.
 */
function paginacion({
  pageNumber,
  totalPages,
}: {
  pageNumber: number
  totalPages: number
}): string {
  return `PÁGINA ${pageNumber} DE ${totalPages}`
}

/** 2.M · `PieDocumento`. */
export default function PieDocumento(props: PieDocumentoProps): ReactElement {
  const zonaPaginacion = (
    <Text
      style={[estilos.paginacion, estilos.zonaAuto]}
      render={paginacion}
      fixed
    />
  )

  return (
    // `fixed`: regla 1. Sin él, el pie sale solo en la hoja donde se declaró.
    // El relleno es `acento.banda`, derivado a 7 : 1 sobre blanco (I.1.8), y entra
    // aquí y no en la hoja de estilos porque depende del acento del médico.
    <View style={[estilos.banda, { backgroundColor: props.acento.banda }]} fixed>
      {props.variante === 'completo' ? (
        <>
          <Text style={[estilos.folio, estilos.zonaAuto]}>{`Folio ${props.folio}`}</Text>
          <View style={estilos.separacion}>{zonaPaginacion}</View>
        </>
      ) : (
        <>
          {zonaPaginacion}
          {/*
            El título ocupa la zona que en `completo` lleva el folio, y va en el
            mismo rol `pie`: cada contenido conserva su tratamiento y lo que
            cambia es qué zona ocupa. La paginación no pierde su versalita por
            haberse movido a la zona 1.
          */}
          <Text style={[estilos.folio, estilos.zonaAuto, estilos.separacion]}>
            {props.titulo}
          </Text>
        </>
      )}

      <Text style={estilos.leyenda}>{props.leyenda}</Text>
    </View>
  )
}
