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
 * LA RETÍCULA QUE SE USA AQUÍ ES `riel.celda`, NO `reticula.columna`
 *
 * I.1.3 declara DOS retículas conviviendo sobre la misma caja de 486 pt y explica
 * por qué no se unifican: los bloques de texto se separan con aire —el medianil de
 * 9 pt sobre columnas de 32.25— y las celdas del riel se separan con una REGLA
 * VERTICAL más padding, así que su partición es de doce partes iguales sin
 * medianil, `riel.celda` = 40.5 pt. Donde hay regla no hace falta medianil. Usar
 * `reticula.columna` aquí desalinearía el riel respecto de la caja.
 *
 * LO QUE ESTE ARCHIVO NO ES
 *
 * a. La ficha declara que 2.D se compone con `RielDatos` (2.F). 2.F **todavía no
 *    existe**: se construye cuando haya un segundo consumidor real que declare qué
 *    variantes necesita. Hasta entonces el riel se compone aquí, y cuando 2.F
 *    exista esto se SUSTITUYE por una instancia suya. No se duplica: un riel
 *    paralelo sería exactamente lo que I.3.5 prohíbe.
 * b. `Campo` (2.E) tampoco existe. De sus tres estados, aquí solo se instancia el
 *    tercero —`vacío opcional`, que colapsa entero— porque es el único que el riel
 *    puede necesitar hoy (ver regla 3). El estado `vacío requerido` lleva una línea
 *    manuscrita de `manuscrito.ancho` = 246 pt, que no cabe en ninguna celda de
 *    este riel —la más ancha mide 5 × 40.5 = 202.5 pt—, así que si algún formato
 *    llega a pedirlo, es una decisión de 2.E y de la Sección II, no de aquí.
 * c. 2.D **no decide qué campo es requerido y cuál opcional**: lo declara el
 *    formato en la Sección II (2.E regla 3). Por eso todo lo que no sea el nombre
 *    entra como opcional y colapsa si no viene.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  CAJA,
  FILETE,
  FUENTE,
  RIEL_CELDA,
  TINTA,
  estiloTipografico,
} from './tokens'

/**
 * Geometría interna de ESTE componente, de la ficha de 2.D. I.1.7 declara que la
 * geometría interna vive en la ficha del componente y no en la escala de
 * espaciado, aunque no sea múltiplo de 4 — y `8 10 10` no lo es.
 */
const GEOMETRIA = {
  /** Padding de celda `8 10 10`: superior 8, laterales 10, inferior 10. */
  padding: { superior: 8, lateral: 10, inferior: 10 },
  /**
   * Peso del valor del nombre. La tabla de la ficha lo declara «`dato`, peso
   * 500»: mismo rol que los demás valores, un peso por encima. Es el único
   * destaque del riel y no se replica en ninguna otra celda.
   */
  pesoAncla: 500,
  /**
   * VALOR DE LA CELDA DE DIAGNÓSTICO — IBM Plex Sans 11 / 16 pt.
   *
   * Es la ÚNICA excepción de familia del riel, y la ficha de 2.D la declara
   * expresamente: todos los demás valores van en la neo-grotesca, en el rol
   * `dato`. No la «unifiques» con el resto del riel ni la subas a I.1.4: no es un
   * miembro de la escala tipográfica —no aparece en su tabla— sino geometría
   * interna de este componente, y ese es justo el caso que I.1.7 manda declarar
   * aquí.
   *
   * Por eso este es también el único sitio de v2 donde se divide por el cuerpo a
   * mano en vez de pedirle el estilo a `estiloTipografico()`: esa función es la
   * puerta a la ESCALA, y esto no está en la escala. Si algún día 11 / 16 en
   * humanista aparece en un segundo componente, entonces sí es un rol y sube a
   * I.1.4 con nombre propio.
   *
   * La ficha declara familia, cuerpo e interlineado, y no declara peso, tracking
   * ni color. ASUMIENDO QUE se comportan como el resto de valores del riel: peso
   * 400 —el único que usa cualquier rol de texto humanista del sistema—, tracking
   * 0 —ningún rol humanista de I.1.4 lleva tracking— y `tinta.negra`, como todo
   * valor de campo.
   */
  diagnostico: {
    cuerpo: 11,
    interlineado: 16,
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
  /** Rol `dato` tal cual: edad, sexo, expediente, fecha y hora. */
  | 'dato'
  /** Rol `dato` en peso 500. Solo el nombre del paciente, que es el ancla. */
  | 'datoAncla'
  /** La excepción de familia. Solo diagnóstico. */
  | 'diagnostico'

interface DescriptorCelda {
  readonly campo: CampoPaciente
  /** Se compone en versalita —mayúsculas con tracking— en el render. */
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
   * El riel abre y cierra con `filete.fino` en `tinta.negra`. Los dos filetes son
   * del riel entero, no de sus filas: por eso van aquí y no en `fila`.
   */
  riel: {
    width: CAJA.ancho,
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  fila: {
    flexDirection: 'row',
    // Por defecto, y a propósito: las celdas se estiran al alto de la más alta
    // para que las reglas verticales lleguen de arriba abajo de la fila.
    alignItems: 'stretch',
  },
  /** Regla superior de la segunda fila, `filete.regla` en `tinta.hairline`. */
  filaInferior: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
  },
  /**
   * ANCHO NOMINAL POR `width`, REDISTRIBUCIÓN POR `flexGrow`. Los dos juntos, y
   * en ese orden, son lo que cumple las dos exigencias a la vez:
   *
   * - `width: columnas × riel.celda` da el ancho declarado por la ficha. Con las
   *   siete celdas presentes los anchos suman los 486 pt de la caja, no sobra
   *   espacio y cada celda mide exactamente sus columnas de riel.
   * - `flexGrow: columnas` solo entra en juego cuando una celda COLAPSA: entonces
   *   sobra espacio y las restantes se lo reparten en la misma proporción, hasta
   *   ocupar el riel completo. NO QUEDA HUECO — un riel con un agujero delata que
   *   faltaba un dato, que es justo lo que el colapso evita (2.F regla 3).
   *
   * NO LO SUSTITUYAS POR `flexBasis: 0`, que es la forma «obvia» de repartir en
   * proporción y aquí da mal el caso nominal. Medido contra el PDF real: en este
   * renderer el flex-basis es de CAJA DE CONTENIDO, así que el padding de 20 pt y
   * la regla de 0.5 se suman por fuera del reparto y la primera celda sale de
   * 188.54 pt en vez de los 202.5 que declara la ficha. Con `width`, que sí es de
   * caja de borde, los 202.5 salen exactos.
   */
  celda: {
    paddingTop: GEOMETRIA.padding.superior,
    paddingBottom: GEOMETRIA.padding.inferior,
    paddingLeft: GEOMETRIA.padding.lateral,
    paddingRight: GEOMETRIA.padding.lateral,
  },
  /** Regla izquierda salvo en la primera celda de cada fila. */
  celdaConRegla: {
    borderLeftWidth: FILETE.regla,
    borderLeftColor: TINTA.hairline,
  },
  /**
   * Versalita: mayúsculas con tracking, no versalitas reales de la fuente (I.1.4).
   * La transformación a mayúsculas ocurre en el render.
   */
  etiqueta: { ...estiloTipografico('etiqueta') },
  valor: { ...estiloTipografico('dato') },
  /** Único valor del riel en peso 500: el nombre, que es el ancla de la hoja. */
  valorAncla: { ...estiloTipografico('dato'), fontWeight: GEOMETRIA.pesoAncla },
  valorDiagnostico: {
    fontFamily: FUENTE.humanista,
    fontSize: GEOMETRIA.diagnostico.cuerpo,
    lineHeight: GEOMETRIA.diagnostico.interlineado / GEOMETRIA.diagnostico.cuerpo,
    fontWeight: GEOMETRIA.diagnostico.peso,
    letterSpacing: GEOMETRIA.diagnostico.tracking,
    color: GEOMETRIA.diagnostico.color,
  },
})

/** Un valor que no viene, o que viene vacío, es un campo ausente. */
function presente(valor: string | undefined): valor is string {
  return valor !== undefined && valor.trim() !== ''
}

/**
 * El tipo de retorno es `typeof estilos.valor` y NO la interfaz
 * `EstiloTipografico` de `tokens.ts`: el tipo `Style` de react-pdf lleva un índice
 * de media queries, y TypeScript se lo presta a un tipo de objeto inferido pero
 * nunca a una interfaz declarada. Es el mismo motivo por el que en 2.B un rol se
 * esparce y nunca se asigna directo. Los tres estilos comparten forma a propósito.
 */
function estiloValor(trazo: TrazoValor): typeof estilos.valor {
  if (trazo === 'datoAncla') return estilos.valorAncla
  if (trazo === 'diagnostico') return estilos.valorDiagnostico
  return estilos.valor
}

/**
 * Una fila del riel. `superior` la marca como la primera, que es la que NO lleva
 * regla horizontal encima.
 *
 * Devuelve `null` cuando todas sus celdas colapsan: una fila vacía dejaría la
 * regla horizontal flotando sobre nada.
 */
function Fila({
  celdas,
  valores,
  superior,
}: {
  celdas: readonly DescriptorCelda[]
  valores: Partial<Record<CampoPaciente, string>>
  superior: boolean
}): ReactElement | null {
  const vivas = celdas.filter((celda) => presente(valores[celda.campo]))
  if (vivas.length === 0) return null

  return (
    <View style={[estilos.fila, superior ? {} : estilos.filaInferior]}>
      {vivas.map((celda, indice) => (
        <View
          key={celda.campo}
          style={[
            estilos.celda,
            { width: celda.columnas * RIEL_CELDA, flexGrow: celda.columnas },
            indice === 0 ? {} : estilos.celdaConRegla,
          ]}
        >
          <Text style={estilos.etiqueta}>{celda.etiqueta.toUpperCase()}</Text>
          <Text style={estiloValor(celda.trazo)}>{valores[celda.campo]}</Text>
        </View>
      ))}
    </View>
  )
}

/** 2.D · `BloquePaciente`. */
export default function BloquePaciente(props: BloquePacienteProps): ReactElement {
  if (props.variante === 'reducido') {
    return (
      <View style={estilos.riel}>
        <Fila
          celdas={FILA_REDUCIDA}
          valores={{ paciente: props.paciente, expediente: props.expediente }}
          superior
        />
      </View>
    )
  }

  return (
    <View style={estilos.riel}>
      <Fila celdas={FILA_SUPERIOR} valores={props} superior />
      <Fila celdas={FILA_INFERIOR} valores={props} superior={false} />
    </View>
  )
}
