/**
 * Sistema de documentos v3 — formato **II.4 · Plan de Suplementación**. Brief `04`.
 * Arquetipo B. Valida que la variante con menos ranuras ocupadas funcione **sin
 * componente paralelo**.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **El bloque de cita de control se retira**, con sus cuatro roles `cita.*`, su
 *    filete propio de 1.9 y su ancho fijo de 294 pt. Decisión de producto: la cita
 *    vive en la agenda, y en el papel repetía un dato que el paciente ya tiene. Es lo
 *    que hace que el caso típico pase de dos hojas a una.
 * 2. **La celda de peso pierde su rótulo secundario** `BASE DEL CÁLCULO` y su valor
 *    baja a la calibración del chasis (defecto §9.8): era la única celda del sistema
 *    con dos rótulos en el mismo renglón y rompía el ritmo de la ficha. El peso sigue
 *    diciendo lo que es — la cabecera de la lista lo rotula con `Dosis calculada para
 *    72.5 kg`, que es donde ese dato significa algo.
 * 3. **Una sola calibración de entrada**: la `suplemento` ya se componía con roles
 *    existentes en v2 y ahora se compone con los mismos que Receta e Imagenología.
 * 4. **`minPresenceAhead: 96` en el bloque de notas**, igual que Receta: detrás va la
 *    banda de cierre con firma y QR.
 *
 * ⚠ **EL PESO COLAPSA DOS COSAS A LA VEZ Y LAS DOS SE RESUELVEN AQUÍ**: la celda de la
 * ficha —eso lo hace 2.F por su cuenta— y el rótulo de la cabecera de lista, que es
 * cosa de este archivo porque es el único que tiene los dos delante.
 */

import { Page, StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import EntradaNumerada, { CabeceraLista, CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import ZonaQR from '../ZonaQR'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import { CIERRE, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

const TITULO = 'Plan de suplementación'
const CABECERA_LISTA = 'Suplementos'
const ITEMS = 'suplementos'
const ROTULO_VERIFICACION = 'Verificación'
const ENCABEZADO_NOTAS = 'Notas adicionales'
const SEPARADOR_ANCLA = ' · '
/** El rótulo de la cabecera, que colapsa con el peso. Ver la cabecera del archivo. */
const DOSIS_PARA = 'Dosis calculada para'

const PRESENCIA_NOTAS = 96

const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'edad', columnas: 2 },
    { campo: 'sexo', columnas: 2 },
    { campo: 'expediente', columnas: 3 },
  ],
  [
    { campo: 'peso', columnas: 4 },
    { campo: 'diagnostico', columnas: 8 },
  ],
]

export interface SuplementoIndicado {
  /** Nombre del suplemento. Mitad izquierda del ancla. */
  readonly nombre?: string
  /** Dosis y pauta: `500 mg cada 12 horas`. Mitad derecha del ancla. */
  readonly dosis?: string
  /**
   * Marca sugerida. **No entra en el ancla**: una marca no identifica el suplemento,
   * lo sugiere. Va al renglón secundario.
   */
  readonly marca?: string
  /** Justificación clínica. Colapsa sola. */
  readonly justificacion?: string
}

export interface PlanSuplementacionProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  readonly seleccionados: readonly SuplementoIndicado[]
  readonly emision?: string
  readonly notas?: string
  readonly folio: string
  readonly qr?: string
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
  banda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
})

function anclaDe(suplemento: SuplementoIndicado): string {
  return [suplemento.nombre, suplemento.dosis]
    .filter((mitad): mitad is string => mitad !== undefined && mitad.trim() !== '')
    .join(SEPARADOR_ANCLA)
}

/** II.4 · Plan de Suplementación. */
export default function PlanSuplementacion({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  seleccionados,
  emision,
  notas,
  folio,
  qr,
  rubrica,
}: PlanSuplementacionProps): ReactElement {
  const firmas: readonly [Firma] = [
    { nombre: medico.nombre, credenciales: medico.cedulas, rubrica },
  ]
  const hayQr = qr !== undefined && qr.trim() !== ''
  const hayPeso = paciente.peso !== undefined && paciente.peso.trim() !== ''

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
          /* La hoja 2 necesita el peso a la vista: la dosis se calculó contra él. */
          extraResumen: hayPeso ? [`Peso ${paciente.peso}`] : [],
        }}
        contador={{ items: ITEMS, total: seleccionados.length }}
        cierre={
          <BloqueDestacado
            variante="recomendaciones"
            encabezado={ENCABEZADO_NOTAS}
            texto={notas}
            presencia={PRESENCIA_NOTAS}
            divisible
          />
        }
        firmas={
          <View style={estilos.banda}>
            <BloqueFirmas
              variante="simple"
              firmas={firmas}
              ancho={hayQr ? CIERRE.izquierda : undefined}
            />
            {hayQr ? (
              <ZonaQR qr={qr!} rotulo={ROTULO_VERIFICACION} folio={folio} acento={acento} />
            ) : null}
          </View>
        }
      >
        <CabeceraLista
          titulo={CABECERA_LISTA}
          rotulo={hayPeso ? `${DOSIS_PARA} ${paciente.peso}` : undefined}
          acento={acento}
        />
        {seleccionados.map((suplemento, indice) => (
          <EntradaNumerada
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(suplemento)}
            secundario={suplemento.marca}
            nota={suplemento.justificacion}
            acento={acento}
          />
        ))}
        <CierreEntradas />
      </MotorFlujo>

      {/*
        Con folio: es uno de los dos formatos con verificación, y quien la consulta
        —un mostrador de farmacia o una tienda de suplementos— cita el número.
      */}
      <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
    </Page>
  )
}
