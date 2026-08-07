/**
 * Sistema de documentos v2 — componente 2.J · `ParserBloques`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.J. Transcripción, no diseño.
 *
 * Propósito: convertir **una sola cadena** de texto libre en una estructura de
 * encabezados, ítems y párrafos. La estructura la trae el texto prellenado por
 * plantilla; el sistema no recibe arrays (`CONCILIA D10`).
 *
 * QUÉ DECIDE ESTE ARCHIVO Y QUÉ NO
 *
 * Nada. Lo que es cada línea lo decide `parserBloques.ts`, que se prueba entero
 * en `src/lib/tests/parserBloques.test.ts` — los siete casos de la ficha, con el
 * caso 2 primero. Aquí solo se compone lo que aquel devuelve. Si un texto sale
 * mal, el sitio donde mirar es el analizador, y hay una prueba que escribir antes
 * de tocarlo.
 *
 * LAS TRES REGLAS DE COMPOSICIÓN
 *
 * 1. **La viñeta del dato se SUSTITUYE por la raya del sistema. Nunca se imprimen
 *    las dos.** El analizador desecha la viñeta al leerla —incluido un `1.`
 *    tecleado a mano—, así que por aquí no puede colarse una segunda marca.
 * 2. **Un ítem puede ocupar varias líneas: la raya cuelga y el texto sangra.** Es
 *    geometría de render y sale sola de la fila riel + caja de texto. Ojo: en el
 *    DATO una línea sin viñeta **no** es continuación del ítem de arriba, es un
 *    bloque nuevo — así lo declara la tabla de la ficha y así se le explica al
 *    médico en el textarea (II.6 §5).
 * 3. **Degradación segura.** La viñeta vive en el dato, no en el render: este
 *    componente no reescribe nada. Si el análisis se equivoca, sale prosa en el
 *    orden en que venía, nunca un párrafo apelmazado.
 *
 * RAYA CONTRA NÚMERO — LO DECIDE QUIEN LLAMA, NO EL TEXTO
 *
 * Raya para enumeración sin orden —dieta, soluciones, medicamentos—; número
 * cuando la secuencia significa algo —instrucciones al paciente, donde primero se
 * presenta y después ayuna—. Es una propiedad del BLOQUE que lo instancia, no del
 * contenido, así que entra por prop. La numeración va corrida entre bloques (caso
 * 7) y la calcula el analizador.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { analizar, type NodoParser } from './parserBloques'
import { ESPACIO, FUENTE, RETICULA, estiloTipografico } from './tokens'

/**
 * LA RAYA DEL SISTEMA. Raya, no guion ni semirraya: es el signo con el que la
 * ortografía española abre un elemento de lista.
 *
 * Se compone en `fuente.neogrotesca` aunque el texto del ítem vaya en humanista
 * (`CONCILIA D30`), y por eso la marca lleva estilo propio en vez de heredar el
 * del cuerpo. Es además la única aparición de la neo-grotesca como CONTENIDO y no
 * como notación.
 */
const RAYA = '—'

/**
 * Los dos roles con los que un consumidor puede pedir el cuerpo.
 *
 * `texto.corrido` es el caso normal y el que declara la lista de tokens de la
 * ficha. `alarma.cuerpo` existe porque el bloque de alarma de la Receta lleva
 * `ParserBloques` DENTRO (II.3 §3) y compone un punto por encima del texto
 * corrido (II.3 §5): el rol lo declara la ficha del CONSUMIDOR —2.I— y este
 * componente solo declara que hay una ranura para él. Es la misma forma que toma
 * la excepción tipográfica de celda en 2.F.
 *
 * La lista está cerrada a esos dos a propósito: una prop abierta a los 23 roles
 * de I.1.4 sería una puerta para componer el cuerpo con cualquier cosa.
 */
export type RolCuerpoParser = 'texto.corrido' | 'alarma.cuerpo'

const estilos = StyleSheet.create({
  /**
   * El encabezado de bloque va en `etiqueta` (`CIERRA H2`): es la versalita con
   * la que el sistema nombra lo que va debajo. No es `titulo.seccion` — el bloque
   * vive DENTRO de una sección que ya abrió 2.P, y compartir rol aplanaría un
   * nivel, que es justo el nivel que el lookahead existe para distinguir.
   *
   * El gris `tinta.etiqueta` que trae el rol es correcto aquí: la regla 5 de 2.G
   * prohíbe componer en gris un DATO —la denominación genérica—, no el rótulo que
   * lo agrupa.
   */
  encabezado: { ...estiloTipografico('etiqueta') },
  cuerpoCorrido: { ...estiloTipografico('texto.corrido') },
  cuerpoAlarma: { ...estiloTipografico('alarma.cuerpo') },
  /** La marca hereda cuerpo e interlineado del texto y cambia de familia (D30). */
  marcaCorrido: { ...estiloTipografico('texto.corrido'), fontFamily: FUENTE.neogrotesca },
  marcaAlarma: { ...estiloTipografico('alarma.cuerpo'), fontFamily: FUENTE.neogrotesca },
  /**
   * SANGRÍA DEL ÍTEM COLGANTE — `reticula.riel` + `reticula.medianil` (`CIERRA
   * H3`). Misma anatomía que la entrada de 2.G y la sección de 2.P: riel a la
   * izquierda, medianil, caja de texto. La suma cierra sola —23.25 + 9 = 32.25 es
   * `reticula.columna`—, así que un ítem que rompe a varias líneas sangra a
   * retícula y no a un valor suelto.
   */
  item: { flexDirection: 'row' },
  riel: { width: RETICULA.riel, marginRight: RETICULA.medianil, flexShrink: 0 },
  /** La caja de texto se queda con el resto: es lo que hace colgar la raya. */
  cajaTexto: { flex: 1 },
  /**
   * AIRE ENTRE NODOS. La ficha no lo declaraba; se cierra con el criterio de H4,
   * que es el que ya cerró las separaciones internas de 2.G y el subtítulo de
   * 2.C: dentro de un bloque, la separación es tanto menor cuanto más pegadas
   * están las piezas. Un encabezado y sus ítems son un solo bloque y van al
   * mínimo de la escala; entre bloques sube un miembro. Dos niveles, los dos
   * menores de la escala, en orden: 4 < 8 (anexo A, P2-20).
   */
  dentroDelBloque: { marginTop: ESPACIO[4] },
  entreBloques: { marginTop: ESPACIO[8] },
})

export interface ParserBloquesProps {
  /** UNA SOLA CADENA. Nunca un array (`CONCILIA D10`). */
  texto: string
  /** Raya o número: lo declara el bloque que lo instancia, no el contenido. */
  marca: 'raya' | 'numero'
  /** Rol del cuerpo. Sin él, el texto corrido del sistema. */
  rolCuerpo?: RolCuerpoParser
}

/** Un nodo ya compuesto, con su separación respecto del anterior. */
function Nodo({
  nodo,
  primero,
  bloqueAnterior,
  marca,
  alarma,
}: {
  nodo: NodoParser
  primero: boolean
  bloqueAnterior: number
  marca: ParserBloquesProps['marca']
  alarma: boolean
}): ReactElement {
  const separacion = primero
    ? {}
    : nodo.bloque === bloqueAnterior
      ? estilos.dentroDelBloque
      : estilos.entreBloques
  const cuerpo = alarma ? estilos.cuerpoAlarma : estilos.cuerpoCorrido

  if (nodo.tipo === 'encabezado') {
    // Versalita: mayúsculas con tracking, como toda versalita del sistema (I.1.4).
    return <Text style={[estilos.encabezado, separacion]}>{nodo.texto.toUpperCase()}</Text>
  }

  if (nodo.tipo === 'parrafo') {
    return <Text style={[cuerpo, separacion]}>{nodo.texto}</Text>
  }

  return (
    <View style={[estilos.item, separacion]}>
      <View style={estilos.riel}>
        <Text style={alarma ? estilos.marcaAlarma : estilos.marcaCorrido}>
          {marca === 'numero' ? `${nodo.ordinal}.` : RAYA}
        </Text>
      </View>
      <Text style={[cuerpo, estilos.cajaTexto]}>{nodo.texto}</Text>
    </View>
  )
}

/** 2.J · `ParserBloques`. Devuelve `null` con la cadena vacía (caso 6). */
export default function ParserBloques({
  texto,
  marca,
  rolCuerpo = 'texto.corrido',
}: ParserBloquesProps): ReactElement | null {
  const nodos = analizar(texto)
  if (nodos.length === 0) return null

  const alarma = rolCuerpo === 'alarma.cuerpo'

  return (
    <View>
      {nodos.map((nodo, i) => (
        <Nodo
          // El índice ES la identidad aquí: los nodos salen de una cadena y su
          // orden es lo único que los distingue —dos ítems pueden decir lo mismo—.
          key={i}
          nodo={nodo}
          primero={i === 0}
          bloqueAnterior={i === 0 ? nodo.bloque : nodos[i - 1].bloque}
          marca={marca}
          alarma={alarma}
        />
      ))}
    </View>
  )
}
