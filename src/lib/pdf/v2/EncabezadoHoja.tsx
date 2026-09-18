/**
 * Sistema de documentos v3 — 2.V · **EncabezadoHoja**. Coloca el encabezado de una
 * hoja y decide cuál de las dos variantes va en ella. **No aporta geometría propia**
 * salvo la del encabezado de continuación, que es suyo.
 *
 * ── LA HOJA 1 ───────────────────────────────────────────────────────────────
 *
 *     Membrete                64.8
 *     espaciador de cierre    10      `transicion.membreteCierre`
 *     fila de título          22      (la fija la celda de folio: 9 + 13)
 *     aire                     4      `transicion.tituloFilete`
 *     filete                   0.8
 *     aire                     8      `transicion.tituloFicha`
 *     ficha de identificación  27 × filas + lo que envuelva
 *                            ──────
 *                            136.6 + ficha
 *
 * Con una ficha de dos filas son **190.6 pt**, contra los 223.88 de la Receta de v2 y
 * los 511.6 del Consentimiento. Ése es el §5 del diagnóstico —el coste fijo del
 * chasis— y se paga aquí.
 *
 * ── LA HOJA DE CONTINUACIÓN: 37 pt, IDÉNTICOS EN LOS NUEVE FORMATOS ─────────
 *
 *     rótulo `TÍTULO · CONTINUACIÓN`   11      `continuacion.rotulo`, 8.5/11
 *     aire                              4
 *     filete 0.8 negro                  0.8
 *     aire                              2.67
 *     línea de paciente                11      `medico.credencial` en `tinta.etiqueta`
 *     aire de cierre                    8
 *                                     ─────
 *                                      37.47
 *
 * ⚠ **EL NOMBRE DEL MÉDICO A 14 / 18 SE RETIRA DE ESTA VARIANTE.** Lo identifica la
 * línea inferior, y en el Escrito —que no tiene paciente— esa línea lleva justamente
 * sus dos cédulas. Con el nombre, la cabecera medía 58 pt y repetía en cada hoja una
 * identificación que la hoja 1 ya dio.
 *
 * ⚠ **EL AIRE DE CIERRE DE LA CONTINUACIÓN SON 8 Y NO LOS 10 DEL MEMBRETE.** El §3.5
 * del brief unifica el espaciador «en las dos variantes de encabezado» y su §8 mide 8
 * en esta. Se compone el 8, que es el de la pieza medida; el 10 es el del membrete, que
 * aquí no se compone. `dudas.md` §10.
 *
 * ── LA CABECERA DE LISTA SALE DE AQUÍ (defecto §3.1) ────────────────────────
 *
 * En v2 el encabezado de hoja montaba también la cabecera de la lista, así que una
 * hoja de continuación **rotulaba una lista que no continuaba**: el bloque de notas
 * del Laboratorio caía tras un `SOLICITUD DE LABORATORIO · CONTINUACIÓN` con nada
 * debajo. En v3 la cabecera vive en el FLUJO, justo antes de la primera entrada, y la
 * compone el formato. `ListaEncabezado` y la prop `lista` se retiran.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloquePaciente, {
  resumenPaciente,
  type CeldaPaciente,
  type ValoresPaciente,
} from './BloquePaciente'
import Membrete, { type ConsultorioMembrete, type MedicoMembrete } from './Membrete'
import type { PanelCircularProps } from './PanelCircular'
import TituloDocumento, { CeldaFolio, ETIQUETA_EMISION, ETIQUETA_FOLIO } from './TituloDocumento'
import type { CalibracionFicha } from './RielDatos'
import {
  ESPACIO,
  FILETE,
  TINTA,
  TITULO_FILA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/** El rótulo de continuación, constante del sistema para los nueve formatos. */
const CONTINUACION = 'continuación'
const SEPARADOR = ' · '

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rotulo: {
    ...estiloTipografico('continuacion.rotulo'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  aireFilete: { height: ESPACIO[4] },
  filete: {
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  aireLinea: { height: 2.67 },
  lineaPaciente: {
    ...estiloTipografico('medico.credencial'),
    color: TINTA.etiqueta,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  cierre: { height: ESPACIO[8] },
  aireFicha: { height: TRANSICION.fichaContenido },
})

export interface EncabezadoHojaProps {
  /** Qué hoja se compone. Lo decide 2.N, nunca el formato. */
  readonly variante: 'primera' | 'continuacion'
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /** Nombre del documento, en capitalización de oración. */
  readonly titulo: string
  /** Subtítulo de la fila de título. Cotización y Denegación. */
  readonly subtitulo?: string
  readonly emision?: string
  readonly folio?: string
  /** Los datos de la ficha. Sin ellos no hay ficha: es el caso del Escrito médico. */
  readonly paciente?: ValoresPaciente
  /** Las filas de la ficha, declaradas por el formato. */
  readonly filasFicha?: readonly (readonly CeldaPaciente[])[]
  readonly calibracionFicha?: CalibracionFicha
  /**
   * Piezas que este formato añade a la línea de paciente de las hojas de
   * continuación: el hospital en Internamiento, el peso en Suplementación.
   */
  readonly extraResumen?: readonly string[]
  /**
   * Rótulo propio de una hoja que no es una continuación cualquiera: las hojas de
   * testigos y de anexo del Consentimiento, que son `Page` propios y traen su rótulo
   * escrito en el componente (brief 00 §9.5). Sin él, `TÍTULO · CONTINUACIÓN`.
   *
   * ⚠ **AQUÍ MUERE EL MAPA `{ 5: { rotulo: … } }` INDEXADO POR NÚMERO DE HOJA**, que
   * es el defecto §4: bastaba que el documento creciera una hoja para que el rótulo
   * del anexo apareciera sobre una hoja de texto corrido.
   */
  readonly rotulo?: string
}

/** La ficha de la hoja 1, con su aire hasta el contenido. Colapsa entera sin datos. */
function Ficha({
  paciente,
  filas,
  calibracion,
}: {
  readonly paciente?: ValoresPaciente
  readonly filas?: readonly (readonly CeldaPaciente[])[]
  readonly calibracion?: CalibracionFicha
}): ReactElement | null {
  if (paciente === undefined || filas === undefined || filas.length === 0) return null
  return (
    <>
      <BloquePaciente valores={paciente} filas={filas} calibracion={calibracion} />
      <View style={estilos.aireFicha} />
    </>
  )
}

/** 2.V · `EncabezadoHoja`. */
export default function EncabezadoHoja(props: EncabezadoHojaProps): ReactElement {
  if (props.variante === 'primera') {
    return (
      <View>
        <Membrete
          medico={props.medico}
          consultorio={props.consultorio}
          panel={props.panel}
          acento={props.acento}
        />
        <TituloDocumento
          titulo={props.titulo}
          subtitulo={props.subtitulo}
          emision={props.emision}
          folio={props.folio}
          acento={props.acento}
        />
        <Ficha
          paciente={props.paciente}
          filas={props.filasFicha}
          calibracion={props.calibracionFicha}
        />
      </View>
    )
  }

  /*
    LA CELDA DEL RIEL DERECHO: folio si lo hay, emisión si no.

    Es UNA celda y no dos: la cabecera de continuación tiene 37 pt y lo que un tercero
    coteja en una hoja suelta es el identificador. Los formatos sin folio impreso
    —Internamiento, Escrito— componen la emisión, que es el único dato que ata esa
    hoja a un acto.
  */
  const celda =
    props.folio !== undefined && props.folio.trim() !== ''
      ? { etiqueta: ETIQUETA_FOLIO, valor: props.folio, esFolio: true }
      : props.emision !== undefined && props.emision.trim() !== ''
        ? { etiqueta: ETIQUETA_EMISION, valor: props.emision, esFolio: false }
        : undefined

  /*
    LA LÍNEA INFERIOR. Con paciente, su identificación; sin paciente —el Escrito—, las
    dos cédulas del médico. No queda vacía nunca: es lo que ata la hoja a su emisor.
  */
  const linea =
    props.paciente === undefined
      ? props.medico.cedulas.join(SEPARADOR)
      : resumenPaciente(props.paciente, props.extraResumen)

  return (
    <View>
      <View style={estilos.cabecera}>
        <Text style={estilos.rotulo}>
          {(props.rotulo ?? `${props.titulo}${SEPARADOR}${CONTINUACION}`).toUpperCase()}
        </Text>
        {celda === undefined ? null : (
          <CeldaFolio
            etiqueta={celda.etiqueta}
            valor={celda.valor}
            ancho={TITULO_FILA.folio}
            acento={props.acento}
            esFolio={celda.esFolio}
          />
        )}
      </View>

      <View style={estilos.aireFilete} />
      <View style={estilos.filete} />
      <View style={estilos.aireLinea} />
      {linea === '' ? null : <Text style={estilos.lineaPaciente}>{linea}</Text>}
      <View style={estilos.cierre} />
    </View>
  )
}
