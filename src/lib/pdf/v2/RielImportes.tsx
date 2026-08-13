/**
 * Sistema de documentos v2 — componente 2.T · `RielImportes`.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina de Recibo y Cotización**,
 * con `DOCUMENTOS_SPEC.md` I.2 · 2.T como ficha de referencia.
 *
 * Propósito: el cierre económico del documento. Es el único bloque del sistema con
 * jerarquía de cifra.
 *
 * ⚠ **EL ANCHO ES 246 pt Y AQUÍ ESO ES `cierre.izquierda`, NO `cierre.derecha`.**
 *
 * La ficha dice «caja de ancho `cierre.derecha` (246 pt)» y **la cifra es la buena y
 * el nombre no**: se escribió antes de que la capa de tokens corrigiera los dos
 * nombres contra B.3 y B.4, donde `cierre.izquierda` pasó a ser el valor propio (246)
 * y `cierre.derecha` el derivado (216). Lo que esta lámina añade es que el reparto
 * **246 / 24 / 216 no siempre cae del mismo lado**: aquí la columna ancha es la
 * DERECHA —el riel de importes, que la lámina sitúa en `x = 312`— y la estrecha la
 * izquierda, donde va la firma en `x = 72`. Ver la nota de `Lamina` en la capa de
 * tokens antes de tocar cualquiera de los dos nombres.
 *
 * **Y NO ES `manuscrito.ancho`, aunque mida lo mismo** (`CIERRA H9`). Si algún día
 * cambia el ancho de la línea que se llena a pluma, esta caja no se mueve. Es el error
 * que este componente ya cometió una vez en el spec.
 *
 * LAS TRES REGLAS
 *
 * 1. **Cifras tabulares en todas las filas, alineadas por la unidad.** Es el único
 *    bloque del sistema donde una columna de números tiene que sumar visualmente. Aquí
 *    eso NO se compone alineando por el punto decimal: las cifras se apoyan en el
 *    borde derecho del riel y la fuente aporta las cifras tabulares, así que las
 *    unidades caen en la misma vertical sin depender de cuántos dígitos traiga cada
 *    importe. Un ancho de columna variable rompería la regla; por eso el importe de
 *    las filas menores tiene ancho declarado.
 * 2. **El total es la única cifra del sistema que sube de escala.** Comparte cuerpo con
 *    `marca.estado`, que también es 22: es `COINCIDENCIA` y no identidad —un sello
 *    hueco y girado no es una cifra— y **no se fusionan**.
 * 3. **Anticipo y saldo colapsan por separado**, y los subtotales colapsan juntos. Con
 *    ellos se va el filete, que es lo que los separa del total: un filete sobre nada
 *    es una línea que no divide.
 *
 * LO QUE LA LÁMINA CONTRADICE DE LA FICHA, Y GANA LA LÁMINA
 *
 * a. **El total no siempre va en tercer lugar.** La ficha declara un orden único
 *    —subtotales → total → anticipo → saldo— y la lámina compone dos: en la cotización
 *    el total CIERRA la columna y en el recibo la ABRE, con el anticipo y el saldo
 *    debajo. Es lo que hace `disposicion`, y **la declara el formato**, nunca el
 *    contenido (I.3.4).
 * b. ⚠ **LA DIVISA VA EN IBM PLEX MONO EN LA LÁMINA Y AQUÍ EN LA NEO-GROTESCA.** I.1.4
 *    la prohíbe en documento impreso y este es el **sexto** caso idéntico
 *    (`CONCILIA D13, D20, D30`). Lo mismo con la fecha del anticipo. Reportado.
 * c. **El bloque del total mide 44.25 pt en la lámina y aquí compone 24.** Ninguna
 *    lectura de sus tres piezas llega a esa cifra: apiladas dan 46 —11 + 11 + 24— y en
 *    la fila que la propia lámina declara —«flex, medianil 16»— dan los 24 de la cifra,
 *    que es la pieza más alta. Se compone la fila, que es lo que la lámina dice y lo
 *    único que cumple la regla 1: apilado, el rótulo empujaría la cifra fuera de la
 *    columna de números. Reportado.
 *
 * QUIÉN LO COLOCA
 *
 * El formato, en la columna derecha de su fila de cierre. Este componente no sabe en
 * qué hoja está ni lleva `wrap={false}`: la indivisibilidad del cierre la monta 2.N,
 * que es quien decide dónde corta.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { tieneValor } from './Campo'
import {
  CIERRE,
  ESPACIO,
  FILETE_HONORARIOS,
  FUENTE,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
} from './tokens'

/**
 * Geometría interna de ESTE componente, medida en la lámina. I.1.7: lo que usa un solo
 * componente en un solo sitio se declara en su ficha y no en la escala tipográfica.
 *
 * **Es la razón por la que aquí hay cuerpos escritos y en un formato no los habría.**
 * La ficha de 2.T declara sus filas menores en el rol `dato` —12 / 16— y la lámina las
 * compone a 8 / 15 y 10.5 / 15; el total lo declara como geometría propia y no como
 * rol, y esa misma lectura vale para las otras cuatro piezas: un solo consumidor.
 *
 * Solo se declara lo que SE DESVÍA del rol del que parte cada pieza. Familia, peso,
 * tracking y color siguen saliendo del rol salvo donde esta tabla dice otra cosa.
 *
 *   `etiqueta`   parte de `dato`: cuerpo 8, interlineado 15, tracking 0.1 em, secundaria
 *   `importe`    parte de `dato`: cuerpo 10.5, interlineado 15
 *   `rotulo`     parte de `etiqueta`: cuerpo 8, `tinta.negra` — la versalita del sistema
 *   `divisa`     parte de `medico.credencial`: tracking 0.1 em
 *   `cifra`      geometría declarada por la ficha: 22 / 24, 600, −0.012 em, tinta plena
 *   `saldo`      el importe un peso arriba y a cuerpo 12
 *   `fecha`      parte de `medico.credencial`: cuerpo 6.5, interlineado 10, etiqueta
 *
 * Los tres trackings salen del píxel, con la conversión que ya validó los de la banda
 * de pie: 1.067 px a 8 pt son 0.1 em, 2.347 px a 8 pt son 0.22 em —la versalita del
 * sistema— y −0.352 px a 22 pt son −0.012 em, que es el de `medico.nombre` y el de
 * `firma.nombre`. Ninguno es una cifra nueva.
 */
const GEOMETRIA = {
  /** Ancho de la columna de importes de las filas menores. Ver la regla 1. */
  importe: 78.5,
  /** Alto de una fila menor: subtotal, anticipo, saldo. */
  interlineadoFila: 15,
  etiqueta: { cuerpo: 8, tracking: 0.1 },
  importeCifra: { cuerpo: 10.5 },
  rotuloTotal: { cuerpo: 8 },
  divisa: { tracking: 0.1 },
  cifra: { cuerpo: 22, interlineado: 24, peso: 600 as const, tracking: -0.012 },
  saldo: { cuerpo: 12, peso: 600 as const },
  fecha: { cuerpo: 6.5, interlineado: 10 },
  /** Medianil entre el bloque de rótulo y la cifra del total. */
  medianilTotal: 16,
  /** Aire sobre el filete que separa el total de las filas menores. */
  aireFilete: ESPACIO[5],
  /** Aire bajo el filete. */
  aireTotal: 6,
  /** La fecha del anticipo se monta bajo su cifra, no a un renglón de distancia. */
  aireFecha: -2,
} as const

const estilos = StyleSheet.create({
  /**
   * La caja. **No lleva `alignItems: 'flex-end'`**: lo que alinea las cifras a la
   * derecha es que cada fila ocupe el ancho entero y su importe se alinee dentro
   * (regla 1). Con las cajas encogidas al contenido, dos importes de distinto largo
   * acabarían en dos verticales distintas.
   */
  riel: {
    width: CIERRE.izquierda,
    flexShrink: 0,
  },
  fila: {
    flexDirection: 'row',
  },
  /**
   * La etiqueta de una fila menor. Parte de `dato` y se desvía en cuerpo,
   * interlineado, tracking y color; la división por el cuerpo es la misma conversión
   * que hace `estiloTipografico()`, que no sirve aquí porque una desviación declarada
   * no está en la escala. Mismo caso que la celda de diagnóstico de 2.D.
   */
  etiqueta: {
    ...estiloTipografico('dato'),
    flex: 1,
    fontSize: GEOMETRIA.etiqueta.cuerpo,
    lineHeight: GEOMETRIA.interlineadoFila / GEOMETRIA.etiqueta.cuerpo,
    letterSpacing: GEOMETRIA.etiqueta.tracking * GEOMETRIA.etiqueta.cuerpo,
    color: TINTA.secundaria,
  },
  importe: {
    ...estiloTipografico('dato'),
    width: GEOMETRIA.importe,
    textAlign: 'right',
    flexShrink: 0,
    fontSize: GEOMETRIA.importeCifra.cuerpo,
    lineHeight: GEOMETRIA.interlineadoFila / GEOMETRIA.importeCifra.cuerpo,
  },
  /** El saldo: la misma fila un peso arriba y con la cifra a cuerpo 12. */
  etiquetaSaldo: {
    fontWeight: GEOMETRIA.cifra.peso,
  },
  importeSaldo: {
    fontSize: GEOMETRIA.saldo.cuerpo,
    lineHeight: GEOMETRIA.interlineadoFila / GEOMETRIA.saldo.cuerpo,
    fontWeight: GEOMETRIA.saldo.peso,
  },
  /**
   * La fecha del anticipo, pegada a su cifra. El margen NEGATIVO es de la lámina y no
   * un ajuste óptico: la fecha califica el importe de arriba, así que se monta dentro
   * de su interlineado en vez de abrir un renglón propio.
   *
   * ⚠ La lámina la compone en IBM Plex Mono. Ver el punto (b) de la cabecera.
   */
  fecha: {
    ...estiloTipografico('medico.credencial'),
    textAlign: 'right',
    marginTop: GEOMETRIA.aireFecha,
    fontSize: GEOMETRIA.fecha.cuerpo,
    lineHeight: GEOMETRIA.fecha.interlineado / GEOMETRIA.fecha.cuerpo,
    color: TINTA.etiqueta,
  },
  /**
   * El filete que separa el total de las filas menores. `filete_honorarios.regla`, la
   * misma cifra con la que esta lámina dibuja la regla de su tabla y la línea de
   * escritura de su riel — y en `tinta.negra`, que es lo que la distingue de aquellas.
   */
  filete: {
    marginTop: GEOMETRIA.aireFilete,
    borderTopWidth: FILETE_HONORARIOS.regla,
    borderTopColor: TINTA.negra,
  },
  /** La fila del total: rótulo y divisa a la izquierda, cifra a la derecha. */
  total: {
    flexDirection: 'row',
    // Las dos columnas se apoyan por su borde inferior, que es lo único alineable
    // aquí: react-pdf no le da a Yoga una función de línea base (ver `cajaFecha` en
    // 2.C). Así la cifra y la divisa cierran a la misma altura.
    alignItems: 'flex-end',
  },
  totalConAire: {
    marginTop: GEOMETRIA.aireTotal,
  },
  bloqueRotulo: {
    flex: 1,
  },
  /** Versalita: mayúsculas con tracking, en tinta plena y un cuerpo por encima. */
  rotuloTotal: {
    ...estiloTipografico('etiqueta'),
    fontSize: GEOMETRIA.rotuloTotal.cuerpo,
    letterSpacing: TIPOGRAFIA.etiqueta.tracking * GEOMETRIA.rotuloTotal.cuerpo,
    color: TINTA.negra,
  },
  /** ⚠ La lámina la compone en IBM Plex Mono. Ver el punto (b) de la cabecera. */
  divisa: {
    ...estiloTipografico('medico.credencial'),
    letterSpacing:
      GEOMETRIA.divisa.tracking * TIPOGRAFIA['medico.credencial'].cuerpo,
  },
  /**
   * LA CIFRA DEL TOTAL. Los cuatro valores son de la ficha de 2.T y tres de ellos los
   * DERIVA ella misma del riel en el que vive: tracking 0 —el de todos los roles con
   * cifra salvo `folio`—, `tinta.negra` —porque una columna que cambia de tinta entre
   * sus filas y su total deja de leerse como una columna— y sin interlineado propio.
   *
   * ⚠ **AQUÍ SÍ LLEVA INTERLINEADO Y TRACKING, Y LOS DOS SON DE LA LÁMINA:** 22 / 24 y
   * −0.012 em. La ficha los dejó en «sin interlineado propio» y «tracking 0» razonando
   * desde el riel, sin lámina delante; ahora la hay. Reportado.
   */
  cifra: {
    fontFamily: FUENTE.neogrotesca,
    fontSize: GEOMETRIA.cifra.cuerpo,
    lineHeight: GEOMETRIA.cifra.interlineado / GEOMETRIA.cifra.cuerpo,
    fontWeight: GEOMETRIA.cifra.peso,
    letterSpacing: GEOMETRIA.cifra.tracking * GEOMETRIA.cifra.cuerpo,
    color: TINTA.negra,
    textAlign: 'right',
    flexShrink: 0,
    marginLeft: GEOMETRIA.medianilTotal,
  },
})

/** Una fila menor del riel: su etiqueta y su importe, los dos ya redactados. */
export interface FilaImporte {
  readonly etiqueta: string
  /** Ya compuesto por quien llama, con su signo y su divisa. 2.T no formatea. */
  readonly importe: string
}

/**
 * El anticipo y lo que cuelga de él. Colapsa entero, y el saldo colapsa dentro
 * (regla 3): un recibo puede llevar anticipo sin declarar saldo pendiente.
 */
export interface AnticipoRecibido extends FilaImporte {
  /** Fecha del anticipo, YA compuesta. Colapsa sola. */
  /*
    ── AQUÍ NO HAY `fecha`, Y NO ES UN OLVIDO ────────────────────────────────

    La fecha del anticipo se componía bajo su cifra, montada dentro del interlineado. Su
    único consumidor era II.5 y **nadie la alimentaba**: `NotaHonorariosForm` guarda
    `anticipo` como un número y no tiene campo de fecha detrás. Retirada con las siete
    ranuras sin productor. Sus estilos —`estilos.fecha` y `GEOMETRIA.fecha`— se quedan:
    los usa la credencial del médico, que es de donde salen sus cifras.
  */
  /** El saldo que queda. Colapsa solo. */
  readonly saldo?: FilaImporte
}

interface Comun {
  /** `Total estimado` o `Total`. Se compone en versalita aquí. */
  readonly rotuloTotal: string
  /** La divisa, ya redactada: `MXN · Pesos mexicanos`. Colapsa si no viene. */
  readonly divisa?: string
  /** La cifra del total, ya compuesta por quien llama. */
  readonly total: string
}

export type RielImportesProps = Comun &
  (
    /**
     * Cotización: las filas de subtotal ABREN la columna y el total la cierra. El
     * arreglo vacío colapsa las filas y su filete (regla 3).
     */
    | { readonly disposicion: 'subtotales'; readonly subtotales: readonly FilaImporte[] }
    /** Recibo: el total ABRE la columna y el anticipo cuelga debajo. */
    | { readonly disposicion: 'anticipo'; readonly anticipo?: AnticipoRecibido }
  )

/** Una fila menor. `destacada` es el saldo, que va un peso por encima. */
function Fila({
  fila,
  destacada = false,
}: {
  readonly fila: FilaImporte
  readonly destacada?: boolean
}): ReactElement {
  return (
    <View style={estilos.fila}>
      <Text style={[estilos.etiqueta, destacada ? estilos.etiquetaSaldo : {}]}>
        {fila.etiqueta}
      </Text>
      <Text style={[estilos.importe, destacada ? estilos.importeSaldo : {}]}>
        {fila.importe}
      </Text>
    </View>
  )
}

/** 2.T · `RielImportes`. */
export default function RielImportes(props: RielImportesProps): ReactElement {
  const subtotales =
    props.disposicion === 'subtotales' ? props.subtotales : []
  const anticipo = props.disposicion === 'anticipo' ? props.anticipo : undefined

  /**
   * El total va DESPUÉS de las filas menores en la cotización y ANTES en el recibo, y
   * en un caso lleva el aire del filete encima y en el otro no. Se compone una vez y
   * se coloca donde toca: dos copias del mismo bloque acabarían divergiendo.
   */
  const total = (
    <View
      style={[
        estilos.total,
        props.disposicion === 'subtotales' && subtotales.length > 0
          ? estilos.totalConAire
          : {},
      ]}
    >
      <View style={estilos.bloqueRotulo}>
        <Text style={estilos.rotuloTotal}>{props.rotuloTotal.toUpperCase()}</Text>
        {tieneValor(props.divisa) ? (
          <Text style={estilos.divisa}>{props.divisa}</Text>
        ) : null}
      </View>
      <Text style={estilos.cifra}>{props.total}</Text>
    </View>
  )

  return (
    <View style={estilos.riel}>
      {props.disposicion === 'subtotales' ? (
        <>
          {subtotales.map((fila) => (
            <Fila key={fila.etiqueta} fila={fila} />
          ))}
          {/* Regla 3: sin subtotales no hay nada que separar del total. */}
          {subtotales.length === 0 ? null : <View style={estilos.filete} />}
          {total}
        </>
      ) : (
        <>
          {total}
          {anticipo === undefined ? null : (
            <>
              <View style={estilos.filete} />
              <Fila fila={anticipo} />
              {anticipo.saldo === undefined ? null : (
                <Fila fila={anticipo.saldo} destacada />
              )}
            </>
          )}
        </>
      )}
    </View>
  )
}
