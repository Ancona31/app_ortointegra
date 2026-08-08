/**
 * Sistema de documentos v2 — componente 2.O · `FileteGruesoFino`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.O. Transcripción, no diseño.
 *
 * Propósito: el filete estructural del sistema. Cierra el membrete y separa el
 * bloque de título del riel de identificación. Se instancia tres o cuatro veces
 * por hoja en los ocho formatos.
 *
 * LAS TRES REGLAS DE LA FICHA
 *
 * 1. El segmento grueso es de ANCHO FIJO, no proporcional al contenido. No hay
 *    prop de ancho y no debe agregarse.
 * 2. Los dos segmentos comparten LÍNEA BASE. Nunca se centran entre sí. Aquí eso
 *    es `alignItems: 'flex-end'`: el fino de 0.8 pt se apoya en el borde inferior
 *    del grueso de 2.5 pt, no en su centro.
 * 3. Es el ÚNICO lugar del sistema donde el acento aparece como barra sólida, y
 *    está acotado a 96 pt: no cruza la caja. Si alguien necesita otra barra de
 *    acento, la respuesta es no (I.3.2).
 *
 * El fino llega «hasta el borde derecho de la caja»: se implementa como
 * `flex: 1` y el componente ocupa el ancho que le dé quien lo instancia. En el
 * membrete eso es `caja.ancho`, pero el componente no lo escribe: así el mismo
 * filete sirve para las otras tres o cuatro instancias por hoja sin variantes.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { FILETE, TINTA, type AcentoResuelto } from './tokens'

/**
 * Geometría de ESTE componente, de la tabla de 2.O.
 *
 * Los 2.5 pt son geometría interna, **no un miembro de `filete.*`** — I.1.6 lo
 * declara explícitamente junto con los dos anillos del panel circular. No lo
 * muevas a `FILETE`.
 *
 * El grosor del fino sí es de la escala: `filete.fino`.
 */
const GEOMETRIA = {
  anchoGrueso: 96,
  grosorGrueso: 2.5,
  /**
   * LA SEGUNDA MEDIDA DEL FILETE, Y POR QUÉ LA REGLA 1 NO SE ROMPE.
   *
   * La regla 1 dice que el grueso es de ancho FIJO y que no hay prop de ancho.
   * Sigue sin haberla: lo que entra es una MEDIDA declarada —dos parejas cerradas,
   * no un número libre—, y la elige el sitio que instancia el filete, no el
   * contenido. Un `ancho={72}` sí rompería la regla; `medida="lista"` no.
   *
   * Existe porque la lámina de Imagenología abre su lista con **64 × 2 pt** de
   * acento más el fino negro, y `SPEC_DISENO_PARTE_B.md` B.2 §5 la declara
   * explícitamente por contraste con la principal: «más corto y fino que el filete
   * principal (96 × 2.5)». Sin esta pareja, el encabezado de lista se compone con
   * el filete del membrete y pesa lo mismo que él.
   */
  anchoGruesoLista: 64,
  grosorGruesoLista: 2,
} as const

/**
 * Las dos medidas declaradas. `principal` cierra membrete y título en los ocho
 * formatos; `lista` abre la lista de Imagenología.
 */
export type MedidaFilete = 'principal' | 'lista'

const estilos = StyleSheet.create({
  linea: {
    flexDirection: 'row',
    // Regla 2: los dos segmentos comparten base. El alto del contenedor es el
    // del segmento más grueso, y el fino se apoya abajo.
    alignItems: 'flex-end',
    width: '100%',
    height: GEOMETRIA.grosorGrueso,
  },
  lineaLista: {
    height: GEOMETRIA.grosorGruesoLista,
  },
  grueso: {
    width: GEOMETRIA.anchoGrueso,
    height: GEOMETRIA.grosorGrueso,
  },
  gruesoLista: {
    width: GEOMETRIA.anchoGruesoLista,
    height: GEOMETRIA.grosorGruesoLista,
  },
  fino: {
    flex: 1,
    height: FILETE.fino,
    backgroundColor: TINTA.negra,
  },
})

export interface FileteGruesoFinoProps {
  /** El segmento grueso va en `acento.base`, en su forma pura (regla 3). */
  readonly acento: AcentoResuelto
  /** Cuál de las dos medidas declaradas. Sin ella, la principal de los ocho. */
  readonly medida?: MedidaFilete
}

/** 2.O · `FileteGruesoFino`. */
export default function FileteGruesoFino({
  acento,
  medida = 'principal',
}: FileteGruesoFinoProps): ReactElement {
  const lista = medida === 'lista'

  return (
    <View style={[estilos.linea, lista ? estilos.lineaLista : {}]}>
      <View
        style={[
          lista ? estilos.gruesoLista : estilos.grueso,
          { backgroundColor: acento.base },
        ]}
      />
      <View style={estilos.fino} />
    </View>
  )
}
