/**
 * Sistema de documentos v2 — componente 2.V · `EncabezadoHoja`.
 *
 * FUENTE DE VERDAD: las fichas de 2.B, 2.C, 2.D, 2.G y 2.H, que es de donde sale
 * cada pieza. **Este componente no aporta ninguna geometría propia**: coloca las que
 * ya existen y decide cuál va en cada hoja.
 *
 * POR QUÉ EXISTE, Y POR QUÉ NO VIVE EN LOS FORMATOS
 *
 * La hoja de continuación se resuelve **una sola vez, en el chasis**. Antes de esto,
 * los tres formatos construidos componían su encabezado a mano en el flujo, así que
 * salía en la hoja 1 y en ninguna más: si la lista desbordaba, la hoja 2 llegaba sin
 * membrete, sin folio y **sin nombre de paciente** — el hallazgo más grave de la
 * auditoría del sistema viejo, con una hoja de indicaciones que no se podía atribuir
 * a nadie.
 *
 * Si esta composición viviera en los ocho formatos, serían ocho sitios donde
 * equivocarse y ocho sitios que arreglar. Aquí los formatos declaran **datos** —su
 * título, su paciente, su folio, el sustantivo de su lista— y nunca cómo se compone
 * una hoja de continuación. Por eso las props de abajo no llevan un solo `ReactNode`
 * de encabezado: si lo llevaran, el formato volvería a componer.
 *
 * QUÉ CAMBIA ENTRE LAS DOS VARIANTES
 *
 *   membrete    `completo` con panel y especialidad  →  `continuacion`, solo el nombre
 *   título      el del formato                       →  con el rótulo de continuación
 *   riel        `completo`, hasta siete celdas       →  `reducido`, nombre y expediente
 *   badge       `urgente`                            →  `urgenteReducido`
 *   cabecera    el sustantivo de la lista            →  con el rótulo de continuación
 *
 * **El riel reducido NO ES OPCIONAL** (regla 2 de 2.D). Una hoja de estudios o de
 * indicaciones sin nombre de paciente es un riesgo clínico, no un detalle de
 * maquetación: en el hospital las hojas se separan. Por eso `paciente` es una prop
 * exigible y no hay ninguna rama de este archivo que componga una continuación sin
 * ella.
 *
 * QUIÉN LO INSTANCIA
 *
 * Nadie directamente: lo monta 2.N, que es quien sabe en qué hoja está. Un formato
 * que lo instancie por su cuenta se estará componiendo un encabezado de hoja 1 que no
 * se repite — que es exactamente el defecto que este componente cierra.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import Membrete, {
  type ConsultorioMembrete,
  type MedicoMembrete,
} from './Membrete'
import type { PanelCircularProps } from './PanelCircular'
import TituloDocumento from './TituloDocumento'
import BloquePaciente, { type ValoresPaciente } from './BloquePaciente'
import BloqueNegativo from './BloqueNegativo'
import { CabeceraEntradas, CabeceraLista } from './EntradaNumerada'
import { ESPACIO, type AcentoResuelto, type Lamina } from './tokens'

/**
 * EL RÓTULO DE CONTINUACIÓN, UNA SOLA VEZ EN EL SISTEMA.
 *
 * Las láminas lo componen sobre tres cadenas distintas —`Receta médica ·
 * continuación`, `Medicamentos · continuación`, `Estudios · continuación`— y siempre
 * con la misma forma: la cadena del formato, la raya del sistema y esta palabra. Por
 * eso no entra por prop: si la declarara cada formato, el sistema acabaría con ocho
 * redacciones de lo mismo, que es la deriva que `CONCILIA D5` ya tuvo que conciliar
 * en los avisos de pie.
 */
const ROTULO_CONTINUACION = 'continuación'
const SEPARADOR = ' · '

/** `Receta médica` → `Receta médica · continuación`. */
function continua(cadena: string): string {
  return `${cadena}${SEPARADOR}${ROTULO_CONTINUACION}`
}

/**
 * La cabecera de la lista, en sus dos anatomías.
 *
 * `columnas` distingue las dos que el sistema tiene: la tabla de tres rótulos que
 * compone Laboratorio (2.G `CabeceraEntradas`) y el rótulo único de la lista apilada
 * que componen Imagenología y Receta (2.G `CabeceraLista`). No es una variante de
 * este componente: es cuál de las dos piezas de 2.G se instancia, y lo decide el
 * formato al declarar si su lista tiene columnas.
 */
export interface ListaEncabezado {
  /** El sustantivo de la lista, en capitalización de oración. */
  readonly titulo: string
  /** Los tres rótulos, si la lista se compone en columnas. */
  readonly columnas?: {
    readonly numero: string
    readonly ancla: string
    readonly nota: string
  }
}

export interface EncabezadoHojaProps {
  /** Qué hoja se está componiendo. Lo decide 2.N, nunca el formato. */
  readonly variante: 'primera' | 'continuacion'
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly lamina?: Lamina
  /** En capitalización de oración. La versalita y el rótulo los pone el chasis. */
  readonly titulo: string
  /**
   * El paciente. **Exigible**, y no solo en la hoja 1: la regla 2 de 2.D declara el
   * riel reducido obligatorio en cuanto el documento tiene más de una hoja.
   */
  readonly paciente: ValoresPaciente
  readonly emision?: string
  readonly folio?: string
  /** Badge del documento. El chasis lo reduce solo en las hojas de continuación. */
  readonly urgente?: boolean
  /** La cabecera de la lista, si el formato tiene lista. */
  readonly lista?: ListaEncabezado
  /** Separación entre el riel de identificación y la cabecera de la lista. */
  readonly aireLista?: number
}

const estilos = StyleSheet.create({
  /**
   * El aire entre el riel y la cabecera de la lista. Lo declara el FORMATO —cada
   * lámina lo mide distinto: 12 en Laboratorio, 14 en Imagenología, 10 en Receta— y
   * por eso entra por prop en vez de vivir aquí con un valor. Sin él, ninguno: una
   * lista sin cabecera no tiene de qué separarse.
   */
  hastaLista: { width: '100%' },
})

/** 2.V · `EncabezadoHoja`. */
export default function EncabezadoHoja(props: EncabezadoHojaProps): ReactElement {
  const continuacion = props.variante === 'continuacion'
  const titulo = continuacion ? continua(props.titulo) : props.titulo

  return (
    <View>
      {continuacion ? (
        <Membrete variante="continuacion" acento={props.acento} medico={props.medico} />
      ) : (
        <Membrete
          variante="completo"
          lamina={props.lamina}
          acento={props.acento}
          medico={props.medico}
          consultorio={props.consultorio}
          panel={props.panel}
        />
      )}

      {/*
        EL TÍTULO VA EN LAS DOS HOJAS, con su rótulo de continuación en la segunda.
        El folio también: es lo que ata la hoja al documento dentro del cuerpo, además
        de la banda de 2.M. La emisión NO se repite — es un dato de cabecera, no de
        identificación, y la hoja de continuación ya queda atada por el folio.
      */}
      <TituloDocumento
        variante="fijo"
        lamina={props.lamina}
        acento={props.acento}
        titulo={titulo}
        emision={continuacion ? undefined : props.emision}
        folio={props.folio}
        bajoTitulo={
          props.urgente === true ? (
            <BloqueNegativo
              variante={continuacion ? 'urgenteReducido' : 'urgente'}
              lamina={props.lamina}
            />
          ) : undefined
        }
      />

      {/*
        EL RIEL. Regla 2 de 2.D: en continuación NO es opcional. La variante
        `reducido` compone nombre y expediente en una sola línea, que es lo mínimo con
        lo que una hoja suelta se puede atribuir a un paciente.
      */}
      {continuacion ? (
        <BloquePaciente
          variante="reducido"
          paciente={props.paciente.paciente}
          expediente={props.paciente.expediente}
        />
      ) : (
        <BloquePaciente variante="completo" lamina={props.lamina} {...props.paciente} />
      )}

      {props.lista === undefined ? null : (
        <View style={[estilos.hastaLista, { marginTop: props.aireLista ?? ESPACIO[12] }]}>
          {props.lista.columnas === undefined ? (
            <CabeceraLista
              titulo={continuacion ? continua(props.lista.titulo) : props.lista.titulo}
              acento={props.acento}
            />
          ) : (
            <CabeceraEntradas {...props.lista.columnas} acento={props.acento} />
          )}
        </View>
      )}
    </View>
  )
}
