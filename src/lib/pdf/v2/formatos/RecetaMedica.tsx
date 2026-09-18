/**
 * Sistema de documentos v3 — formato **II.3 · Receta Médica**. Brief `03`.
 * Arquetipo B: el de mayor volumen del sistema.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **Una sola calibración de entrada** (defecto §8). `entradaMedicamento.*` —cinco
 *    roles que se diferenciaban de `entrada.*` en un punto de cuerpo— se retira. El
 *    medicamento monta las cuatro ranuras: ancla, genérico, vía y pauta.
 * 2. **El bloque de alarma se retiró ya en v2** y no vuelve: `RecetaForm` tiene un
 *    solo campo de cierre y se llama Recomendaciones generales. Con él se fue
 *    `FILETE.alarma`, el grosor máximo del sistema, que **no se reasigna**.
 * 3. **`minPresenceAhead: 96` en el bloque de recomendaciones** (defecto §2). Detrás
 *    va la banda de cierre con firma **y QR**, que es más alta que la de una celda
 *    sola: 83.75 de la celda con QR de 48 al lado, más 12 de aire.
 * 4. **La densidad**: con la caja en 540 × 693 y el encabezado en 190.6, la hoja 1
 *    admite **siete medicamentos con recomendaciones, firma y QR**, contra los cuatro
 *    de v2. El caso denso de la lámina —siete— pasa de dos hojas a una.
 *
 * ── LAS DOS DECISIONES DE ANGEL QUE VAN CONTRA LO MEDIDO, Y SIGUEN EN PIE ───
 *
 * 1. **LAS TRECE VÍAS VAN EN NEGATIVO, INCLUIDA LA ORAL.** El archivo de diseño
 *    compone la oral como texto plano; aquí van las trece en bloque. Por eso este
 *    archivo **no compara contra ninguna vía**: el catálogo vive fuera del render.
 * 2. **SIN GENÉRICO, LA RANURA COLAPSA ENTERA**, en vez de dejar rótulo y línea. La
 *    línea de 2.E mide `MANUSCRITO.ancho` —274 pt, medidos contra la presentación más
 *    larga del catálogo— y se solapaba con el bloque de la vía.
 *
 * ⚠ **AQUÍ NO HAY RANURA DE `dosis`, Y NO ES UN OLVIDO.** `RecetaForm` no la captura:
 * la clave existe en el tipo y en su objeto vacío, y ningún campo del formulario la
 * escribe. Los miligramos van en `presentacion` y la pauta en `indicacion`. Añadirla
 * compondría un rótulo con una línea vacía en todas las recetas.
 */

import { Page, StyleSheet, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import BloqueNegativo from '../BloqueNegativo'
import EntradaNumerada, { CabeceraLista, CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import ZonaQR from '../ZonaQR'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import { CIERRE, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

const TITULO = 'Receta médica'
const CABECERA_LISTA = 'Medicamentos'
const ITEMS = 'medicamentos'
const ROTULO_VERIFICACION = 'Verificación'
const ENCABEZADO_RECOMENDACIONES = 'Recomendaciones generales'
const SEPARADOR_ANCLA = ' · '

/** II.3 §2: «No requerido, por defecto oral». No es una suposición del render. */
const VIA_POR_DEFECTO = 'Oral'

/** Ver el punto 3 de la cabecera. Techo, no reserva. */
const PRESENCIA_RECOMENDACIONES = 96

const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'edad', columnas: 2 },
    { campo: 'sexo', columnas: 2 },
    { campo: 'expediente', columnas: 3 },
  ],
  [{ campo: 'diagnostico', columnas: 12 }],
]

export interface MedicamentoRecetado {
  /** Nombre comercial. Sin él, el ancla se queda con la presentación. */
  readonly nombre_comercial?: string
  /** Presentación y gramaje: `Tabletas 15 mg, caja con 10`. */
  readonly presentacion?: string
  /**
   * Denominación genérica. **Va en tinta plena** (regla 5 de 2.G): es el único campo
   * obligatorio por normativa y no puede componerse como dato de segunda.
   */
  readonly principio_activo?: string
  /** Una de las trece vías de II.3 §5. Sin ella, `Oral`. Siempre en negativo. */
  readonly via_administracion?: string
  /** La pauta. Colapsa sola. */
  readonly indicacion?: string
}

export interface RecetaMedicaProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  /** Al menos uno: bloquea emisión en el formulario. */
  readonly medicamentos: readonly MedicamentoRecetado[]
  readonly emision?: string
  /** El único bloque de cierre del formato. Colapsa entero. */
  readonly recomendaciones?: string
  readonly folio: string
  /** Sin ráster, la zona colapsa y la banda de cierre se queda con la firma sola. */
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
  /**
   * LA BANDA DE CIERRE: firma a la IZQUIERDA, verificación a la derecha, alineadas
   * **por arriba** (brief 00 §6). En v2 iban por el borde inferior y la firma —la más
   * alta— arrastraba el QR a su base, que es el defecto §9.4 visto del otro lado.
   *
   * No se escribe ningún ancho: la firma trae el suyo (`CIERRE.izquierda`) y la zona de
   * QR mide lo que miden sus dos piezas. `space-between` deja el sobrante en medio.
   */
  banda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
})

/** El ancla: `comercial · presentación`. La redacción es de este formato, no de 2.G. */
function anclaDe(medicamento: MedicamentoRecetado): string {
  return [medicamento.nombre_comercial, medicamento.presentacion]
    .filter((mitad): mitad is string => mitad !== undefined && mitad.trim() !== '')
    .join(SEPARADOR_ANCLA)
}

/** II.3 · Receta Médica. */
export default function RecetaMedica({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  medicamentos,
  emision,
  recomendaciones,
  folio,
  qr,
  rubrica,
}: RecetaMedicaProps): ReactElement {
  const firmas: readonly [Firma] = [
    { nombre: medico.nombre, credenciales: medico.cedulas, rubrica },
  ]
  const hayQr = qr !== undefined && qr.trim() !== ''

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
        contador={{ items: ITEMS, total: medicamentos.length }}
        cierre={
          <BloqueDestacado
            variante="recomendaciones"
            encabezado={ENCABEZADO_RECOMENDACIONES}
            texto={recomendaciones}
            presencia={PRESENCIA_RECOMENDACIONES}
            /* El pasaje puede ser largo —el médico escribe lo que quiera— y un bloque
               indivisible de 100 pt al pie de hoja dejaría 100 pt de blanco. */
            divisible
          />
        }
        firmas={
          <View style={estilos.banda}>
            <BloqueFirmas
              variante="simple"
              firmas={firmas}
              /* Sin QR la firma se queda con la caja entera: una línea de escritura de
                 274 pt con 248 pt de blanco al lado se lee como un error. */
              ancho={hayQr ? CIERRE.izquierda : undefined}
            />
            {hayQr ? (
              <ZonaQR qr={qr!} rotulo={ROTULO_VERIFICACION} folio={folio} acento={acento} />
            ) : null}
          </View>
        }
      >
        <CabeceraLista titulo={CABECERA_LISTA} acento={acento} />
        {medicamentos.map((medicamento, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos renglones pueden recetar el mismo fármaco
            // a distinta pauta y lo único que los distingue es su orden.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(medicamento)}
            secundario={medicamento.principio_activo}
            /*
              LA VÍA, SIEMPRE EN NEGATIVO y sin la palabra «Vía» delante: el bloque de
              6.5 pt con `VÍA ORAL` gastaba cuatro caracteres en decir lo que la forma
              del bloque ya dice. En v2 la palabra viajaba dentro de la cadena.
            */
            marca={
              <BloqueNegativo
                variante="via"
                via={
                  medicamento.via_administracion !== undefined &&
                  medicamento.via_administracion.trim() !== ''
                    ? medicamento.via_administracion
                    : VIA_POR_DEFECTO
                }
              />
            }
            nota={medicamento.indicacion}
            acento={acento}
          />
        ))}
        <CierreEntradas />
      </MotorFlujo>

      <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
    </Page>
  )
}
