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
 *   membrete    `completo` con panel y especialidad  →  `continuacion`, nombre a 14/18
 *   título      bloque propio con su filete          →  PLEGADO dentro de la cabecera
 *   paciente    riel `completo`, hasta siete celdas  →  una línea gris de 7.5 / 12
 *   badge       colgado del título                   →  a la derecha de la línea
 *   cabecera    el sustantivo de la lista            →  con el rótulo de continuación
 *
 * **LO QUE PESA CADA UNA, Y POR QUÉ IMPORTA.** El encabezado completo mide 220.88 pt
 * y el de continuación tiene que ser mucho más ligero o no compensa: si pesara lo
 * mismo, cortar una lista costaría una hoja entera de identidad repetida. Las tres
 * cifras de arriba salen de la lámina y valen 59 pt frente a la primera versión de
 * este componente, que montaba las piezas de la hoja 1 encogidas —membrete con el
 * nombre a tamaño de portada, bloque de título entero y el riel con sus filetes—.
 *
 * ⚠ **LA CUARTA LÁMINA PESA 70.5 pt DE CONTINUACIÓN Y ESTE COMPONENTE COMPONE 83.5.**
 *
 * La de Suplementación es la primera que mide su hoja 2 pieza por pieza, y no cuadra
 * con lo que el chasis monta. La diferencia son **13 pt** y se cierra exacta con dos
 * sumandos, así que no hay nada que buscar:
 *
 *     −17   el renglón de cédula y su aire de 6, que esta lámina NO compone
 *     + 4   su espaciador de cierre, 16 en vez de los 12 de 2.B
 *     ────
 *     −13   83.5 → 70.5
 *
 * (Sobre esos 83.5 va además el aire hasta la cabecera de la lista, que declara el
 * formato: con los 10 de Receta salen los **93.50** que fija la prueba de 2.N, y con
 * los 14 de Suplementación, 97.5. Por eso las dos cifras que se comparan son 83.5 y
 * 70.5, no 93.5 y 70.5: aquella lleva dentro un aire de otro formato.)
 *
 * **No se ajusta ninguno de los dos**, y el motivo es el mismo en los dos casos: la
 * cédula bajo el nombre y el espaciador de 12 los componen hoy Laboratorio,
 * Imagenología y Receta, los tres conciliados contra su propia lámina, y ninguno de
 * los tres tiene una lámina de continuación medida con la que contrastarlos. Mover
 * cualquiera de los dos aquí los movería a los tres a ciegas. Lo que sí se compone es
 * lo que no arrastra a nadie: el peso en la línea de paciente, que solo sale donde hay
 * peso. **Reportado.**
 *
 * ⚠ Esa misma lámina cierra su línea con la emisión —`… · Peso 72.5 kg | 4 ago 2026 ·
 * 10:15`— y aquí sigue sin componerse: la emisión es dato de cabecera y este
 * componente la deja en la hoja 1 a propósito (ver el comentario del título). Ponerla
 * ahora la haría aparecer en la hoja 2 de los tres formatos anteriores, que es
 * exactamente el cambio a ciegas de arriba. **Reportado.**
 *
 * **La identificación del paciente NO ES OPCIONAL** (regla 2 de 2.D). Una hoja de
 * estudios o de indicaciones sin nombre es un riesgo clínico, no un detalle de
 * maquetación: en el hospital las hojas se separan. Lo que la lámina retira es la
 * CAJA —el riel con sus filetes— y no el dato: el nombre y el expediente siguen ahí,
 * en una línea. Por eso `paciente` es una prop exigible y no hay ninguna rama de este
 * archivo que componga una continuación sin ella.
 *
 * QUIÉN LO INSTANCIA
 *
 * Nadie directamente: lo monta 2.N, que es quien sabe en qué hoja está. Un formato
 * que lo instancie por su cuenta se estará componiendo un encabezado de hoja 1 que no
 * se repite — que es exactamente el defecto que este componente cierra.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import Membrete, {
  type ConsultorioMembrete,
  type MedicoMembrete,
} from './Membrete'
import type { PanelCircularProps } from './PanelCircular'
import TituloDocumento, { CeldaFolio, ETIQUETA_FOLIO_RIEL } from './TituloDocumento'
import BloquePaciente, { type ValoresPaciente } from './BloquePaciente'
import BloqueNegativo from './BloqueNegativo'
import { CabeceraEntradas, CabeceraLista } from './EntradaNumerada'
import { tieneValor } from './Campo'
import {
  ESPACIO,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type AcentoResuelto,
  type Lamina,
} from './tokens'

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
  /**
   * Rótulo a la derecha del sustantivo (2.G `CabeceraLista`). Colapsa si no viene.
   *
   * Sale en TODAS las hojas, igual que el sustantivo: es lo que califica la lista, y
   * una hoja de continuación de suplementos sin `Dosis calculada para 72.5 kg` diría
   * dosis sin decir contra qué se calcularon. `DERIVADO` — la lámina de continuación
   * no lo mide, y por eso queda anotado en vez de dado por medido.
   */
  readonly rotulo?: string
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

/**
 * GEOMETRÍA DE LA LÍNEA DE PACIENTE — 7.5 / 12, `tinta.etiqueta`.
 *
 * ⚠ **AQUÍ IBA UN `RielDatos` REDUCIDO Y LA LÁMINA COMPONE UNA LÍNEA.** La variante
 * `reducido` de 2.D monta el riel entero con sus dos filetes de cierre: 31.5 pt para
 * decir un nombre y un expediente. La lámina compone un solo renglón gris —B.3 §2,
 * hoja 2, bloque 3: «línea de paciente y fecha de emisión, 7.5 / 12 pt, #737373»—, que
 * son 12. Son 19 pt de encabezado, el tercero de los tres tramos.
 *
 * **Lo que NO cambia es la regla 2 de 2.D:** el nombre y el expediente siguen en la
 * hoja, que es lo único que esa regla exige —que una hoja suelta se pueda atribuir a
 * un paciente—. Lo que se retira es la caja, no el dato.
 *
 * Es una desviación de `medico.credencial` en dos sumandos, con el patrón de siempre:
 * el interlineado sube de 11 a 12 —el mismo 12 que 2.B ya usa en su banda de dos
 * renglones— y el color pasa de `tinta.secundaria` a `tinta.etiqueta`. Familia,
 * cuerpo, peso y tracking los sigue poniendo el rol.
 */
const LINEA_PACIENTE = { interlineado: 12 } as const

/**
 * Los dos rótulos de la línea, y la raya que une sus piezas.
 *
 * Los escribe el chasis y no el formato, por lo mismo que 2.K escribe «Total de» y
 * 2.M su leyenda: si los declarara cada uno de los ocho, el sistema acabaría con ocho
 * redacciones de la misma línea. La lámina compone
 * `Paciente · Nombre · 25 años · Exp. 2026-0184`.
 */
const ROTULO_PACIENTE = 'Paciente'
const ROTULO_EXPEDIENTE = 'Exp.'
/**
 * ⚠ **EL PESO SOLO APARECE DONDE HAY PESO, Y HOY ESO ES UN SOLO FORMATO.**
 *
 * La lámina de Suplementación compone su línea de continuación como
 * `Paciente · Nombre · 25 años · Exp. 2026-0184 · Peso 72.5 kg`, y es la única que
 * lleva la última pieza: en ese formato el peso no es un dato clínico más sino la base
 * de todo lo que la hoja calcula, así que una hoja 2 sin él tiene dosis que no se
 * pueden comprobar. Los otros tres no pasan `peso` y su línea no se mueve ni un punto.
 */
const ROTULO_PESO = 'Peso'
const RAYA = ' · '

const estilos = StyleSheet.create({
  /**
   * El aire entre el riel y la cabecera de la lista. Lo declara el FORMATO —cada
   * lámina lo mide distinto: 12 en Laboratorio, 14 en Imagenología, 10 en Receta— y
   * por eso entra por prop en vez de vivir aquí con un valor. Sin él, ninguno: una
   * lista sin cabecera no tiene de qué separarse.
   */
  hastaLista: { width: '100%' },
  lineaPaciente: {
    ...estiloTipografico('medico.credencial'),
    lineHeight: LINEA_PACIENTE.interlineado / TIPOGRAFIA['medico.credencial'].cuerpo,
    color: TINTA.etiqueta,
    flex: 1,
  },
  /** La línea y, a su derecha, el badge reducido de los formatos que lo llevan. */
  filaContinuacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
})

/**
 * La línea de identificación: rótulo, nombre, edad y expediente, unidos por la raya
 * del sistema. Las piezas que no vienen no dejan raya suelta.
 */
function lineaDePaciente(paciente: ValoresPaciente): string {
  return [
    ROTULO_PACIENTE,
    paciente.paciente,
    paciente.edad,
    tieneValor(paciente.expediente)
      ? `${ROTULO_EXPEDIENTE} ${paciente.expediente}`
      : undefined,
    tieneValor(paciente.peso) ? `${ROTULO_PESO} ${paciente.peso}` : undefined,
  ]
    .filter((pieza): pieza is string => tieneValor(pieza))
    .join(RAYA)
}

/** 2.V · `EncabezadoHoja`. */
export default function EncabezadoHoja(props: EncabezadoHojaProps): ReactElement {
  const continuacion = props.variante === 'continuacion'
  const titulo = continuacion ? continua(props.titulo) : props.titulo

  return (
    <View>
      {continuacion ? (
        /*
          LA CABECERA DE CONTINUACIÓN, CON EL TÍTULO PLEGADO DENTRO. No monta un
          bloque de título aparte: el rótulo y el nombre comparten la cabecera y el
          filete que 2.B ya cierra, que es como lo compone la lámina.
        */
        <Membrete
          variante="continuacion"
          acento={props.acento}
          medico={props.medico}
          rotulo={titulo}
          riel={
            props.folio === undefined ? undefined : (
              <CeldaFolio
                etiqueta={ETIQUETA_FOLIO_RIEL}
                valor={props.folio}
                acento={props.acento}
              />
            )
          }
        />
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
        EL TÍTULO, SOLO EN LA HOJA 1. En las de continuación va plegado arriba, dentro
        de la cabecera: ver el `rotulo` que se le pasa al membrete. El folio se
        compone en las dos —es lo que ata la hoja al documento dentro del cuerpo,
        además de la banda de 2.M—, y la emisión solo en la 1: es un dato de cabecera,
        no de identificación.
      */}
      {continuacion ? null : (
        <TituloDocumento
          variante="fijo"
          lamina={props.lamina}
          acento={props.acento}
          titulo={titulo}
          emision={props.emision}
          folio={props.folio}
          bajoTitulo={
            props.urgente === true ? (
              <BloqueNegativo variante="urgente" lamina={props.lamina} />
            ) : undefined
          }
        />
      )}

      {/*
        LA IDENTIFICACIÓN DEL PACIENTE, que en continuación NO ES OPCIONAL (regla 2 de
        2.D). Riel completo en la hoja 1, línea gris en las demás: el dato es el mismo,
        la caja no. Ver `LINEA_PACIENTE`.

        El badge viaja con la línea porque en continuación no hay título del que
        colgar, que es donde la hoja 1 lo pone. La lámina lo compone así: «a la derecha
        de la línea de paciente».
      */}
      {continuacion ? (
        <View style={estilos.filaContinuacion}>
          <Text style={estilos.lineaPaciente}>{lineaDePaciente(props.paciente)}</Text>
          {props.urgente === true ? (
            <BloqueNegativo variante="urgenteReducido" lamina={props.lamina} />
          ) : null}
        </View>
      ) : (
        <BloquePaciente
          variante="completo"
          lamina={props.lamina}
          acento={props.acento}
          {...props.paciente}
        />
      )}

      {props.lista === undefined ? null : (
        <View style={[estilos.hastaLista, { marginTop: props.aireLista ?? ESPACIO[12] }]}>
          {props.lista.columnas === undefined ? (
            <CabeceraLista
              titulo={continuacion ? continua(props.lista.titulo) : props.lista.titulo}
              rotulo={props.lista.rotulo}
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
