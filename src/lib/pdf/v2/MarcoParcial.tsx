/**
 * Sistema de documentos v2 — componente 2.U · `MarcoParcial`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.U, con las tres sangrías medidas en
 * la lámina de Recibo y Cotización — que es justo lo que aquella ficha dejaba abierto
 * («**`NO DEFINIDO`** la de las tres cajas del Recibo: se mide al construir II.5»).
 *
 * Propósito: **enmarcar sin encerrar**. Es el dispositivo con el que el sistema acota
 * un contenido que hay que mirar aparte, sin barra, sin fondo y sin caja cerrada.
 *
 * LAS CINCO REGLAS DE LA FICHA
 *
 * 1. **Dos lados, siempre los mismos: superior e izquierdo.** Nunca los cuatro y nunca
 *    con fondo (`CONCILIA D34`, I.3.2). Aquí eso es una ausencia: en este archivo no
 *    hay `borderRight*`, no hay `borderBottom*` y no hay `backgroundColor`.
 * 2. **Va en acento**, que es uno de los tres usos que I.1.8 admite para el acento en
 *    su forma pura — como filete, nunca como color de texto.
 * 3. **Envuelve; no compone.** No conoce el rol de lo que hay dentro, no impone
 *    familia ni cuerpo. Ahí está la diferencia con `BloqueDestacado` (2.I), que sí
 *    compone su contenido en un rol propio y va en `tinta.negra`. Por eso la única
 *    ranura de contenido es un `ReactNode` y no una cadena.
 * 4. **La sangría y el ancho los declara el CONSUMIDOR**, no este dispositivo: un riel
 *    enmarcado y una leyenda de dos líneas no la llevan igual. Es la razón por la que
 *    `ancho` y `padding` son props obligatorias y sin valor por defecto — un marco que
 *    se sangrara solo tendría una cifra que nadie midió.
 * 5. **En fotocopia sigue significando** (I.3.3): lo que informa es el marco, no su
 *    tono. Que el acento salga gris no le quita nada — sigue siendo dos filetes donde
 *    no había ninguno.
 *
 * ⚠ **EL GROSOR ES 2.53 pt Y LA FICHA DECLARA `filete.acento`, QUE VALE 2.**
 *
 * La lámina mide 2.53 en los tres marcos que compone, así que el valor sale de
 * `FILETE_HONORARIOS.acento` y no de la escala de I.1.6. **No se unifica**, por lo
 * mismo que no se unificaron los 0.75 del riel: `filete.acento` lo usan además la
 * cabecera de tabla de 2.G y la variante `instrucciones` de 2.I, los dos ya
 * conciliados contra sus propias láminas. Reportado.
 *
 * El día que aparezca una segunda lámina con marco parcial, el grosor sube a prop
 * declarada —como ya lo son el ancho y el padding— y deja de leerse de una lámina.
 *
 * LAS TRES SANGRÍAS, Y POR QUÉ NO SON UNA
 *
 *     aseguradora   ancho 426 · padding 6 / 12 / 8    un `RielDatos` de tres celdas
 *     leyenda       ancho 246 · padding 6 / 10 / 8    una declaración de dos líneas
 *     declaración   ancho 426 · padding 9 / 12 / 11   el motivo del Consentimiento
 *
 * La tercera es de II.7 y **se declara aquí sin consumidor todavía**: es la única de
 * las tres que la ficha de 2.U ya nombraba y su cifra está medida, así que anotarla
 * cuesta tres líneas y ahorra volver a medirla. Las tres tienen el lateral IZQUIERDO
 * igual al derecho —«sangría 12», «sangría 10»—, así que el padding lleva un solo
 * `lateral` y no dos.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import { FILETE_HONORARIOS, type AcentoResuelto } from './tokens'

/**
 * El padding de un marco. `lateral` es la sangría de la regla 4: separa el contenido
 * del filete izquierdo, y la lámina le da el mismo valor por el lado derecho, donde no
 * hay filete del que separarse.
 */
export interface PaddingMarco {
  readonly superior: number
  readonly lateral: number
  readonly inferior: number
}

/**
 * LOS TRES CONSUMIDORES DE LA LÁMINA, con su ancho y su sangría.
 *
 * Viven aquí y no en cada consumidor porque la regla 4 dice que la declara el
 * consumidor, no de dónde la lee: puestos en tres archivos, el día que la lámina se
 * remida habría tres sitios que tocar y dos que se olvidarían. Es la misma forma que
 * toma `GEOMETRIA.medida` en 2.L, que también describe una lámina desde el chasis.
 */
export const MARCO = {
  /** Caja de aseguradora de II.5. Envuelve un riel de tres celdas. */
  aseguradora: {
    ancho: 426,
    padding: { superior: 6, lateral: 12, inferior: 8 },
  },
  /** Leyenda no fiscal de II.5. Vive dentro de la columna de 246 pt. */
  leyenda: {
    ancho: 246,
    padding: { superior: 6, lateral: 10, inferior: 8 },
  },
  /**
   * Bloque de motivo del Consentimiento (II.7). **Sin consumidor todavía**: se declara
   * medido para que 4.7 no vuelva a medirlo. Si al construir aquel formato la cifra no
   * cuadra, la que manda es su lámina y esta entrada se corrige.
   */
  declaracion: {
    ancho: 426,
    padding: { superior: 9, lateral: 12, inferior: 11 },
  },
} as const satisfies Record<string, { ancho: number; padding: PaddingMarco }>

const estilos = StyleSheet.create({
  /**
   * Los dos lados, y nada más. El grosor va aquí y el color en el render, porque
   * depende del acento del médico — misma razón de tipos que en 2.B, 2.C y 2.G.
   *
   * `flexShrink: 0` para que el marco conserve su ancho declarado dentro de una fila:
   * sin él, la caja de aseguradora se encogería al repartirse el ancho de su fila y
   * dejaría de medir los 426 que mide en la lámina.
   */
  marco: {
    borderTopWidth: FILETE_HONORARIOS.acento,
    borderLeftWidth: FILETE_HONORARIOS.acento,
    flexShrink: 0,
  },
})

export interface MarcoParcialProps {
  /** Ancho del marco, declarado por el consumidor (regla 4). */
  readonly ancho: number
  /** Sangría respecto del filete, declarada por el consumidor (regla 4). */
  readonly padding: PaddingMarco
  /** El acento del médico. Los dos filetes van en `acento.base` (regla 2). */
  readonly acento: AcentoResuelto
  /** Lo que se enmarca. Este dispositivo no lo compone (regla 3). */
  readonly children: ReactNode
}

/** 2.U · `MarcoParcial`. */
export default function MarcoParcial({
  ancho,
  padding,
  acento,
  children,
}: MarcoParcialProps): ReactElement {
  return (
    <View
      style={[
        estilos.marco,
        {
          width: ancho,
          paddingTop: padding.superior,
          paddingLeft: padding.lateral,
          paddingRight: padding.lateral,
          paddingBottom: padding.inferior,
          borderTopColor: acento.base,
          borderLeftColor: acento.base,
        },
      ]}
    >
      {children}
    </View>
  )
}
