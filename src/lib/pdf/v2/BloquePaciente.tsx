/**
 * Sistema de documentos v2 — componente 2.D · `BloquePaciente`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.D. Transcripción, no diseño.
 *
 * Propósito: identificar al paciente en la hoja. Es un requisito de SEGURIDAD, no
 * de maquetación: en el hospital las hojas se separan.
 *
 * UN SOLO RIEL DE SIETE CELDAS EN DOS FILAS, NO DOS RIELES
 *
 * `CONCILIA D6` — una versión anterior del spec declaraba dos componentes,
 * `BloquePaciente` y un `RielDatos` con fecha y diagnóstico. El diseño tiene uno
 * solo. Si aparece la tentación de partirlo en dos, es D6 volviendo.
 *
 * QUÉ HACE ESTE ARCHIVO Y QUÉ NO
 *
 * La composición del riel —anchos, reglas, filetes, padding, redistribución al
 * colapsar— vive en `RielDatos` (2.F). Aquí se declara SOLO lo que es del
 * paciente: qué siete celdas hay, cuántas columnas de `riel.celda` ocupa cada
 * una, en qué fila va, y las dos excepciones tipográficas de sus valores.
 *
 * Esta separación es la sustitución que quedó anunciada al construir 2.D antes
 * que 2.F: el riel se compuso aquí de forma provisional con la nota de que al
 * llegar 2.F se sustituiría y no se duplicaría (I.3.5). Ya está hecha. Si vuelves
 * a ver `View` con `borderLeftWidth` en este archivo, la duplicación volvió.
 *
 * LO QUE ESTE ARCHIVO SIGUE SIN SER
 *
 * a. `Campo` (2.E) no compone estas celdas, y no es un olvido: de los tres
 *    consumidores de riel del sistema solo este tiene celdas con rótulo, y la
 *    decisión de colapsar pertenece a quien posee la geometría que colapsa, que
 *    es 2.F. Lo que sí se comparte con 2.E es la regla de qué cuenta como dato
 *    ausente, que 2.F importa de ahí.
 * b. 2.D **no decide qué campo es requerido y cuál opcional**: lo declara el
 *    formato en la Sección II (2.E regla 3). Por eso todo lo que no sea el nombre
 *    entra como opcional y colapsa si no viene.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import type { ReactElement } from 'react'
import { StyleSheet } from '@react-pdf/renderer'
import RielDatos, {
  VALOR_CELDA,
  type CeldaRiel,
  type EstiloValorCelda,
} from './RielDatos'
import { FUENTE, TINTA } from './tokens'

/**
 * Geometría interna de ESTE componente, de la ficha de 2.D. I.1.7 declara que la
 * geometría interna vive en la ficha del componente y no en la escala.
 *
 * Las dos entradas son las dos excepciones tipográficas del riel del paciente. El
 * padding de celda, las reglas y los filetes NO están aquí: son del riel, y el
 * riel es 2.F.
 */
const GEOMETRIA = {
  /**
   * Peso del valor del nombre. La tabla de la ficha lo declara «`dato`, peso
   * 500»: mismo rol que los demás valores, un peso por encima. Es el único
   * destaque del riel y no se replica en ninguna otra celda.
   */
  pesoAncla: 500,
  /**
   * VALOR DE LA CELDA DE DIAGNÓSTICO — IBM Plex Sans 11 / 13 pt, peso 400,
   * tracking 0, `tinta.negra`.
   *
   * ⚠ **INTERLINEADO 13, NO 16.** A.8 lo declara en 11 / 16, heredando el 16 del
   * valor de riel que la lámina desmiente. Las tres celdas de la fila inferior del
   * riel miden 30.5 pt en la lámina, exactamente igual que las cuatro de arriba más
   * su regla, y con 16 esta celda sola estiraría la fila a 33.5: las reglas
   * verticales del riel llegan de arriba abajo de la fila, así que la celda más alta
   * manda sobre las otras dos. El 13 es el mismo interlineado que 2.F declara como
   * desviación del valor de celda, no un valor nuevo — lo que sigue siendo excepción
   * de ESTA celda es la FAMILIA y el cuerpo de 11 pt, que es lo que A.8 declara de
   * propio.
   *
   * Es la ÚNICA excepción de familia del riel y la ficha de 2.D la declara
   * entera. No la «unifiques» con el resto del riel ni la subas a I.1.4: no es un
   * miembro de la escala tipográfica —no aparece en su tabla— sino geometría
   * interna de este componente, y ese es justo el caso que I.1.7 manda declarar
   * aquí. Si algún día 11 / 16 en humanista aparece en un segundo componente,
   * entonces sí es un rol y sube a I.1.4 con nombre propio.
   *
   * Por eso este es también el único sitio de v2 donde se divide por el cuerpo a
   * mano en vez de pedirle el estilo a `estiloTipografico()`: esa función es la
   * puerta a la ESCALA, y esto no está en la escala.
   */
  diagnostico: {
    cuerpo: 11,
    interlineado: 13,
    peso: 400,
    tracking: 0,
    color: TINTA.negra,
  },
} as const

/** Los siete datos del riel. */
export type CampoPaciente =
  | 'paciente'
  | 'edad'
  | 'sexo'
  | 'expediente'
  | 'diagnostico'
  | 'fecha'
  | 'hora'

/** Cómo se compone el VALOR de una celda. La etiqueta es igual en las siete. */
type TrazoValor =
  /** Rol `dato` tal cual: edad, sexo, expediente, fecha y hora. Es el de 2.F. */
  | 'dato'
  /** Rol `dato` en peso 500. Solo el nombre del paciente, que es el ancla. */
  | 'datoAncla'
  /** La excepción de familia. Solo diagnóstico. */
  | 'diagnostico'

interface DescriptorCelda {
  readonly campo: CampoPaciente
  readonly etiqueta: string
  /** Columnas de `riel.celda` que ocupa. */
  readonly columnas: number
  readonly trazo: TrazoValor
}

// Las siete celdas de la tabla de la ficha, una constante cada una para poder
// componer las filas sin repetir anchos ni etiquetas.
const PACIENTE: DescriptorCelda = { campo: 'paciente', etiqueta: 'Paciente', columnas: 5, trazo: 'datoAncla' }
const EDAD: DescriptorCelda = { campo: 'edad', etiqueta: 'Edad', columnas: 2, trazo: 'dato' }
const SEXO: DescriptorCelda = { campo: 'sexo', etiqueta: 'Sexo', columnas: 2, trazo: 'dato' }
const EXPEDIENTE: DescriptorCelda = { campo: 'expediente', etiqueta: 'Expediente', columnas: 3, trazo: 'dato' }
const DIAGNOSTICO: DescriptorCelda = { campo: 'diagnostico', etiqueta: 'Diagnóstico', columnas: 5, trazo: 'diagnostico' }
const FECHA: DescriptorCelda = { campo: 'fecha', etiqueta: 'Fecha', columnas: 4, trazo: 'dato' }
const HORA: DescriptorCelda = { campo: 'hora', etiqueta: 'Hora', columnas: 3, trazo: 'dato' }

/** Fila superior: 5 + 2 + 2 + 3 = 12 columnas de `riel.celda`. */
const FILA_SUPERIOR: readonly DescriptorCelda[] = [PACIENTE, EDAD, SEXO, EXPEDIENTE]
/** Fila inferior: 5 + 4 + 3 = 12. */
const FILA_INFERIOR: readonly DescriptorCelda[] = [DIAGNOSTICO, FECHA, HORA]
/** Variante `reducido`: una sola línea con nombre y expediente, con sus anchos. */
const FILA_REDUCIDA: readonly DescriptorCelda[] = [PACIENTE, EXPEDIENTE]

/**
 * Valores del riel. Solo `paciente` es obligatorio.
 *
 * Regla 1 de la ficha: el nombre nunca está ausente —los 8 formularios lo
 * bloquean, salvo Honorarios y Escrito Médico, donde es opcional por decisión de
 * producto—. En esos dos el bloque entero no se emite: la composición de II.8 dice
 * «`BloquePaciente` completo, SI HAY PACIENTE». Por eso aquí no hay una variante
 * sin nombre: quien no tiene paciente no monta el componente.
 *
 * REGLA 3 DE LA FICHA — `sexo`, `numero_expediente` y `hora` NO LLEGAN HOY desde
 * ningún formulario. El expediente se consulta en el hub y no se pasa; la hora
 * existe en el nombre del archivo y no en el documento. Es cableado pendiente
 * (Paso 5 del plan), NO un campo nuevo. Hasta que exista el cable, los tres se
 * comportan como campo vacío opcional y colapsan. Cuando el cable exista, se pasan
 * y el riel los muestra sin tocar este archivo.
 */
export interface ValoresPaciente {
  readonly paciente: string
  readonly edad?: string
  readonly sexo?: string
  readonly expediente?: string
  readonly diagnostico?: string
  readonly fecha?: string
  readonly hora?: string
}

export type BloquePacienteProps =
  /** Hoja 1. */
  | ({ variante: 'completo' } & ValoresPaciente)
  /**
   * Hojas de continuación. Regla 2 de la ficha: NO ES OPCIONAL cuando el documento
   * tiene más de una hoja. Una hoja de indicaciones sin nombre de paciente es un
   * riesgo clínico.
   */
  | { variante: 'reducido'; paciente: string; expediente?: string }

const estilos = StyleSheet.create({
  /**
   * Único valor del riel en peso 500: el nombre, que es el ancla de la hoja.
   *
   * Parte de `VALOR_CELDA` —el valor de celda YA DESVIADO por 2.F— y no del rol
   * `dato`: la ficha lo declara «`dato`, peso 500», es decir el mismo valor que las
   * demás celdas un peso por encima. Partiendo del rol crudo se quedaría en 12 / 16
   * y estiraría la fila entera, que es justo lo que la desviación del riel corrige.
   */
  valorAncla: { ...VALOR_CELDA, fontWeight: GEOMETRIA.pesoAncla },
  valorDiagnostico: {
    fontFamily: FUENTE.humanista,
    fontSize: GEOMETRIA.diagnostico.cuerpo,
    lineHeight: GEOMETRIA.diagnostico.interlineado / GEOMETRIA.diagnostico.cuerpo,
    fontWeight: GEOMETRIA.diagnostico.peso,
    letterSpacing: GEOMETRIA.diagnostico.tracking,
    color: GEOMETRIA.diagnostico.color,
  },
})

/**
 * `undefined` para el trazo normal: así la celda se queda con el rol `dato` que
 * 2.F aplica por defecto, en vez de que 2.D lo repita por su cuenta. Solo se
 * entrega estilo cuando hay una excepción DECLARADA que entregar.
 */
function estiloValor(trazo: TrazoValor): EstiloValorCelda | undefined {
  if (trazo === 'datoAncla') return estilos.valorAncla
  if (trazo === 'diagnostico') return estilos.valorDiagnostico
  return undefined
}

/** Traduce un descriptor de la ficha a la celda que 2.F consume. */
function celdas(
  descriptores: readonly DescriptorCelda[],
  valores: Partial<Record<CampoPaciente, string>>,
): readonly CeldaRiel[] {
  return descriptores.map((d) => ({
    clave: d.campo,
    etiqueta: d.etiqueta,
    valor: valores[d.campo],
    columnas: d.columnas,
    estiloValor: estiloValor(d.trazo),
  }))
}

/** 2.D · `BloquePaciente`. */
export default function BloquePaciente(props: BloquePacienteProps): ReactElement {
  if (props.variante === 'reducido') {
    return (
      <RielDatos
        variante="unaLinea"
        celdas={celdas(FILA_REDUCIDA, {
          paciente: props.paciente,
          expediente: props.expediente,
        })}
      />
    )
  }

  return (
    <RielDatos
      variante="celdas"
      filas={[celdas(FILA_SUPERIOR, props), celdas(FILA_INFERIOR, props)]}
    />
  )
}
