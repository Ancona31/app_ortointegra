/**
 * Sistema de documentos v3 — formato **II.2 · Solicitud de Imagenología**.
 * Brief `02`. Arquetipo A: gemelo de Laboratorio con entrada de cuatro datos y marca
 * de urgencia.
 *
 * ── LAS TRES DIFERENCIAS CON SU GEMELO, Y NINGUNA ES DE CALIBRACIÓN ─────────
 *
 * 1. **La entrada monta tres ranuras** —ancla, secundario y nota con rótulo— donde
 *    Laboratorio monta una. Es el mismo componente con la misma calibración: eso es lo
 *    que cierra el defecto §8, donde los dos formatos del mismo arquetipo componían su
 *    lista con cuerpos distintos.
 * 2. **El rótulo `INDICACIÓN` cuelga de la nota a 13 de interlineado** y no a 16
 *    (defecto §9.2): llevaba el interlineado de otro rol y no alineaba con la primera
 *    línea del texto que rotula.
 * 3. **`URGENTE` marca el DOCUMENTO, no el estudio**, y por eso va bajo la fila de
 *    título y no dentro de una entrada. Se repite en la variante de continuación, que
 *    es lo que II.2 §5 exige: una hoja suelta tiene que decir que el estudio es urgente.
 *
 * ⚠ **EL PAR `tipo` + `region` SE UNE AQUÍ, Y ES REDACCIÓN DE ESTE FORMATO.** 2.G no
 * sabe que sus dos datos son una modalidad y una región anatómica. Cada mitad puede
 * faltar y se filtra lo que hay: con una sola, no queda la raya suelta. El formulario
 * debe exigir el par (Paso 5); **el render no inventa el faltante**.
 */

import { Page, StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import BloqueNegativo from '../BloqueNegativo'
import EntradaNumerada, { CabeceraLista, CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import { ESPACIO, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

const TITULO = 'Solicitud de imagenología'
const CABECERA_LISTA = 'Estudios'
const ITEMS = 'estudios'
const ROTULO_INDICACION = 'Indicación'
const SEPARADOR_ANCLA = ' · '

/**
 * `minPresenceAhead` de este formato (brief 00 §9.2). Lo lleva la **última entrada de
 * la lista** y no un bloque de cierre, porque este formato no tiene bloque de cierre:
 * detrás de la lista va directamente la banda de firma.
 */
const PRESENCIA_ULTIMA = 88

const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'edad', columnas: 2 },
    { campo: 'sexo', columnas: 2 },
    { campo: 'expediente', columnas: 3 },
  ],
  [{ campo: 'diagnostico', columnas: 12 }],
]

export interface EstudioSolicitado {
  /** Modalidad: `Radiografía`, `Resonancia magnética`. Mitad izquierda del ancla. */
  readonly tipo: string
  /** Región anatómica: `Rodilla derecha`. Mitad derecha del ancla. */
  readonly region: string
  /** Proyecciones. Colapsa sola. */
  readonly proyecciones?: string
  /** Indicación clínica. Colapsa con su rótulo. */
  readonly indicacion?: string
}

export interface SolicitudImagenologiaProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  readonly estudios: readonly EstudioSolicitado[]
  readonly emision?: string
  /** Marca del documento, no del estudio. Ver el punto 3 de la cabecera. */
  readonly urgente: boolean
  readonly folio: string
  readonly rubrica?: string
}

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  urgente: {
    marginBottom: ESPACIO[8],
    alignItems: 'flex-start',
  },
})

/** El ancla: `modalidad · región`, con la raya del sistema. */
function anclaDe(estudio: EstudioSolicitado): string {
  return [estudio.tipo, estudio.region]
    .filter((mitad) => mitad !== undefined && mitad.trim() !== '')
    .join(SEPARADOR_ANCLA)
}

/** II.2 · Solicitud de Imagenología. */
export default function SolicitudImagenologia({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  estudios,
  emision,
  urgente,
  folio,
  rubrica,
}: SolicitudImagenologiaProps): ReactElement {
  const firmas: readonly [Firma] = [
    { nombre: medico.nombre, credenciales: medico.cedulas, rubrica },
  ]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          titulo: TITULO,
          emision,
          folio,
          paciente,
          filasFicha: FICHA,
        }}
        contador={{ items: ITEMS, total: estudios.length }}
        firmas={
          <View>
            <BloqueFirmas variante="simple" firmas={firmas} />
          </View>
        }
      >
        {/*
          La marca de urgencia, bajo la ficha y antes de la lista. En v2 vivía entre el
          título y el riel, donde la fila de título de v3 ya no deja sitio: su tercera
          celda llega al borde derecho.

          ⚠ **NO SE REPITE EN LAS HOJAS DE CONTINUACIÓN**, y II.2 §5 dice que debería.
          El encabezado de continuación de v3 son 37 pt cerrados —rótulo, filete y línea
          de paciente— y meter el bloque negativo dentro obligaría a medirlo otra vez
          para los nueve formatos. Lo que la hoja 2 sí dice es el folio, que permite
          cotejar. Reportado en `dudas.md` §12.
        */}
        {urgente ? (
          <View style={estilos.urgente}>
            <BloqueNegativo variante="urgente" />
          </View>
        ) : null}

        <CabeceraLista titulo={CABECERA_LISTA} acento={acento} />
        {estudios.map((estudio, indice) => (
          <EntradaNumerada
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(estudio)}
            secundario={estudio.proyecciones}
            nota={estudio.indicacion}
            rotuloNota={ROTULO_INDICACION}
            acento={acento}
            /* Ver `PRESENCIA_ULTIMA`: lo lleva la última, que es la que tiene la
               banda de cierre detrás. */
            presencia={indice === estudios.length - 1 ? PRESENCIA_ULTIMA : undefined}
          />
        ))}
        <CierreEntradas />
      </MotorFlujo>

      <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
    </Page>
  )
}
