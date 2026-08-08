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
 * 5. El SUBTÍTULO va bajo el título, separado por `espacio.2`, y colapsa si no
 *    viene. Ver la nota en `subtitulo`.
 * 6. El RIEL DE FOLIO ocupa la zona derecha del bloque, 156 pt de ancho fijo, y
 *    colapsa si no viene. Lo llevan siete de los ocho formatos; el Escrito Médico
 *    es el único sin folio. Ver la nota en `rielFolio`.
 *
 * LAS DOS REGLAS DEL PREÁMBULO DE II
 *
 * a. **El título se almacena en capitalización de oración y se compone en
 *    MAYÚSCULAS por transformación** (`CONCILIA D1`). Nunca se almacena en
 *    mayúsculas. La transformación ocurre aquí, en el render.
 * b. **La ranura de subtítulo se queda construida y HOY NO TIENE CONSUMIDORES.**
 *    `CONCILIA D2` la declaraba para los ocho formatos, deducida de la lámina; la
 *    deducción queda REVERTIDA por decisión de producto: ningún formulario de la
 *    app tiene ese campo y añadirlo obligaría a tocar los ocho para algo que
 *    quedaría vacío casi siempre. Solicitud de Laboratorio ya no lo pasa.
 *
 *    **NO BORRES LA RANURA.** La necesita el título variable del Escrito Médico, y
 *    sigue siendo el único sitio donde un subtítulo puede vivir: es parte del bloque
 *    de título (anexo A, P2-6). Colapsa si no viene, que es lo que hace ahora en el
 *    único formato construido.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import {
  ESPACIO,
  RETICULA,
  TIPOGRAFIA,
  TRANSICION,
  ZONA,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Rótulo del riel de folio. Se compone en versalita aquí, como toda versalita del
 * sistema: no lo pases ya en mayúsculas.
 */
const ETIQUETA_FOLIO = 'Folio'

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
  /**
   * REGLA 5 — LA SEPARACIÓN DEL SUBTÍTULO.
   *
   * `espacio.4` sale de la ESCALA y no de la geometría interna del componente
   * porque aquí no hay nada que transcribir: el diseño nunca inventarió el
   * subtítulo (`CONCILIA D2`), así que no existe una cifra medida que declarar.
   *
   * De la escala se elige el mínimo por jerarquía: título y subtítulo son UN
   * SOLO bloque, y su separación interna tiene que ser estrictamente menor que
   * la que cierra el bloque —`transicion.tituloFilete`, 10 pt— y que la que lo
   * separa del riel —`transicion.tituloRiel`, 20 pt—. Con 4 pt el orden queda
   * 4 < 10 < 20 y el subtítulo se lee pegado a su título.
   *
   * NO se usa `transicion.seccionParrafo` aunque la relación sea análoga
   * —encabezado y el texto que lo explica—: ese token tiene dos extremos
   * declarados y I.1.7 prohíbe leer la coincidencia de valor como identidad.
   * Moverlo para ajustar un encabezado de sección no debe arrastrar al subtítulo.
   */
  subtitulo: {
    ...estiloTipografico('titulo.subtitulo'),
    // `espacio.2`, medido en B.1 §1 («margen superior 2 pt»). La versión anterior
    // usaba `espacio.4`, elegido por jerarquía porque el diseño «nunca inventarió
    // el subtítulo»; la lámina sí lo tiene y sí lo mide, así que el razonamiento
    // sobra. El orden que aquel argumento buscaba se conserva: 2 < 4 < 8.
    marginTop: ESPACIO[2],
  },
  /**
   * EL RIEL DE FOLIO. Zona derecha del bloque de título, de ancho FIJO: A.8 declara
   * las dos zonas del bloque —texto 321 pt (columnas 1–8), riel 156 pt (9–12)— y
   * B.1 §2 lo confirma sobre la lámina de Laboratorio, «riel de folio de 156 pt a
   * la derecha».
   *
   * No comparte caja con la fecha y no puede: la fecha se apoya en la línea base
   * del título (regla 3) y el folio es un par etiqueta + valor de dos renglones.
   * Ningún formato lleva los dos —la fecha en el encabezado es solo del Escrito
   * Médico (II.8 §5), que es el único sin folio—, así que no hay que decidir cómo
   * conviven.
   */
  rielFolio: {
    width: ZONA.riel,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  etiquetaFolio: { ...estiloTipografico('etiqueta') },
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
   * desplazadas 1.976 pt, con la fecha por debajo del título.
   *
   * Esa cifra NO es un residuo que haya que perseguir: es geometría derivada del
   * componente, declarada en la ficha de 2.C con su fórmula. react-pdf sitúa la
   * línea base a `ascendente × cuerpo` del borde superior de la caja de línea, y
   * la caja mide el interlineado, así que el desplazamiento sale de los dos roles
   * y del ascendente de Archivo (878/1000 em):
   *
   *     (20 − 11) − 0.878 × (17 − 9) = 1.976 pt = 0.70 mm
   *
   * Medido contra el flujo de contenido del PDF real, no estimado. No lo
   * «corrijas» con un desplazamiento duro: dependería del ascendente de la
   * familia y de los dos cuerpos, y se rompería en silencio al cambiar
   * cualquiera de los tres.
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
  /**
   * Folio del documento, ya generado. Colapsa si no viene.
   *
   * **Siete de los ocho formatos lo llevan.** El único sin folio es el Escrito
   * Médico, y las láminas lo dicen dos veces (B.8: «Folio — no existe en ninguna
   * parte», «el único formato sin folio»). La decisión de que Laboratorio no lo
   * llevara —II.1 §1, «nadie de fuera cita el número de una solicitud»— iba contra
   * su propia lámina, que compone el riel de 156 pt y emite con prefijo.
   */
  folio?: string
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

        {props.folio === undefined ? null : (
          <View style={estilos.rielFolio}>
            <Text style={estilos.etiquetaFolio}>{ETIQUETA_FOLIO.toUpperCase()}</Text>
            {/*
              El rol `folio` va en `acento.tinta`, así que se resuelve en el render
              y se esparce en un literal: misma razón de tipos que en 2.B, 2.D, 2.F
              y 2.G.
            */}
            <Text style={{ ...estiloTipografico('folio', props.acento) }}>
              {props.folio}
            </Text>
          </View>
        )}
      </View>

      <View style={estilos.hastaFilete}>
        <FileteGruesoFino acento={props.acento} />
      </View>
    </View>
  )
}
