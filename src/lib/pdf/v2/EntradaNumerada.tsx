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
 * DOS EJES DE VARIANTE, LOS DOS DECLARADOS POR EL FORMATO
 *
 *   `calibracion`  `normal` · `compacta`   cuerpo, interlineado y aire de la fila
 *   `disposicion`  `apilada` · `columna`   dónde va la ranura `nota`
 *
 * Los dos entran porque la lámina los compone y el chasis no podía producirlos:
 * revierten `D4` y `D3` respectivamente. Son ortogonales y ninguno tiene valor por
 * defecto. **Ninguno de los dos se decide por el contenido en tiempo de render**,
 * que es lo único que I.3.4 prohíbe de verdad.
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
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * LAS DOS CALIBRACIONES DE FILA, Y POR QUÉ SON DOS
 *
 * `D4` las había colapsado a una con el argumento de que «un documento no cambia
 * de métrica según cuántos ítems tenga» (I.3.4). **Contra la lámina el argumento
 * es falso:** `SPEC_DISENO_PARTE_B.md` B.1 §3 mide dos calibraciones distintas en
 * el archivo aprobado de Laboratorio, y la compacta es la que hace que 18 estudios
 * quepan en una hoja. La decisión queda revertida.
 *
 * Lo que I.3.4 sí prohíbe se conserva: **la calibración NO se elige por el número
 * de ítems en tiempo de render.** La declara el formato, una vez, en su ficha de la
 * Sección II. Si algún día ves aquí un `estudios.length > N`, es D4 volviendo por
 * la puerta de atrás.
 *
 * Geometría interna del componente, MEDIDA en la lámina. No es miembro de la escala
 * de espaciado y no debe forzarse a serlo (I.1.7), igual que los anillos de 2.A o
 * el padding de celda de 2.F.
 *
 * **EN `normal`, LA REGLA NO ESTÁ CENTRADA Y ES DELIBERADO.** Queda 2 pt más cerca
 * de la entrada que ABRE que de la que cierra, así que se lee como apertura de la
 * siguiente y no como cierre de la anterior — que es lo que hace que una lista
 * larga se recorra hacia abajo en vez de leerse como bloques sueltos. **No lo
 * «centres»:** un 6/6 es la corrección que hay que no hacer. El archivo de diseño
 * traía tres variantes de ese desfase —5/7, 8/10 y 9/11— y gana la de 5/7, que es
 * la de las láminas con varios medicamentos.
 *
 * **EN `compacta` el padding SÍ es simétrico**, y tampoco es un descuido: B.1 §3 lo
 * declara como un solo «padding vertical» de 1.75 pt. Es una tabla, no una lista
 * que se recorre, y una tabla no necesita señalar dónde abre cada renglón.
 *
 *   normal    7 + `filete.regla` + 5     = 12.5 pt entre entradas
 *   compacta  1.75 + `filete.regla` + 1.75 = 4 pt entre filas
 */
const GEOMETRIA = {
  normal: {
    /** Aire bajo la entrada que termina. */
    aireInferior: 7,
    /** Aire sobre la entrada que empieza. */
    aireSuperior: 5,
    /** Regla entre entradas de una lista que se recorre. */
    regla: TINTA.hairline,
  },
  compacta: {
    aireInferior: 1.75,
    aireSuperior: 1.75,
    /** B.1 §3: la regla de la lista larga es `tinta.reglaFila`, más tenue. */
    regla: TINTA.reglaFila,
  },
  /**
   * Ancho de la columna de la nota en la disposición `columna`. B.1 §3 declara la
   * retícula de la tabla como `23.25pt 1fr 132pt` con medianil de 9 pt: el riel y
   * el medianil son `reticula.riel` y `reticula.medianil`, y este 132 es la tercera
   * columna. El `1fr` sale solo —486 − 23.25 − 9 − 132 − 9 = **312.75 pt**, que es
   * exactamente lo que B.1 §3 anota entre paréntesis—, así que no se declara aquí.
   */
  columnaNota: 132,
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
    marginTop: GEOMETRIA.normal.aireInferior,
    borderTopWidth: FILETE.regla,
    borderTopColor: GEOMETRIA.normal.regla,
    paddingTop: GEOMETRIA.normal.aireSuperior,
  },
  separacionCompacta: {
    marginTop: GEOMETRIA.compacta.aireInferior,
    borderTopWidth: FILETE.regla,
    borderTopColor: GEOMETRIA.compacta.regla,
    paddingTop: GEOMETRIA.compacta.aireSuperior,
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
  anclaCompacta: { ...estiloTipografico('entradaCompacta.ancla'), flex: 1 },
  /**
   * LA TERCERA COLUMNA DE LA DISPOSICIÓN `columna`, de ancho fijo.
   *
   * `D3` había resuelto que la lista de Laboratorio era «la misma
   * `EntradaNumerada` con dos ranuras» que la tabla de la lámina. **No lo es:** la
   * lámina pone estudio e indicación en el MISMO renglón y esta ranura apilaba la
   * nota debajo, duplicando el alto de cada fila. La decisión queda revertida y la
   * tabla entra como disposición de 2.G, no como componente paralelo (I.3.5).
   *
   * El ancho es fijo y no `flex`, que es lo que la hace una COLUMNA: se mantiene
   * aunque la celda venga vacía, y por eso las indicaciones de todas las filas
   * arrancan alineadas. Es también la respuesta a qué se imprime cuando un estudio
   * no tiene indicación — **nada, y la columna no se cierra** —; B.1 §3 no lo dice
   * con palabras, lo dice al declarar la retícula con un ancho fijo en vez de un
   * `auto`. Queda reportado como derivado, no como medido.
   */
  columnaNota: {
    width: GEOMETRIA.columnaNota,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
  },
  notaCompacta: { ...estiloTipografico('entradaCompacta.nota') },
  /**
   * La celda de indicación con la calibración `normal`. Ninguna lámina compone
   * `normal` + `columna` —Laboratorio es `compacta`—, así que el rol es el que la
   * ficha de 2.G ya declara para la ranura: `texto.corrido`.
   */
  notaColumna: { ...estiloTipografico('texto.corrido') },
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
  /**
   * CABECERA DE LA TABLA. A.11 la declara entera: Archivo 7 / 11 pt, 600, 0.22 em,
   * mayúsculas, #737373 —que es el rol `etiqueta` sin desviación—, con 6 pt de
   * `padding-bottom` y un filete de 2 pt en acento debajo. Los dos valores ya son
   * tokens: `transicion.tablaFilete` y `filete.acento`.
   *
   * Vive aquí y no en el formato para que la retícula de tres columnas tenga UN
   * solo sitio de definición (I.3.5): la cabecera y las filas tienen que alinearse
   * por construcción, no por dos cifras que alguien mantenga iguales a mano.
   */
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: TRANSICION.tablaFilete,
    borderBottomWidth: FILETE.acento,
  },
  rotulo: { ...estiloTipografico('etiqueta') },
  /**
   * CIERRE DE LA TABLA. A.11: 0.8 pt `tinta.negra` con `margin-top: -0.5pt`. El
   * margen negativo NO es un ajuste óptico: solapa el cierre con la regla de
   * 0.5 pt que la última fila arrastra encima, para que las dos no se lean como
   * una línea doble. Sin él, el pie de la tabla pesa más que su cabecera.
   */
  cierre: {
    marginTop: -FILETE.regla,
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
  },
})

/**
 * Cuál de las dos calibraciones de fila usa la lista. **La declara el formato**,
 * nunca el número de ítems (ver la nota de `GEOMETRIA`).
 */
export type CalibracionEntrada = 'normal' | 'compacta'

/**
 * Dónde va la ranura `nota` respecto del `ancla`.
 *
 *   `apilada`  bajo el ancla, a `espacio.8`, compuesta por 2.J. Receta, Suplementación
 *   `columna`  en el MISMO renglón, en la tercera columna de 132 pt. Laboratorio
 *
 * En `columna` la nota **no pasa por 2.J**: B.1 Pregunta A es explícita en que la
 * celda de indicación «son datos, no prosa», y por eso el cambio de chasis a
 * `texto.corrido` no la toca. Se compone como celda, con el rol de la calibración.
 */
export type DisposicionNota = 'apilada' | 'columna'

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
  /**
   * Calibración de fila. Sin valor por defecto a propósito, igual que `primera`:
   * las dos producen documentos válidos y distintos, así que ninguna puede entrar
   * por omisión. La declara la ficha del formato en la Sección II.
   */
  calibracion: CalibracionEntrada
  /** Disposición de la ranura `nota`. Mismo criterio que `calibracion`. */
  disposicion: DisposicionNota
}

/** Regla 1: dos dígitos hasta 99. Por encima crece, nunca se trunca. */
function formatearNumero(numero: number): string {
  return String(numero).padStart(2, '0')
}

export interface CabeceraEntradasProps {
  /** Rótulo del riel del número. En el espécimen y en la lámina, `#`. */
  readonly numero: string
  /** Rótulo de la columna del ancla. */
  readonly ancla: string
  /** Rótulo de la columna de la nota. */
  readonly nota: string
  readonly acento: AcentoResuelto
}

/**
 * La cabecera de la tabla, para la disposición `columna`.
 *
 * **II.1 §5 la había PROHIBIDO**, declarando como excepción que «la lista es de una
 * sola columna» porque «el renderer viejo dibujaba el encabezado de una segunda
 * columna sin filas debajo» (auditoría §8.2). Eso describe una cabecera HUÉRFANA
 * —un rótulo sin nada que rotular—, no una cabecera. La lámina la compone, A.11 la
 * declara con todos sus valores y B.1 §5 le reserva presupuesto propio (`cabTabla`).
 *
 * Solo tiene sentido con `disposicion="columna"`: sin tercera columna no hay dos
 * rótulos que separar, y una cabecera sobre una lista apilada volvería a ser la
 * huérfana de §8.2.
 */
export function CabeceraEntradas({
  numero,
  ancla,
  nota,
  acento,
}: CabeceraEntradasProps): ReactElement {
  return (
    <View style={[estilos.cabecera, { borderBottomColor: acento.base }]}>
      <View style={estilos.riel}>
        <Text style={estilos.rotulo}>{numero.toUpperCase()}</Text>
      </View>
      <Text style={[estilos.rotulo, estilos.contenido]}>{ancla.toUpperCase()}</Text>
      <Text style={[estilos.rotulo, estilos.columnaNota]}>{nota.toUpperCase()}</Text>
    </View>
  )
}

/** El filete que cierra la tabla bajo la última fila (A.11). */
export function CierreEntradas(): ReactElement {
  return <View style={estilos.cierre} />
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
  calibracion,
  disposicion,
}: EntradaNumeradaProps): ReactElement {
  const compacta = calibracion === 'compacta'
  const enColumna = disposicion === 'columna'

  return (
    // Regla 4: `wrap={false}` es el `break-inside: avoid` de la ficha. Es uno de
    // los cuatro bloques indivisibles que declara 2.N (`CONCILIA D44`).
    <View
      style={[
        estilos.entrada,
        primera ? {} : compacta ? estilos.separacionCompacta : estilos.separacion,
      ]}
      wrap={false}
    >
      <View style={estilos.riel}>
        {/*
          El único estilo de v2 que no puede vivir en `StyleSheet.create`: el rol
          del número va en `acento.tinta` y el acento entra por prop, así que se
          resuelve en el render. Se ESPARCE en un literal a propósito — el
          `EstiloTipografico` que devuelve la función es una interfaz, y el `Style`
          de react-pdf lleva un índice de media queries que TypeScript presta a un
          objeto inferido pero nunca a una interfaz. Es la misma razón que ya está
          anotada en 2.B, 2.D, 2.F y 2.I, vista desde el otro lado.
        */}
        <Text
          style={{
            ...estiloTipografico(
              compacta ? 'entradaCompacta.numero' : 'entrada.numero',
              acento,
            ),
          }}
        >
          {formatearNumero(numero)}
        </Text>
      </View>

      <View style={estilos.contenido}>
        <View style={estilos.filaAncla}>
          <Text style={compacta ? estilos.anclaCompacta : estilos.ancla}>{ancla}</Text>
          {tieneValor(marca) ? (
            <View style={estilos.cajaMarca}>
              <BloqueNegativo variante="via" via={marca} />
            </View>
          ) : null}
        </View>

        {tieneValor(secundario) ? (
          <Text style={estilos.secundario}>{secundario}</Text>
        ) : null}

        {/*
          La nota APILADA pasa por 2.J. En la práctica es prosa —una indicación— y
          de ahí sale como prosa, que es la degradación segura del parser; si el
          médico escribe viñetas, salen como lista en vez de como una tirada de
          guiones sueltos. Raya y no número: una indicación enumera sin orden, no
          describe una secuencia.

          En `columna` no pasa por aquí: sale de este bloque y se compone como
          celda, abajo. Ver `DisposicionNota`.

          NO DEFINIDO — `compacta` + `apilada`. Ninguna lámina compone esa pareja, y
          2.J tiene su lista de roles de cuerpo cerrada a dos (`texto.corrido` y
          `alarma.cuerpo`), así que la nota apilada saldría a 11.5 / 18 aunque la
          fila esté calibrada a 9 / 11.5. No se resuelve inventando: cuando exista
          una lámina que lo use, se mide y se abre la ranura en 2.J.
        */}
        {!enColumna && tieneValor(nota) ? (
          <View style={estilos.nota}>
            <ParserBloques texto={nota} marca="raya" />
          </View>
        ) : null}
      </View>

      {enColumna ? (
        <View style={estilos.columnaNota}>
          {tieneValor(nota) ? (
            <Text style={compacta ? estilos.notaCompacta : estilos.notaColumna}>
              {nota}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
