/**
 * Sistema de documentos v2 — componente 2.E · `Campo`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.E. Transcripción, no diseño.
 *
 * Propósito: resolver, DE UNA SOLA MANERA EN TODO EL SISTEMA, qué pasa cuando un
 * dato no viene. Es el componente que más se repite en los ocho formatos.
 *
 * LOS TRES ESTADOS, Y POR QUÉ NO SE PASAN POR PROP
 *
 * El componente recibe el rótulo, el valor —que puede no venir— y si el formato
 * lo declara requerido. El ESTADO sale de ahí; no entra por fuera. Si entrara,
 * cada sitio de llamada podría equivocarse y volveríamos al defecto §8.8 por otra
 * puerta, que es justo lo que este componente existe para cerrar.
 *
 *   con valor        rótulo + valor                       27 pt de alto
 *   vacío requerido  rótulo + línea para llenar a pluma    31 pt
 *   vacío opcional   nada                                   0 pt
 *
 * LAS CUATRO REGLAS DE LA FICHA
 *
 * 1. NUNCA UNA CAJA CON ETIQUETA Y NADA DEBAJO. Es el defecto §8.8 del sistema
 *    viejo y el que más daño médico-legal hace, más que los campos obligatorios,
 *    que sí están protegidos. Aquí se implementa como una sola condición: si no
 *    hay valor y el campo no es requerido, no se pinta el rótulo tampoco. No hay
 *    ninguna rama de este archivo que devuelva un rótulo suelto.
 * 2. El estado `vacío requerido` NO LLEVA LEYENDA DE ERROR. Nada de «FALTA DATO
 *    OBLIGATORIO» impreso: el rótulo y la línea ya dicen qué falta y dónde se
 *    escribe. Si alguna vez aparece una cadena de aviso en este archivo, sobra.
 * 3. Qué campo es requerido y cuál opcional LO DECLARA EL FORMATO en la Sección
 *    II. El componente no lo decide, y por eso `requerido` es una prop
 *    OBLIGATORIA: sin valor por defecto no hay forma de que un formato se olvide
 *    de declararlo y un campo exigible colapse en silencio.
 * 4. El colapso es TOTAL: no deja aire donde estaba el campo. Se implementa
 *    devolviendo `null`, que en react no monta ningún nodo, así que el padre no
 *    ve ni una caja de cero. Corolario para quien componga filas de campos: la
 *    separación entre campos va en el CONTENEDOR —con `gap`—, nunca como margen
 *    del propio campo. Un margen viajaría con el campo y sobreviviría al colapso.
 *
 * LOS DOS ESTADOS CON TINTA NO MIDEN LO MISMO, Y ES A PROPÓSITO
 *
 * Difieren en `manuscrito.alto − dato.interlineado` = 4 pt, que es lo que el
 * espacio de escritura mide de más que un renglón de texto. No se comprime para
 * igualarlos: `manuscrito.alto` es el único valor tipográfico del sistema medido
 * contra una referencia física —pautado de cuaderno, 7.1 mm (I.1.5)— e I.3.4
 * prohíbe cambiar una medida para cuadrar una caja. Lo idéntico en los dos
 * estados es la posición del RÓTULO: la diferencia vive entera debajo de él. Una
 * fila de campos mezclados alinea por arriba, nunca por abajo.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { MANUSCRITO, TINTA, estiloTipografico } from './tokens'

export interface CampoProps {
  /**
   * Se compone en versalita —mayúsculas con tracking, no versalitas reales de la
   * fuente (I.1.4)—. La transformación ocurre en el render: no lo pases ya en
   * mayúsculas.
   */
  etiqueta: string
  /** Ausente o vacío es lo mismo: el campo no trae dato. */
  valor?: string
  /**
   * Lo declara el FORMATO en la Sección II, no este componente (regla 3). Sin
   * valor por defecto a propósito: un campo exigible que colapsara por omisión
   * sería el defecto §8.8 entrando por la puerta de atrás.
   */
  requerido: boolean
}

const estilos = StyleSheet.create({
  /**
   * Sin margen de ninguna clase. La separación respecto de los campos vecinos es
   * del contenedor (regla 4): un margen aquí sobreviviría al colapso y dejaría el
   * hueco que el colapso existe para no dejar.
   */
  campo: {
    // La ficha no declara separación entre el rótulo y lo que va debajo, así que
    // no hay ninguna. Es la misma disciplina que el riel de 2.D.
    alignItems: 'flex-start',
  },
  etiqueta: { ...estiloTipografico('etiqueta') },
  valor: { ...estiloTipografico('dato') },
  /**
   * El espacio de escritura: `manuscrito.ancho` × `manuscrito.alto`, con la línea
   * abajo en `manuscrito.grosor` —que es `filete.fino` por identidad—.
   *
   * El alto es de CAJA DE BORDE, así que la línea va DENTRO de los 20 pt y el
   * bloque ocupa exactamente `manuscrito.alto`. Es la lectura que corresponde a
   * cómo se midió el token: 20 pt es el pautado del cuaderno, es decir la
   * distancia de raya a raya, no el aire por encima de la raya.
   */
  linea: {
    width: MANUSCRITO.ancho,
    height: MANUSCRITO.alto,
    borderBottomWidth: MANUSCRITO.grosor,
    borderBottomColor: TINTA.negra,
  },
})

/**
 * ¿El campo trae dato? Ausente y vacío son lo mismo.
 *
 * EXPORTADA A PROPÓSITO, y es lo único que se exporta además del componente.
 * `RielDatos` (2.F) tiene que tomar esta misma decisión ANTES de montar la celda,
 * porque colapsar dentro de un riel no es dejar de pintar un rótulo: es quitar la
 * celda entera —su ancho, su padding y su regla— y repartir el sobrante entre las
 * que quedan. Eso es geometría del riel y no puede vivir aquí.
 *
 * Lo que sí vive aquí, y una sola vez en todo el sistema, es la REGLA de qué
 * cuenta como dato ausente. Si el riel se escribiera su propia versión, bastaría
 * con que una de las dos dejara de recortar los espacios para que un campo con un
 * espacio en blanco colapsara en un sitio y pintara un rótulo vacío en el otro —
 * que es el defecto §8.8 apareciendo por la costura entre dos componentes.
 */
export function tieneValor(valor: string | undefined): valor is string {
  return valor !== undefined && valor.trim() !== ''
}

/** 2.E · `Campo`. Devuelve `null` en el estado `vacío opcional` (regla 4). */
export default function Campo({
  etiqueta,
  valor,
  requerido,
}: CampoProps): ReactElement | null {
  const hayValor = tieneValor(valor)

  // Regla 1 y regla 4 en la misma línea: sin valor y sin exigencia, no queda ni
  // rótulo ni hueco. Antes de este `return` no se ha pintado nada.
  if (!hayValor && !requerido) return null

  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta.toUpperCase()}</Text>
      {hayValor ? (
        <Text style={estilos.valor}>{valor}</Text>
      ) : (
        // Regla 2: la línea y el rótulo son todo lo que se imprime. Sin leyenda.
        <View style={estilos.linea} />
      )}
    </View>
  )
}
