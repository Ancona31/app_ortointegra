/**
 * Sistema de documentos v2 — componente 2.G · `EntradaNumerada`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.G. Transcripción, no diseño.
 *
 * Propósito: el ítem de lista del sistema. Base de Receta, Plan de Suplementación
 * e Imagenología.
 *
 * LAS CINCO RANURAS, Y QUIÉN DECIDE QUÉ VA EN CADA UNA
 *
 *   riel del número   `01`, `02`…                    rol `entrada.numero`
 *   `ancla`           los dos datos de mayor peso    rol `entrada.ancla`
 *   `secundario`      dato de apoyo bajo el ancla    rol `entrada.secundario`
 *   `marca`           bloque en negativo (2.H)       si el formato lo usa
 *   `nota`            texto en humanista (2.J)       rol `texto.corrido`
 *
 * **Qué dato ocupa cada ranura lo declara el FORMATO en la Sección II.** Este
 * componente declara las ranuras, no su contenido: no sabe que el ancla de la
 * Receta lleva el comercial y el gramaje, ni que la marca lleva la vía. Por eso
 * la prop de la marca se llama `marca` y no `via`.
 *
 * LAS CINCO REGLAS
 *
 * 1. **Cero a la izquierda: `01`, no `1`.** Dos dígitos hasta 99.
 * 2. **Una sola entrada SÍ se numera.** Es la diferencia con 2.J, donde un solo
 *    ítem no se numera y se compone como párrafo. Son dos listas distintas y la
 *    confusión es previsible: aquí el número identifica el ítem —la farmacia
 *    despacha «el 02»—, allí solo ordena una enumeración.
 * 3. **Regla entre entradas, no antes de la primera ni después de la última.**
 * 4. **`break-inside: avoid`.** Una entrada nunca se parte entre hojas.
 * 5. **El `secundario` va en TINTA PLENA.** En Receta ese renglón es la
 *    denominación genérica: el único campo obligatorio por normativa. No puede
 *    componerse como dato de segunda. El rol ya lo trae en `tinta.negra` — si
 *    alguna vez ves un gris aquí, es un defecto, no una jerarquía.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueNegativo from './BloqueNegativo'
import ParserBloques from './ParserBloques'
import { tieneValor } from './Campo'
import {
  ESPACIO,
  FILETE,
  RETICULA,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría interna del componente, MEDIDA en la lámina aprobada. No es miembro
 * de la escala de espaciado y no debe forzarse a serlo (I.1.7), igual que los
 * anillos de 2.A o el padding de celda de 2.F.
 *
 * **LA REGLA NO ESTÁ CENTRADA Y ES DELIBERADO.** Queda 2 pt más cerca de la
 * entrada que ABRE que de la que cierra, así que se lee como apertura de la
 * siguiente y no como cierre de la anterior — que es lo que hace que una lista
 * larga se recorra hacia abajo en vez de leerse como bloques sueltos. **No lo
 * «centres»:** un 6/6 es la corrección que hay que no hacer.
 *
 * Total entre dos entradas: 7 + `filete.regla` + 5 = 12.5 pt. El archivo de
 * diseño traía tres calibraciones —5/7, 8/10 y 9/11, todas con el mismo desfase—
 * y gana la de las láminas con varios medicamentos, que es el caso real: un
 * documento no cambia de métrica según cuántos ítems tenga (`CONCILIA D4`).
 */
const GEOMETRIA = {
  /** Aire bajo la entrada que termina. */
  aireInferior: 7,
  /** Aire sobre la entrada que empieza. */
  aireSuperior: 5,
} as const

const estilos = StyleSheet.create({
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /**
   * REGLA 3, EN UNA SOLA BANDERA. Los 7 pt son «padding inferior de la entrada
   * que termina» y aquí se implementan como margen superior de la que sigue: el
   * resultado impreso es idéntico —nada se interpone entre las dos— y así basta
   * con saber si una entrada es la primera para no dejar regla ni aire sobrante
   * en ninguno de los dos extremos de la lista.
   *
   * Implementarlo como padding inferior obligaría a saber además cuál es la
   * ÚLTIMA, y una lista paginada no sabe cuál es la última hasta que el motor de
   * flujo (2.N) ha decidido dónde corta.
   */
  separacion: {
    marginTop: GEOMETRIA.aireInferior,
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
    paddingTop: GEOMETRIA.aireSuperior,
  },
  /**
   * El riel del número. Ancho fijo `reticula.riel` más `reticula.medianil`: la
   * misma anatomía que el ítem colgante de 2.J y la sección de 2.P, y la suma es
   * una columna exacta (23.25 + 9 = 32.25 = `reticula.columna`).
   *
   * Lo que alinea los números entre sí es el ancho fijo de esta caja, no una
   * alineación declarada: con dos dígitos siempre, `01` y `02` empiezan y acaban
   * en el mismo sitio.
   */
  riel: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  contenido: {
    flex: 1,
  },
  filaAncla: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /** El ancla toma el ancho restante y rompe sola. Sin truncado. */
  ancla: { ...estiloTipografico('entrada.ancla'), flex: 1 },
  /**
   * LA MARCA VA EN LA FILA DEL ANCLA, a la derecha.
   *
   * La ficha no declara su posición, y la tabla de separaciones internas sí dice
   * algo: declara `ancla` → `secundario` y `secundario` → `nota`, sin ningún
   * tramo que toque la marca. Con la marca en el flujo vertical esa tabla tendría
   * un hueco, y este spec no deja huecos en silencio. Va, por tanto, fuera del
   * flujo: sobre la fila del ancla, que es el renglón que la marca califica.
   *
   * El medianil no lo declara la ficha: se usa el separador de columnas del
   * sistema en vez de inventar una cifra, que es lo mismo que hizo 2.C con el
   * hueco entre el título y la fecha.
   */
  cajaMarca: {
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
  },
  /** REGLA 5: tinta plena. El rol ya la trae; no se aclara aquí ni en el dato. */
  secundario: {
    ...estiloTipografico('entrada.secundario'),
    marginTop: ESPACIO[4],
  },
  /** La nota cambia de familia y de registro, así que sube un miembro (H4). */
  nota: {
    marginTop: ESPACIO[8],
  },
})

export interface EntradaNumeradaProps {
  /**
   * El ordinal de la entrada en el DOCUMENTO, no en la hoja: una lista que sigue
   * en la hoja 2 continúa en `04`, no vuelve a empezar.
   */
  numero: number
  /**
   * ¿Es la primera de la lista? Sin valor por defecto a propósito, por el mismo
   * motivo que `requerido` en 2.E: los dos valores posibles producen un defecto
   * visible —una regla flotando sobre la primera entrada, o una lista entera sin
   * reglas— y ninguno de los dos debe poder ocurrir por omisión.
   */
  primera: boolean
  /** Los dos datos de mayor peso, ya compuestos en una línea por el formato. */
  ancla: string
  /** Dato de apoyo bajo el ancla. Colapsa si no viene. */
  secundario?: string
  /**
   * La palabra del bloque en negativo (2.H), si el formato usa esta ranura. En
   * Receta es la vía de administración; el componente no lo sabe ni tiene por qué.
   */
  marca?: string
  /** Texto en humanista, compuesto por 2.J. Colapsa si no viene. */
  nota?: string
  /** El número va en `acento.tinta`, que es el único color que necesita acento. */
  acento: AcentoResuelto
}

/** Regla 1: dos dígitos hasta 99. Por encima crece, nunca se trunca. */
function formatearNumero(numero: number): string {
  return String(numero).padStart(2, '0')
}

/** 2.G · `EntradaNumerada`. */
export default function EntradaNumerada({
  numero,
  primera,
  ancla,
  secundario,
  marca,
  nota,
  acento,
}: EntradaNumeradaProps): ReactElement {
  return (
    // Regla 4: `wrap={false}` es el `break-inside: avoid` de la ficha. Es uno de
    // los cuatro bloques indivisibles que declara 2.N (`CONCILIA D44`).
    <View style={[estilos.entrada, primera ? {} : estilos.separacion]} wrap={false}>
      <View style={estilos.riel}>
        {/*
          El único estilo de v2 que no puede vivir en `StyleSheet.create`: el rol
          `entrada.numero` va en `acento.tinta` y el acento entra por prop, así
          que se resuelve en el render. Se ESPARCE en un literal a propósito — el
          `EstiloTipografico` que devuelve la función es una interfaz, y el `Style`
          de react-pdf lleva un índice de media queries que TypeScript presta a un
          objeto inferido pero nunca a una interfaz. Es la misma razón que ya está
          anotada en 2.B, 2.D, 2.F y 2.I, vista desde el otro lado.
        */}
        <Text style={{ ...estiloTipografico('entrada.numero', acento) }}>
          {formatearNumero(numero)}
        </Text>
      </View>

      <View style={estilos.contenido}>
        <View style={estilos.filaAncla}>
          <Text style={estilos.ancla}>{ancla}</Text>
          {tieneValor(marca) ? (
            <View style={estilos.cajaMarca}>
              <BloqueNegativo variante="via" via={marca} />
            </View>
          ) : null}
        </View>

        {tieneValor(secundario) ? (
          <Text style={estilos.secundario}>{secundario}</Text>
        ) : null}

        {tieneValor(nota) ? (
          <View style={estilos.nota}>
            {/*
              La nota pasa por 2.J. En la práctica es prosa —una indicación— y de
              ahí sale como prosa, que es la degradación segura del parser; si el
              médico escribe viñetas, salen como lista en vez de como una tirada
              de guiones sueltos. Raya y no número: una indicación enumera sin
              orden, no describe una secuencia.
            */}
            <ParserBloques texto={nota} marca="raya" />
          </View>
        ) : null}
      </View>
    </View>
  )
}
