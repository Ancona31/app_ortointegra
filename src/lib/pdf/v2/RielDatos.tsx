/**
 * Sistema de documentos v3 — 2.F · **RielDatos**, la **ficha de identificación**.
 * «Presentar varios datos cortos en una banda horizontal, cada uno con su etiqueta.»
 *
 * CAMBIOS v3 (brief 00 §5):
 *
 *   relleno superior       3 → **2**            relleno inferior  4 → **3**
 *   rótulo                 7/10 · 7/11 → **`etiqueta`, 6.5/9**
 *   valor                  11.5/13 · 11/15 · 12/16 → **`dato` 10.5/13** (chasis)
 *                                                    **11.5/14** (declaración)
 *   alto de fila base      30 · 33 → **27** (chasis) · **28.5** (declaración)
 *   filetes del riel       0.8 · 0.75 · 0.475 → **`FILETE.fino`, 0.8, único**
 *   regla entre celdas     0.5 · 0.375 · 0.63 → **`FILETE.regla`, 0.5, única**
 *
 * ⚠ **EL ALTO NO ES FIJO Y NUNCA LO FUE: es `base + interlineado × (líneas − 1)`.**
 * Una ficha de cuatro filas con tres valores envueltos mide **158 pt, no 114**, y
 * todo cálculo de capacidad se hace contra el alto real. Por eso **ninguna celda
 * declara `height`**: el alto lo resuelve Yoga a partir del padding y del texto. Quien
 * fije la altura para «cuadrar» la ficha recorta el valor sin avisar.
 *
 * ── LO QUE SE RETIRA, Y CON ELLO LA MITAD DEL ARCHIVO ────────────────────────
 *
 *   `Lamina` y las seis desviaciones por lámina   una composición, dos calibraciones
 *   `valorDeCelda()` · `VALOR_CELDA` · `ETIQUETA_CELDA`   los sustituye `FICHA`
 *   `etiquetaSecundaria`   la celda de peso pierde su `BASE DEL CÁLCULO` (brief 04 §2.1)
 *   `reglaIzquierda`       era el borde de acento de 1.9 de una lámina; se va con
 *                          `FILETE_SUPLEMENTACION`
 *   `paddingIzquierdo`     pasa a ser REGLA: la primera celda viva de cada fila no
 *                          lleva relleno izquierdo, y no hace falta declararlo celda a celda
 *
 * ── LO QUE NO CAMBIA ────────────────────────────────────────────────────────
 *
 * La regla 1 —una celda mide COLUMNAS de `RIEL_CELDA`, nunca un ancho arbitrario—, los
 * tres estados de celda, el hairline como borde IZQUIERDO de la celda que sigue (y
 * nunca en la primera viva de la fila, que es lo que evita el filete colgando en el
 * margen), y la variante `catalogo`.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { FICHA, FILETE, RIEL_CELDA, TINTA, estiloTipografico } from './tokens'

/** Las dos calibraciones de celda. La segunda es Consentimiento y Denegación. */
export type CalibracionFicha = 'chasis' | 'declaracion'

/**
 * Alto y grosor de la línea de escritura de un campo vacío requerido, medidos en la
 * lámina. `APUESTA`: el 16.47 es el alto de la caja de línea del HTML de origen; si
 * al render la celda vacía sale más alta que su vecina con dato, lo que hay que mirar
 * es este valor —debería dar 13, el interlineado del valor, más su aire—.
 */
const LINEA_ESCRITURA = { alto: 16.47, grosor: FILETE.tabla } as const

export interface CeldaRiel {
  /** Identidad estable de la celda dentro de la ficha. */
  readonly clave: string
  /** Se compone en versalita aquí: no la pases ya en mayúsculas. */
  readonly etiqueta: string
  /** Ausente o vacío es lo mismo: la celda colapsa y las demás redistribuyen. */
  readonly valor?: string
  /** Columnas de `RIEL_CELDA` (45). Entero, nunca un ancho arbitrario (regla 1). */
  readonly columnas: number
  /**
   * CAMPO VACÍO REQUERIDO: sin valor la celda **no colapsa** — conserva su rótulo y
   * deja la línea de escritura. Dos en el sistema: el familiar del Consentimiento y de
   * la Denegación, y el paciente del recibo mínimo.
   */
  readonly requerido?: boolean
  /**
   * Techo de renglones del valor, con recorte por elipsis. Uno declarado: el
   * diagnóstico, a **3** (brief 00 §5.2). Sin él, el valor envuelve sin techo y la
   * fila crece — que es lo correcto para un nombre o un hospital.
   */
  readonly maxLineas?: number
}

const estilos = StyleSheet.create({
  /** La caja de la ficha: abierta y cerrada por filete de 0.8 negro. */
  ficha: {
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  fila: {
    flexDirection: 'row',
    /**
     * Por ARRIBA. Las celdas de una fila pueden tener alturas distintas —un
     * diagnóstico de tres renglones junto a una edad de uno— y lo que tiene que
     * alinearse son los RÓTULOS, que es lo que se lee en diagonal.
     */
    alignItems: 'stretch',
  },
  /** Regla entre filas. La última no la lleva: la cierra el filete de la caja. */
  reglaFila: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
  },
  celda: {
    // Toda celda que puede crecer: sin estas dos, una vecina larga la reduce a cero
    // y su texto desaparece entero del papel, sin error.
    flexShrink: 1,
    minWidth: 0,
  },
  reglaCelda: {
    borderLeftWidth: FILETE.regla,
    borderLeftColor: TINTA.hairline,
  },
  etiqueta: {
    ...estiloTipografico('etiqueta'),
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  lineaEscritura: {
    height: LINEA_ESCRITURA.alto,
    justifyContent: 'flex-end',
  },
  lineaEscrituraTrazo: {
    borderBottomWidth: LINEA_ESCRITURA.grosor,
    borderBottomColor: TINTA.negra,
  },
})

/** El estilo del valor, por calibración. Dos, y no ocho. */
function estiloValor(calibracion: CalibracionFicha): ReturnType<typeof estiloTipografico> {
  return calibracion === 'declaracion'
    ? estiloTipografico('dato.declaracion')
    : estiloTipografico('dato')
}

/** ¿Se compone esta celda? Con dato, sí; vacía y requerida, sí; vacía y opcional, no. */
function seCompone(celda: CeldaRiel): boolean {
  const conValor = celda.valor !== undefined && celda.valor.trim() !== ''
  return conValor || celda.requerido === true
}

function UnaCelda({
  celda,
  primera,
  calibracion,
}: {
  readonly celda: CeldaRiel
  readonly primera: boolean
  readonly calibracion: CalibracionFicha
}): ReactElement {
  const anatomia = FICHA[calibracion]
  const conValor = celda.valor !== undefined && celda.valor.trim() !== ''

  return (
    <View
      style={[
        estilos.celda,
        {
          width: celda.columnas * RIEL_CELDA,
          paddingTop: anatomia.rellenoSuperior,
          paddingBottom: anatomia.rellenoInferior,
          paddingRight: anatomia.lateral,
          // Regla: la primera celda VIVA de la fila arranca pegada al margen de la
          // caja. Con relleno izquierdo, la ficha no alinearía con el resto de la hoja.
          paddingLeft: primera ? 0 : anatomia.lateral,
        },
        primera ? {} : estilos.reglaCelda,
      ]}
    >
      <Text style={estilos.etiqueta}>{celda.etiqueta.toUpperCase()}</Text>

      {conValor ? (
        <Text
          style={[
            { ...estiloValor(calibracion) },
            celda.maxLineas === undefined
              ? {}
              : { maxLines: celda.maxLineas, textOverflow: 'ellipsis' },
          ]}
        >
          {celda.valor}
        </Text>
      ) : (
        // Campo vacío requerido: el rótulo se queda y debajo va la línea que se
        // llena a pluma. Ver `requerido`.
        <View style={estilos.lineaEscritura}>
          <View style={estilos.lineaEscrituraTrazo} />
        </View>
      )}
    </View>
  )
}

/**
 * La variante `catalogo`: una retícula de etiquetas sin rótulo, que es lo que compone
 * el bloque de requerimientos especiales de Internamiento. Nace con ese formato y no
 * tiene otro consumidor.
 *
 * Cada item ocupa `1 / columnas` del ancho y el reparto lo hace `width` en porcentaje
 * y no `flex`: una fila incompleta —siete items en tres columnas— tiene que dejar el
 * hueco a la derecha, no repartir el sobrante entre los que hay.
 */
function Catalogo({
  items,
  columnas,
}: {
  readonly items: readonly string[]
  readonly columnas: number
}): ReactElement {
  const anatomia = FICHA.chasis

  return (
    <View style={estilos.ficha}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map((item, indice) => {
          const primeraDeFila = indice % columnas === 0
          return (
            <View
              key={item}
              style={[
                {
                  width: `${100 / columnas}%`,
                  paddingTop: anatomia.rellenoSuperior + 2,
                  paddingBottom: anatomia.rellenoInferior + 2,
                  paddingRight: anatomia.lateral,
                  paddingLeft: primeraDeFila ? 0 : anatomia.lateral,
                },
                primeraDeFila ? {} : estilos.reglaCelda,
                indice >= columnas ? estilos.reglaFila : {},
              ]}
            >
              <Text style={{ ...estiloTipografico('requerimiento.texto'), maxLines: 2 }}>
                {item}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export type RielDatosProps =
  /** Filas de celdas. El número de celdas por fila lo declara el formato. */
  | {
      variante: 'celdas'
      filas: readonly (readonly CeldaRiel[])[]
      calibracion?: CalibracionFicha
    }
  /** Retícula de etiquetas sin rótulo. Un consumidor: Internamiento. */
  | { variante: 'catalogo'; items: readonly string[]; columnas: number }

/** 2.F · `RielDatos`. */
export default function RielDatos(props: RielDatosProps): ReactElement {
  if (props.variante === 'catalogo') {
    return <Catalogo items={props.items} columnas={props.columnas} />
  }

  const calibracion = props.calibracion ?? 'chasis'

  // Se descartan las celdas que colapsan ANTES de repartir: la primera celda viva de
  // la fila es la que no lleva regla, y si el descarte ocurriera al pintar, una fila
  // cuyo primer campo colapsa dibujaría un hairline pegado al margen.
  const filas = props.filas
    .map((fila) => fila.filter(seCompone))
    .filter((fila) => fila.length > 0)

  return (
    <View style={estilos.ficha}>
      {filas.map((fila, indiceFila) => (
        <View
          key={fila.map((c) => c.clave).join('·')}
          style={[estilos.fila, indiceFila === 0 ? {} : estilos.reglaFila]}
        >
          {fila.map((celda, indiceCelda) => (
            <UnaCelda
              key={celda.clave}
              celda={celda}
              primera={indiceCelda === 0}
              calibracion={calibracion}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
