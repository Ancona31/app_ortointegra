/**
 * Sistema de documentos v3 — formato **II.6 · Solicitud de Internamiento**. Brief `06`.
 * Especial: **dos secciones, dos lectores**. La 1 la lee Admisión y la firma el
 * paciente; la 2 la leen enfermería y el residente.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **`MOTIVO DE INTERNAMIENTO`, no `PROCEDIMIENTO O CIRUGÍA`** (decisión cerrada del
 *    README): no todo ingreso es una cirugía, y el rótulo anterior obligaba a escribir
 *    una en el 100 % de los casos.
 * 2. **El médico firma a la izquierda** y el paciente o familiar a la derecha, en los
 *    nueve formatos. En v2 esta lámina los componía al revés.
 * 3. **La justificación clínica lleva sangría derecha de 12 pt** (defecto §9.6): con la
 *    caja en 540 su última línea llegaba al borde y el bloque dejaba de leerse como un
 *    bloque.
 * 4. **`minPresenceAhead: 96` en el bloque de instrucciones** (defecto §2). En el caso
 *    típico eso baja el documento de tres hojas a dos.
 * 5. **El salto antes de la sección 2 se conserva** —es estructural, no de flujo— y
 *    **sólo existe si hay indicaciones de piso**: sin ellas, la sección 2 colapsa
 *    entera y el documento acaba en la firma del paciente.
 *
 * ⚠ **ESTE FORMATO NO ENTREGA SUS FIRMAS AL MOTOR, Y ES EL ÚNICO ASÍ.** Tiene DOS
 * bandas de cierre —una por sección, porque cada una la firma otra persona— y la ranura
 * `firmas` de 2.N es una. Van en el flujo, cada una detrás de su sección, con su
 * `wrap={false}` propio. Lo que el motor sigue haciendo es el encabezado, la banda de
 * pie y el aviso.
 */

import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import AperturaSeccion from '../AperturaSeccion'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import BloqueNegativo from '../BloqueNegativo'
import MotorFlujo from '../MotorFlujo'
import ParserBloques from '../ParserBloques'
import PieDocumento from '../PieDocumento'
import RielDatos from '../RielDatos'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import {
  ESPACIO,
  FILETE,
  MARGEN,
  PAPEL,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

const TITULO = 'Solicitud de internamiento'
/*
 * ⚠ LOS CUATRO RÓTULOS SE COMPONEN EN VERSALITA, y salían en minúscula.
 *
 * El rol `bloqueSimple.titulo` lleva 0.14 em de tracking, que es lo que el sistema pone
 * a un rótulo en mayúsculas; sobre minúsculas se lee como texto suelto y espaciado, y
 * este formato era el ÚNICO de los nueve que no llamaba a `toUpperCase()`. Se guardan en
 * capitalización de oración y se componen arriba, como manda la regla 1 del preámbulo
 * de la Sección II.
 */
const ROTULO_DIAGNOSTICOS = 'Diagnósticos'
/** Ver el punto 1 de la cabecera. */
const ROTULO_MOTIVO = 'Motivo de internamiento'
const ROTULO_REQUERIMIENTOS = 'Requerimientos especiales'
const ROTULO_JUSTIFICACION = 'Justificación clínica'
const ENCABEZADO_INSTRUCCIONES = 'Instrucciones para el paciente'
const ROTULO_FIRMA_PACIENTE = 'Firma del paciente o familiar'
const NOTA_FIRMA_PACIENTE = 'Nombre y firma · parentesco si aplica'
const SECCION_2 = {
  titulo: 'Indicaciones de ingreso a piso',
  lector: 'Para personal de enfermería y médico residente',
}
/** La raya del sistema como marca de lista. Ver `item.raya` en los tokens. */
const RAYA = '—'
/** Columnas del catálogo de requerimientos. Tres: es lo que mide la lámina. */
const COLUMNAS_CATALOGO = 3

const PRESENCIA_INSTRUCCIONES = 96

const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'fechaIngreso', columnas: 4 },
    { campo: 'expediente', columnas: 3 },
  ],
  [
    { campo: 'hospital', columnas: 4 },
    { campo: 'tipoInternamiento', columnas: 4 },
    { campo: 'diasEstimados', columnas: 3 },
    { campo: 'asa', columnas: 1 },
  ],
]

export interface SolicitudInternamientoProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  readonly emision?: string
  readonly urgente: boolean
  /** Diagnóstico principal. Bloquea emisión. */
  readonly diagnostico: string
  readonly diagnosticosSecundarios: readonly string[]
  readonly procedimiento?: string
  /** Catálogo cerrado de requerimientos, ya filtrado por el adaptador. */
  readonly requerimientos: readonly string[]
  /** Lo que el médico añadió a mano. Entra al final del catálogo. */
  readonly requerimientosExtra?: string
  readonly justificacion?: string
  readonly instruccionesPaciente?: string
  /** Sin ellas, **la sección 2 colapsa entera**. Ver el punto 5 de la cabecera. */
  readonly indicacionesPiso?: string
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
  urgente: { marginBottom: ESPACIO[8], alignItems: 'flex-start' },
  bloque: {
    borderTopWidth: FILETE.tabla,
    borderTopColor: TINTA.reglaSuave,
    paddingTop: ESPACIO[6],
    marginBottom: ESPACIO[12],
  },
  rotulo: { ...estiloTipografico('bloqueSimple.titulo'), marginBottom: ESPACIO[4] },
  texto: { ...estiloTipografico('texto.corrido') },
  /** Defecto §9.6: la justificación no llega al borde derecho. */
  justificacion: { ...estiloTipografico('texto.corrido'), paddingRight: 12 },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  raya: { ...estiloTipografico('item.raya'), width: 16, flexShrink: 0 },
  itemTexto: { ...estiloTipografico('texto.corrido'), flexGrow: 1, flexShrink: 1, minWidth: 0 },
  banda: { flexDirection: 'row', alignItems: 'flex-start', marginTop: TRANSICION.contenidoCierre },
  /** El salto estructural. `break` en el contenedor de la sección 2. */
  seccion2: {},
})

/** La lista de diagnósticos: raya del sistema y texto corrido. */
function ListaConRaya({ items }: { readonly items: readonly string[] }): ReactElement {
  return (
    <View>
      {items.map((item, indice) => (
        <View key={indice} style={estilos.item}>
          <Text style={estilos.raya}>{RAYA}</Text>
          <Text style={estilos.itemTexto}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

/** II.6 · Solicitud de Internamiento. */
export default function SolicitudInternamiento({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  emision,
  urgente,
  diagnostico,
  diagnosticosSecundarios,
  procedimiento,
  requerimientos,
  requerimientosExtra,
  justificacion,
  instruccionesPaciente,
  indicacionesPiso,
  rubrica,
}: SolicitudInternamientoProps): ReactElement {
  const firmaMedico: Firma = {
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
  /**
   * La celda del paciente va con el renglón del nombre EN BLANCO a propósito: lo
   * escribe él en Admisión. Su peso es 400 —no el 600 del médico— porque lo que va
   * debajo de la línea es una instrucción, no una identificación ya hecha.
   */
  const firmaPaciente: Firma = {
    rol: ROTULO_FIRMA_PACIENTE,
    credenciales: [NOTA_FIRMA_PACIENTE],
    pesoNombre: 400,
  }

  const catalogo = [
    ...requerimientos,
    ...(requerimientosExtra !== undefined && requerimientosExtra.trim() !== ''
      ? [requerimientosExtra]
      : []),
  ]
  const diagnosticos = [diagnostico, ...diagnosticosSecundarios].filter(
    (d) => d !== undefined && d.trim() !== '',
  )
  const haySeccion2 = indicacionesPiso !== undefined && indicacionesPiso.trim() !== ''

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
          paciente,
          filasFicha: FICHA,
          /* La quinta pieza de la línea de continuación: este es el único formato del
             sistema que la lleva, y lo que añade es el hospital. */
          extraResumen:
            paciente.hospital === undefined ? [] : [paciente.hospital],
        }}
      >
        {urgente ? (
          <View style={estilos.urgente}>
            <BloqueNegativo variante="urgente" />
          </View>
        ) : null}

        {diagnosticos.length === 0 ? null : (
          <View style={estilos.bloque}>
            <Text style={estilos.rotulo}>{ROTULO_DIAGNOSTICOS.toUpperCase()}</Text>
            <ListaConRaya items={diagnosticos} />
          </View>
        )}

        {procedimiento === undefined || procedimiento.trim() === '' ? null : (
          <View style={estilos.bloque}>
            <Text style={estilos.rotulo}>{ROTULO_MOTIVO.toUpperCase()}</Text>
            <Text style={estilos.texto}>{procedimiento}</Text>
          </View>
        )}

        {catalogo.length === 0 ? null : (
          <View style={estilos.bloque}>
            <Text style={estilos.rotulo}>{ROTULO_REQUERIMIENTOS.toUpperCase()}</Text>
            <RielDatos variante="catalogo" items={catalogo} columnas={COLUMNAS_CATALOGO} />
          </View>
        )}

        {justificacion === undefined || justificacion.trim() === '' ? null : (
          <View style={estilos.bloque}>
            <Text style={estilos.rotulo}>{ROTULO_JUSTIFICACION.toUpperCase()}</Text>
            <Text style={estilos.justificacion}>{justificacion}</Text>
          </View>
        )}

        <BloqueDestacado
          variante="instrucciones"
          encabezado={ENCABEZADO_INSTRUCCIONES}
          texto={instruccionesPaciente}
          presencia={PRESENCIA_INSTRUCCIONES}
          divisible
        />

        {/*
          LA BANDA DE CIERRE DE LA SECCIÓN 1: médico a la izquierda, paciente a la
          derecha. Va en el flujo y no en la ranura del motor. Ver la cabecera.
        */}
        <View style={estilos.banda} wrap={false}>
          <BloqueFirmas variante="pareja" firmas={[firmaMedico, firmaPaciente]} />
        </View>

        {haySeccion2 ? (
          // `break`: el salto es ESTRUCTURAL —cambia de lector— y no depende de si
          // cabe. Es el único salto declarado que v3 conserva de los cinco de v2.
          <View style={estilos.seccion2} break>
            <AperturaSeccion
              numero={2}
              de={2}
              titulo={SECCION_2.titulo}
              lector={SECCION_2.lector}
              acento={acento}
            />
            {/*
              `ascenderEncabezados` por defecto —`true`—: aquí el ascenso es CORRECTO.
              `Dieta`, `Soluciones` y `Medicamentos` son encabezados de sus viñetas, y es
              el único consumidor del sistema donde eso es lo que el médico escribió.
            */}
            <ParserBloques texto={indicacionesPiso!} marca="raya" rolCuerpo="texto.corrido" />

            <View style={estilos.banda} wrap={false}>
              <BloqueFirmas variante="simple" firmas={[firmaMedico]} />
            </View>
          </View>
        ) : null}
      </MotorFlujo>

      {/*
        `sinFolio`: el folio de este formato no lo cita ninguna ventanilla —Admisión
        trabaja con el número de expediente del hospital—. La banda compone paginación,
        nombre del documento y leyenda, que es lo que cierra el defecto §9.5.
      */}
      <PieDocumento variante="sinFolio" documento={TITULO} acento={acento} />
    </Page>
  )
}
