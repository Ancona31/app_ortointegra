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
   * Declaración de consentimiento (II.7). La cifra se declaró medida al construir II.5,
   * **sin consumidor todavía**, para que 4.7 no volviera a medirla. Cuadra: la lámina de
   * Consentimiento compone su declaración con este ancho y este padding exactos.
   */
  declaracion: {
    ancho: 426,
    padding: { superior: 9, lateral: 12, inferior: 11 },
  },
  /**
   * Fundamento legal (II.7), el bloque que cita la NOM-004 bajo el título. **Es el único
   * marco del sistema cuyo ancho no es 426 ni 246**: mide los mismos 381 pt que la caja de
   * texto de las siete secciones clínicas, así que su medida de línea es la del cuerpo del
   * documento y no la de un apartado.
   */
  fundamento: {
    ancho: 381,
    padding: { superior: 8, lateral: 12, inferior: 10 },
  },
} as const satisfies Record<string, { ancho: number; padding: PaddingMarco }>

const estilos = StyleSheet.create({
  /**
   * Los dos lados, y nada más. El grosor y el color van en el render, porque el primero
   * lo declara la lámina y el segundo depende del acento del médico — misma razón de
   * tipos que en 2.B, 2.C y 2.G.
   *
   * `flexShrink: 0` para que el marco conserve su ancho declarado dentro de una fila:
   * sin él, la caja de aseguradora se encogería al repartirse el ancho de su fila y
   * dejaría de medir los 426 que mide en la lámina.
   */
  marco: {
    flexShrink: 0,
  },
})

/**
 * EL GROSOR POR DEFECTO — el de la lámina que estrenó este dispositivo.
 *
 * La cabecera anunciaba que «el día que aparezca una segunda lámina con marco parcial, el
 * grosor sube a prop declarada». **Ese día llegó**: la de Consentimiento compone sus dos
 * marcos —fundamento legal y declaración— con `filete.acento`, los 2 pt limpios de la
 * escala de I.1.6, contra los 2.53 de Honorarios. Dos láminas y dos cifras, así que el
 * grosor deja de leerse de una y pasa a declararlo el consumidor, como el ancho y el
 * padding (regla 4).
 *
 * Sin la prop, el 2.53 de Honorarios: los tres marcos de aquel formato no se mueven.
 */
const GROSOR_POR_DEFECTO = FILETE_HONORARIOS.acento

export interface MarcoParcialProps {
  /** Ancho del marco, declarado por el consumidor (regla 4). */
  readonly ancho: number
  /** Sangría respecto del filete, declarada por el consumidor (regla 4). */
  readonly padding: PaddingMarco
  /** El acento del médico. Los dos filetes van en `acento.base` (regla 2). */
  readonly acento: AcentoResuelto
  /** Grosor de los dos filetes. Sin él, el de Honorarios. Ver `GROSOR_POR_DEFECTO`. */
  readonly grosor?: number
  /** Lo que se enmarca. Este dispositivo no lo compone (regla 3). */
  readonly children: ReactNode
}

/** 2.U · `MarcoParcial`. */
export default function MarcoParcial({
  ancho,
  padding,
  acento,
  grosor = GROSOR_POR_DEFECTO,
  children,
}: MarcoParcialProps): ReactElement {
  return (
    <View
      style={[
        estilos.marco,
        {
          width: ancho,
          borderTopWidth: grosor,
          borderLeftWidth: grosor,
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
