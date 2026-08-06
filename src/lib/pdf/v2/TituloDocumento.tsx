/**
 * Sistema de documentos v2 — componente 2.C · `TituloDocumento`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.C, más las dos reglas del
 * preámbulo de la Sección II que aplican a los ocho formatos.
 *
 * Propósito: nombrar el documento. Es la primera lectura del receptor —farmacia,
 * admisión, laboratorio.
 *
 * LAS CUATRO REGLAS DE LA FICHA
 *
 * 1. Los títulos fijos CABEN EN UN RENGLÓN POR DISEÑO. Un título fijo que rompe a
 *    dos líneas es un error de redacción del título, no un caso de flujo — fue lo
 *    que obligó a acortar el de Imagenología. Aquí no hay nada que implementar:
 *    es una regla sobre las CADENAS de la Sección II, no sobre el render. Por eso
 *    `fijo` y `variable` se dibujan igual; lo que cambia es de dónde sale el texto
 *    y quién responde si no cabe.
 * 2. El título variable SÍ puede romper a dos líneas y el encabezado no se
 *    desalinea por ello. Sin `maxLines`, sin truncado, sin elipsis.
 * 3. La fecha se alinea por LÍNEA BASE con la PRIMERA línea del título, no con la
 *    última y no con el centro del bloque. Ver la nota larga en `cajaFecha`: es el
 *    punto donde react-pdf no llega y hay que saber por qué.
 * 4. La variante `ausente` COLAPSA ENTERA: no deja hueco reservado. Lo único que
 *    sobrevive es la separación que existe siempre bajo el filete —
 *    `transicion.tituloRiel`—, porque cuando no hay título el filete del membrete
 *    hace doble trabajo: cierra el membrete y abre el cuerpo.
 *
 * LAS DOS REGLAS DEL PREÁMBULO DE II
 *
 * a. **El título se almacena en capitalización de oración y se compone en
 *    MAYÚSCULAS por transformación** (`CONCILIA D1`). Nunca se almacena en
 *    mayúsculas. La transformación ocurre aquí, en el render.
 * b. **Los ocho formatos admiten subtítulo**, en `titulo.subtitulo`, bajo el
 *    título, y COLAPSA si no viene (`CONCILIA D2`). La ficha de 2.C no lo
 *    menciona —su lista de tokens es anterior a esa conciliación— pero el
 *    subtítulo no tiene otro sitio donde vivir: es parte del bloque de título.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import {
  RETICULA,
  TIPOGRAFIA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/** Interlineado del título: el alto de UNA de sus líneas. Lo usa la fecha. */
const ALTO_LINEA_TITULO = TIPOGRAFIA['titulo.documento'].interlineado ?? 0

const estilos = StyleSheet.create({
  /**
   * El bloque siempre aporta su separación inferior, en las tres variantes.
   *
   * Eso NO contradice la regla 4: `transicion.tituloRiel` no es hueco reservado
   * para el título, es la separación que hay bajo el filete que abre el cuerpo.
   * Con título es el filete del título; sin título es el del membrete. Lo que
   * desaparece en `ausente` es el bloque del título entero y su propio filete.
   */
  bloque: {
    width: '100%',
    marginBottom: TRANSICION.tituloRiel,
  },
  fila: {
    flexDirection: 'row',
  },
  columnaTitulo: {
    // Regla 2: el título toma el ancho restante y rompe solo. Sin truncado.
    flex: 1,
  },
  titulo: { ...estiloTipografico('titulo.documento') },
  subtitulo: { ...estiloTipografico('titulo.subtitulo') },
  /**
   * REGLA 3, Y HASTA DÓNDE LLEGA EL RENDERER.
   *
   * `alignItems: 'baseline'` NO sirve aquí: react-pdf no le da a Yoga una función
   * de línea base para los nodos de texto —no existe `setBaselineFunc` en
   * `@react-pdf/layout`—, así que Yoga usa el borde inferior del nodo. Con un
   * título de dos líneas eso alinearía la fecha con la SEGUNDA, que es
   * exactamente lo que la regla prohíbe.
   *
   * Lo que se hace: la caja de la fecha mide una línea de título de alto y su
   * texto se apoya abajo. Así la fecha queda siempre en la primera línea, nunca
   * en la segunda ni centrada entre ambas. Lo que quedan alineados con exactitud
   * son los BORDES INFERIORES de las dos cajas de línea; las líneas base quedan
   * a un par de puntos, porque igualarlas exigiría el ascendente de cada cuerpo y
   * la ficha no declara ningún desplazamiento. Está medido y reportado.
   */
  cajaFecha: {
    height: ALTO_LINEA_TITULO,
    justifyContent: 'flex-end',
    // La ficha no declara el medianil entre título y fecha. Se usa el separador
    // de columnas del sistema en vez de inventar una cifra.
    marginLeft: RETICULA.medianil,
    // La fecha es un dato corto y entero: no se comprime ni rompe.
    flexShrink: 0,
  },
  fecha: { ...estiloTipografico('fecha.encabezado') },
  hastaFilete: {
    marginTop: TRANSICION.tituloFilete,
  },
})

interface ConTitulo {
  /**
   * En capitalización de oración. Se compone en mayúsculas aquí (regla a del
   * preámbulo de II): no lo pases ya en mayúsculas.
   */
  titulo: string
  /** Colapsa si no viene (regla b del preámbulo de II). */
  subtitulo?: string
  /**
   * Fecha del encabezado, ya formateada por quien llama —II.8 la imprime en forma
   * corta y sin rótulo—. Colapsa si no viene: solo un formato la lleva aquí.
   */
  fecha?: string
  acento: AcentoResuelto
}

export type TituloDocumentoProps =
  /** 7 de los 8 formatos. El texto es constante del formato. */
  | ({ variante: 'fijo' } & ConTitulo)
  /** Escrito Médico. Lo escribe el médico. */
  | ({ variante: 'variable' } & ConTitulo)
  /** Escrito Médico sin título. No deja hueco reservado. */
  | { variante: 'ausente' }

/** 2.C · `TituloDocumento`. */
export default function TituloDocumento(props: TituloDocumentoProps): ReactElement {
  if (props.variante === 'ausente') {
    // Regla 4: colapsa entero. Solo queda la separación bajo el filete del
    // membrete, que aquí hace de filete de apertura del cuerpo.
    return <View style={estilos.bloque} />
  }

  return (
    <View style={estilos.bloque}>
      <View style={estilos.fila}>
        <View style={estilos.columnaTitulo}>
          <Text style={estilos.titulo}>{props.titulo.toUpperCase()}</Text>
          {props.subtitulo === undefined ? null : (
            <Text style={estilos.subtitulo}>{props.subtitulo}</Text>
          )}
        </View>
        {props.fecha === undefined ? null : (
          <View style={estilos.cajaFecha}>
            <Text style={estilos.fecha}>{props.fecha}</Text>
          </View>
        )}
      </View>

      <View style={estilos.hastaFilete}>
        <FileteGruesoFino acento={props.acento} />
      </View>
    </View>
  )
}
