/**
 * Sistema de documentos v3 — 2.I · **BloqueDestacado**. «Separar del cuerpo un pasaje
 * que el lector debe leer aunque lea en diagonal. Se distingue por filete, NUNCA por
 * fondo de color.»
 *
 * ── DE CUATRO VARIANTES A TRES ──────────────────────────────────────────────
 *
 *   `recomendaciones`   filete superior 0.63 + encabezado. Receta, Suplementación,
 *                       Laboratorio, Imagenología
 *   `instrucciones`     filete superior 2 en acento + encabezado + sangría 14.
 *                       Internamiento
 *   `citaEscrito`       filete IZQUIERDO de 2 en negro, sin encabezado. Escrito médico
 *
 * **`alarma` se elimina**: su único consumidor era la Receta y el campo que lo
 * alimentaba no existe —`RecetaForm` tiene un solo campo de cierre, y se llama
 * Recomendaciones generales—. Con él se va `FILETE.alarma`, que era el grosor máximo
 * del sistema. **No se reasigna**: a qué se le da el trazo más grueso de un documento
 * es una decisión de diseño, no un hueco que rellenar porque quedó libre.
 *
 * **`cita` de Suplementación se elimina** con el bloque de cita de control (decisión
 * de producto), y con ella los cuatro roles `cita.*` y su ancho fijo de 294 pt.
 *
 * ── LA PRESENCIA MÍNIMA ENTRA POR PROP, Y ES DELIBERADO ─────────────────────
 *
 * Este bloque es el último contenido de seis de los nueve formatos, así que es quien
 * lleva el `minPresenceAhead` de la tabla del §9.2. Entra por prop y no se cablea aquí
 * porque **el valor es del formato**: 88 en Laboratorio, 96 en Receta, 108 en el
 * Consentimiento. Con una cifra propia, el bloque reservaría lo mismo detrás de una
 * banda de cierre de una celda que detrás de una de tres.
 *
 * `divisible` conserva su sentido de v2: un bloque de texto largo SÍ puede partirse
 * entre hojas —si no, un pasaje de 200 pt al pie de hoja dejaría 200 pt de blanco—,
 * y los cortos no.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import ParserBloques from './ParserBloques'
import {
  ESPACIO,
  FILETE,
  TINTA,
  TRANSICION,
  estiloTipografico,
} from './tokens'

export type VarianteDestacado = 'recomendaciones' | 'instrucciones' | 'citaEscrito'

const estilos = StyleSheet.create({
  recomendaciones: {
    borderTopWidth: FILETE.tabla,
    borderTopColor: TINTA.reglaSuave,
    paddingTop: ESPACIO[6],
  },
  /** La sangría de 14 y el padding `6 0 8 14` son de la lámina, no de la escala. */
  instrucciones: {
    borderTopWidth: FILETE.acento,
    borderTopColor: TINTA.negra,
    paddingTop: 6,
    paddingBottom: 8,
    paddingLeft: 14,
  },
  citaEscrito: {
    borderLeftWidth: FILETE.acento,
    borderLeftColor: TINTA.negra,
    paddingLeft: 14,
    paddingVertical: ESPACIO[4],
  },
  encabezado: {
    ...estiloTipografico('recomendaciones.encabezado'),
    marginBottom: TRANSICION.seccionParrafo,
  },
  texto: {
    ...estiloTipografico('texto.corrido'),
  },
})

export interface BloqueDestacadoProps {
  readonly variante: VarianteDestacado
  /** Se compone en versalita. Colapsa solo: `citaEscrito` no lleva ninguno. */
  readonly encabezado?: string
  /**
   * El pasaje, como UNA cadena de texto libre. La estructura —encabezados, ítems,
   * párrafos— la decide 2.J.
   */
  readonly texto?: string
  /** Composición propia del formato, cuando el pasaje no es texto libre. */
  readonly contenido?: ReactNode
  /**
   * `minPresenceAhead` de este bloque, en pt. El valor de la tabla del §9.2 del brief
   * 00. Ver la cabecera: **es un techo, `min(valor, altoDeLoQueSigue)`**, no una reserva.
   */
  readonly presencia?: number
  /** `true` en los pasajes largos. Sin ella, el bloque no se parte. */
  readonly divisible?: boolean
  /*
    ⚠ **NO HAY `acento` AQUÍ, Y NO ES UN OLVIDO.** La entrega declaraba la prop y no la
    consumía: ninguna de las tres variantes tiñe nada —el filete de `cita` y el de
    `citaEscrito` son negros, y el de `recomendaciones` es el fino del sistema—, así que
    aceptarla habría sido prometer un color que el bloque no compone. Ninguno de los cinco
    formatos que lo montan la pasaba. Si alguna variante futura tiñe, se repone entonces.
  */
}

/** 2.I · `BloqueDestacado`. Devuelve `null` sin pasaje: el bloque colapsa entero. */
export default function BloqueDestacado({
  variante,
  encabezado,
  texto,
  contenido,
  presencia,
  divisible = false,
}: BloqueDestacadoProps): ReactElement | null {
  const hayTexto = texto !== undefined && texto.trim() !== ''
  if (!hayTexto && contenido === undefined) return null

  return (
    <View
      style={estilos[variante]}
      wrap={divisible}
      minPresenceAhead={presencia}
    >
      {encabezado === undefined || encabezado.trim() === '' ? null : (
        <Text style={estilos.encabezado}>{encabezado.toUpperCase()}</Text>
      )}

      {contenido ??
        (hayTexto ? (
          /*
            El texto entra por 2.J y no como un `Text` suelto: una recomendación
            escrita con viñetas tiene que salir como lista, y quien decide eso es el
            analizador. `ascenderEncabezados: false` — en un bloque de cierre la
            primera línea es parte del pasaje, no su rótulo (defecto §6): el rótulo lo
            pone `encabezado`.
          */
          <ParserBloques
            texto={texto}
            marca="raya"
            rolCuerpo="texto.corrido"
            ascenderEncabezados={false}
          />
        ) : null)}
    </View>
  )
}
