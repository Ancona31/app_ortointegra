/**
 * Sistema de documentos v2 — componente 2.I · `BloqueDestacado`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.I. Transcripción, no diseño.
 *
 * Propósito: separar del cuerpo un pasaje que el lector debe leer aunque lea en
 * diagonal. Se distingue **por filete, NUNCA por fondo de color**.
 *
 * REGLA 1 — POR QUÉ NO HAY UN SOLO `backgroundColor` EN ESTE ARCHIVO
 *
 * Ninguna variante lleva fondo. Ni al velo del acento, que es el fondo tenue que
 * I.1.8 sí admite en otros sitios. La jerarquía la carga el GROSOR del filete,
 * que es lo único que sobrevive intacto a una fotocopia: un velo al 6 % se va en
 * la primera copia y con él se iría la distinción entre las tres variantes.
 *
 * Es también I.3.3 —el color nunca es el único portador de significado— aplicado
 * al caso en que la distinción no es de color sino de trama: una trama que
 * desaparece deja tres bloques idénticos.
 *
 * LOS TRES GROSORES SE DERIVAN, NO SE ELIGEN
 *
 * La jerarquía es alarma > instrucciones > cita, y entre `filete.alarma` (3 pt) y
 * `filete.cita` (1.6 pt) la escala de I.1.6 tiene un solo miembro,
 * `filete.acento` (2 pt). No había nada que decidir (`CIERRA H1`). Que
 * `filete.acento` lo usen además la cabecera de tabla y el marco del QR no
 * estorba: un grosor es un grosor.
 *
 * QUÉ LADO LLEVA FILETE
 *
 * `alarma` lleva superior E izquierdo; `instrucciones` y `cita` solo izquierdo.
 * La `cita` con filete superior que aparecía en Suplementación quedó unificada a
 * solo izquierdo (`CONCILIA D42`): es lo que la distingue de la alarma.
 *
 * LA RANURA DE 2.J ESTÁ PREPARADA Y VACÍA
 *
 * La regla 4 de la ficha dice que `instrucciones` compone lista NUMERADA, no con
 * raya. Esa composición es de `ParserBloques` (2.J), que todavía no existe, y el
 * parser recibe UNA SOLA CADENA (`CONCILIA D10`) — que es exactamente la forma
 * de la prop `texto` de aquí. Hasta que 2.J exista, las tres variantes componen
 * su cadena en plano con el rol que les toca. La ranura está marcada abajo, en el
 * sitio donde hoy va el `<Text>`; cuando llegue el parser, el cambio es interno y
 * la API de este componente no se mueve. **No adelantes el parser aquí.**
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ESPACIO, FILETE, TINTA, estiloTipografico } from './tokens'

/**
 * SANGRÍA DEL TEXTO RESPECTO DEL FILETE — `espacio.16` EN LAS TRES VARIANTES.
 *
 * La regla 2 de la ficha dice «la sangría del texto respecto del filete», en
 * singular, y `alarma` tiene dos filetes. La sangría se aplica a los dos: el
 * texto guarda `espacio.16` con el filete que tiene a la izquierda y, cuando
 * existe, con el que tiene encima. Leerlo como «solo el izquierdo» dejaría el
 * texto de la alarma pegado a un filete de 3 pt, que es el más grueso del bloque
 * y el que más necesita aire. Queda registrado en el anexo A (P2-16).
 *
 * `CORRIGE HANDOFF` — el bloque de alarma figuraba con 14 pt, que no es miembro
 * de la escala de espaciado. No hay razón de alineación que exija 14: la sangría
 * no se alinea con la retícula, se alinea con el filete.
 */
const SANGRIA = ESPACIO[16]

const estilos = StyleSheet.create({
  /**
   * Lo común a las tres. Sin `backgroundColor` (regla 1) y sin margen: la
   * separación respecto de los bloques vecinos es del contenedor, como en 2.E.
   */
  bloque: {
    borderLeftColor: TINTA.negra,
    paddingLeft: SANGRIA,
  },
  fileteAlarma: {
    borderLeftWidth: FILETE.alarma,
    borderTopWidth: FILETE.alarma,
    borderTopColor: TINTA.negra,
    paddingTop: SANGRIA,
  },
  fileteInstrucciones: {
    borderLeftWidth: FILETE.acento,
  },
  fileteCita: {
    borderLeftWidth: FILETE.cita,
  },
  /**
   * `alarma.cuerpo` — IBM Plex Sans 12 / 18, peso 500 (`CONCILIA D16`). Es el
   * único cuerpo del sistema con ventaja declarada sobre `texto.corrido`, y hasta
   * el barrido de listas de tokens **ninguna ficha lo citaba**, pese a existir en
   * I.1.4 desde la conciliación.
   */
  textoAlarma: { ...estiloTipografico('alarma.cuerpo') },
  /** Las otras dos variantes componen en el texto corrido del sistema. */
  textoCorrido: { ...estiloTipografico('texto.corrido') },
})

export interface BloqueDestacadoProps {
  /** Cuál de las tres, con su grosor y su rol. */
  variante: 'alarma' | 'instrucciones' | 'cita'
  /**
   * El pasaje, como UNA cadena. Es la misma forma que espera `ParserBloques`
   * (`CONCILIA D10`), así que cuando 2.J llegue no hay que cambiar la prop: el
   * texto entra igual y lo que cambia es quién lo compone dentro.
   */
  texto: string
}

/**
 * Los tres estilos de filete, como unión de los objetos inferidos por
 * `StyleSheet.create`. El tipo NO se declara como interfaz por el mismo motivo
 * que en 2.B, 2.D y 2.F: el `Style` de react-pdf lleva un índice de media queries
 * que TypeScript presta a un tipo de objeto inferido pero nunca a una interfaz.
 */
type EstiloFilete =
  | typeof estilos.fileteAlarma
  | typeof estilos.fileteInstrucciones
  | typeof estilos.fileteCita

/** Filete y sangría de cada variante. */
function estiloFilete(variante: BloqueDestacadoProps['variante']): EstiloFilete {
  if (variante === 'alarma') return estilos.fileteAlarma
  if (variante === 'instrucciones') return estilos.fileteInstrucciones
  return estilos.fileteCita
}

/** 2.I · `BloqueDestacado`. */
export default function BloqueDestacado({
  variante,
  texto,
}: BloqueDestacadoProps): ReactElement {
  return (
    // `wrap={false}` es la regla 3: un bloque destacado no se parte entre hojas.
    // Es el `break-inside: avoid` de la ficha y uno de los cuatro bloques
    // indivisibles que declara 2.N (`CONCILIA D44`).
    <View style={[estilos.bloque, estiloFilete(variante)]} wrap={false}>
      {/*
        RANURA DE 2.J. Cuando exista `ParserBloques`, la cadena se le entrega aquí
        y él decide qué es encabezado, qué es ítem y qué es párrafo — y en la
        variante `instrucciones` compone la lista NUMERADA de la regla 4. Hasta
        entonces el texto se compone en plano, que es lo único que este componente
        puede hacer sin inventarse un parser.
      */}
      <Text style={variante === 'alarma' ? estilos.textoAlarma : estilos.textoCorrido}>
        {texto}
      </Text>
    </View>
  )
}
