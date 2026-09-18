/**
 * Sistema de documentos v3 — formato **II.1 · Solicitud de Laboratorio**.
 * Brief `01`. Arquetipo A: el chasis desnudo. Si aquí falla algo, el defecto es del
 * chasis y no del formato.
 *
 * ESTE ARCHIVO NO DECIDE GEOMETRÍA: ni un número con unidad fuera de un token. Lo que
 * declara es sus cadenas, sus filas de ficha y su presencia mínima.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **La lista usa la calibración única `entrada.*`** y no `entradaCompacta.*`
 *    (defecto §8). Sólo monta la ranura `ancla`: un estudio de laboratorio es un
 *    nombre y nada más, y las cuatro ranuras que no se pasan no dejan hueco.
 * 2. **La cabecera de la lista vive en el flujo** y no en el encabezado de hoja
 *    (defecto §3.1): en v2 la hoja 2 rotulaba `SOLICITUD DE LABORATORIO ·
 *    CONTINUACIÓN` con el bloque de notas debajo y ninguna lista que continuar.
 * 3. **`minPresenceAhead: 88` en el bloque de notas** (defecto §3.3 y §2). Es el alto
 *    de la banda de cierre de una celda —72.75— más su aire de 12, redondeado hacia
 *    arriba al múltiplo de 4 siguiente. Sin él, el encabezado `Indicaciones para la
 *    toma` se quedaba al pie de hoja y su lista bajaba sola.
 * 4. **La ficha lleva dos filas de seis celdas**: la fecha y la hora viven aquí y no
 *    en la fila de título, que es lo que este formato medía y sigue midiendo — el
 *    laboratorio necesita la hora de la indicación para el ayuno.
 */

import { Page, StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import EntradaNumerada, { CabeceraLista, CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import { MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

const TITULO = 'Solicitud de laboratorio'
/*
 * ⚠ ERA `'Solicitud de laboratorio'`, IGUAL QUE EL TÍTULO, y se veía: el rótulo del
 * documento salía DOS VECES seguidas, en el bloque de título y otra vez cuatro
 * renglones debajo como cabecera de la lista. La cabecera nombra lo que viene debajo
 * —como `Medicamentos` en la Receta o `Suplementos` en II.4—, no el documento.
 */
const CABECERA_LISTA = 'Estudios'
const ITEMS = 'estudios'
const ENCABEZADO_NOTAS = 'Indicaciones para la toma'

/**
 * `minPresenceAhead` de este formato (brief 00 §9.2). **Es un techo**: el motor aplica
 * `min(88, altoRealDeLoQueSigue)`. Lo que sigue es la banda de cierre de una celda sin
 * rol —72.75— más su aire de 12, así que el techo nunca se agota y el efecto es
 * exactamente el que se busca: si no caben los dos, bajan los dos.
 */
const PRESENCIA_NOTAS = 88

/** Las dos filas de la ficha. Cada una suma 12 columnas de `RIEL_CELDA`. */
const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'edad', columnas: 2 },
    { campo: 'sexo', columnas: 2 },
    { campo: 'expediente', columnas: 3 },
  ],
  [
    { campo: 'diagnostico', columnas: 5 },
    { campo: 'fecha', columnas: 4 },
    { campo: 'hora', columnas: 3 },
  ],
]

/** Un estudio. Una sola ranura: el nombre del estudio es todo lo que hay. */
export interface EstudioLaboratorio {
  readonly nombre: string
}

export interface SolicitudLaboratorioProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  /** Al menos uno: el formulario bloquea emisión sin estudios. */
  readonly estudios: readonly EstudioLaboratorio[]
  /** Indicaciones para el laboratorio. Colapsa el bloque entero. */
  readonly notas?: string
  readonly folio: string
  readonly rubrica?: string
}

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Reserva el suelo donde viven la banda de pie y el aviso de continuación.
    paddingBottom: MARGEN.inferior,
  },
})

/** II.1 · Solicitud de Laboratorio. */
export default function SolicitudLaboratorio({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  estudios,
  notas,
  folio,
  rubrica,
}: SolicitudLaboratorioProps): ReactElement {
  const firmas: readonly [Firma] = [
    // Sin `rol`: en la celda del médico lo dicen su nombre y sus cédulas (brief 00 §6.1).
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
          folio,
          paciente,
          filasFicha: FICHA,
        }}
        contador={{ items: ITEMS, total: estudios.length }}
        cierre={
          <BloqueDestacado
            variante="recomendaciones"
            encabezado={ENCABEZADO_NOTAS}
            texto={notas}
            presencia={PRESENCIA_NOTAS}
          />
        }
        firmas={
          <View>
            <BloqueFirmas variante="simple" firmas={firmas} />
          </View>
        }
      >
        <CabeceraLista titulo={CABECERA_LISTA} acento={acento} />
        {estudios.map((estudio, indice) => (
          // El índice ES la identidad: dos filas pueden pedir el mismo estudio en
          // distinta muestra y lo único que las distingue es su orden.
          <EntradaNumerada
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={estudio.nombre}
            acento={acento}
          />
        ))}
        {/*
          El filete que cierra la lista. Sale en TODAS las hojas, no sólo en la última:
          es un nodo del flujo y cae donde cae. En la lámina cierra la lista de cada
          hoja justo encima del contador, así que coincide — pero no es este archivo
          quien lo garantiza.
        */}
        <CierreEntradas />
      </MotorFlujo>

      {/*
        Variante `completo`: el laboratorio es ventanilla que verifica de forma
        rutinaria y cita el folio cuando una muestra no cuadra.
      */}
      <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
    </Page>
  )
}
