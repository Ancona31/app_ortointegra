import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

export interface SolicitudInternamientoData {
  paciente: string
  fecha: string
  fechaIngreso?: string
  lugar?: string
  diagnostico: string
  diagnosticosSecundarios?: string[]
  tipoInternamiento?: string
  procedimiento?: string
  diasEstimados?: string
  asa?: string
  urgente?: boolean
  requerimientos?: string[]
  justificacion?: string
  instruccionesPaciente?: string
  indicacionesPiso?: string
  folio?: string
}

export interface SolicitudInternamientoProps {
  medico: PdfMedicoData | null
  data: SolicitudInternamientoData
  logoUrl?: string
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderSolicitudInternamiento(props: SolicitudInternamientoProps) {
  return <SolicitudInternamientoPdf {...props} />
}

function buildStyles(colors: PdfColors) {
  return StyleSheet.create({
    tituloWrap: {
      backgroundColor: colors.cp + '0D',
      borderRadius: 4,
      paddingVertical: 8,
      marginTop: 18,
      marginBottom: 18,
    },
    tituloText: {
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: colors.cp,
      letterSpacing: 1,
    },
    urgenteBadge: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 12,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: 'center',
      marginTop: 6,
    },
    urgenteBadgeText: {
      fontSize: 9,
      fontWeight: 700,
      color: '#ffffff',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    pacienteBox: {
      backgroundColor: colors.cp + '08',
      borderLeftWidth: 4,
      borderLeftColor: colors.cp,
      borderRadius: 4,
      padding: 14,
      marginBottom: 16,
    },
    pacienteHighlight: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors.cp,
      borderBottomWidth: 0.75,
      borderBottomColor: '#d1d5db',
      paddingBottom: 4,
      lineHeight: 1.4,
    },
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftColor: colors.cp,
      borderRadius: 3,
    },
    seccionTitle: {
      color: colors.cp,
      fontSize: 11,
      fontWeight: 700,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 3,
      paddingLeft: 6,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.cs,
      marginTop: 4,
    },
    bulletText: {
      fontSize: 10,
      color: '#333',
      flex: 1,
      lineHeight: 1.5,
    },
    diagPrincipal: {
      fontSize: 10.5,
      fontWeight: 700,
      color: '#1a1a1a',
      marginBottom: 6,
      paddingLeft: 6,
    },
    procedimientoText: {
      fontSize: 10.5,
      color: '#333',
      lineHeight: 1.6,
      paddingLeft: 6,
    },
    badgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
      paddingLeft: 6,
    },
    badge: {
      backgroundColor: colors.cp + '0D',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 9,
      color: colors.cp,
      fontWeight: 500,
    },
    justificacionText: {
      fontSize: 10,
      color: '#333',
      lineHeight: 1.6,
      textAlign: 'justify',
      paddingLeft: 6,
      marginTop: 4,
    },
    instruccionesBox: {
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 4,
      padding: 12,
      marginTop: 16,
    },
    instruccionesHeader: {
      fontSize: 10,
      fontWeight: 700,
      color: '#b45309',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    instruccionesContent: {
      fontSize: 9.5,
      color: '#78350f',
      lineHeight: 1.6,
    },
    indicacionesBox: {
      backgroundColor: colors.cp + '08',
      borderWidth: 1,
      borderColor: colors.cp + '30',
      borderRadius: 4,
      padding: 12,
      marginTop: 12,
    },
    indicacionesHeader: {
      fontSize: 10,
      fontWeight: 700,
      color: colors.cp,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    indicacionesContent: {
      fontSize: 9.5,
      color: '#1a1a1a',
      lineHeight: 1.6,
    },
  })
}

export default function SolicitudInternamientoPdf({ medico, data, logoUrl }: SolicitudInternamientoProps) {
  const colors = getPdfColors(medico)
  const s = buildStyles(colors)

  return (
    <Document>
      <Page size="LETTER" style={baseStyles.page}>
        <BarraTop colors={colors} />
        <View style={baseStyles.contenido}>
          <PdfWatermark logoUrl={logoUrl} />
          <PdfHeader
            medico={medico}
            colors={colors}
            logoUrl={logoUrl}
            folio={data.folio}
            fecha={data.fecha}
          />

          {/* Titulo */}
          <View style={s.tituloWrap}>
            <Text style={s.tituloText}>Solicitud de Internamiento Hospitalario</Text>
            {data.urgente ? (
              <View style={s.urgenteBadge}>
                <Text style={s.urgenteBadgeText}>URGENTE</Text>
              </View>
            ) : null}
          </View>

          {/* Datos del paciente */}
          <View style={s.pacienteBox}>
            <View style={baseStyles.datoRow}>
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>FECHA</Text>
                <Text style={baseStyles.datoValor}>{data.fecha}</Text>
              </View>
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>PACIENTE</Text>
                <Text style={s.pacienteHighlight}>{data.paciente}</Text>
              </View>
            </View>
            <View style={baseStyles.datoRow}>
              {data.fechaIngreso ? (
                <View style={baseStyles.datoField}>
                  <Text style={baseStyles.datoLabel}>FECHA DE INGRESO</Text>
                  <Text style={baseStyles.datoValor}>{data.fechaIngreso}</Text>
                </View>
              ) : null}
              {data.lugar ? (
                <View style={baseStyles.datoField}>
                  <Text style={baseStyles.datoLabel}>LUGAR / HOSPITAL</Text>
                  <Text style={s.pacienteHighlight}>{data.lugar}</Text>
                </View>
              ) : null}
            </View>
            <View style={baseStyles.datoRow}>
              {data.tipoInternamiento ? (
                <View style={baseStyles.datoField}>
                  <Text style={baseStyles.datoLabel}>TIPO DE INTERNAMIENTO</Text>
                  <Text style={baseStyles.datoValor}>{data.tipoInternamiento}</Text>
                </View>
              ) : null}
              {data.diasEstimados ? (
                <View style={baseStyles.datoField}>
                  <Text style={baseStyles.datoLabel}>D{'\u00cd'}AS ESTIMADOS</Text>
                  <Text style={baseStyles.datoValor}>{data.diasEstimados}</Text>
                </View>
              ) : null}
              {data.asa ? (
                <View style={baseStyles.datoField}>
                  <Text style={baseStyles.datoLabel}>ASA</Text>
                  <Text style={baseStyles.datoValor}>{data.asa}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Diagnósticos */}
          <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
            <Text style={s.seccionTitle}>Diagn{'\u00f3'}sticos</Text>
          </View>
          <Text style={s.diagPrincipal}>{data.diagnostico}</Text>
          {data.diagnosticosSecundarios?.map((dx, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.bulletText}>{dx}</Text>
            </View>
          ))}

          {/* Procedimiento */}
          {data.procedimiento ? (
            <>
              <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
                <Text style={s.seccionTitle}>Procedimiento / Cirug{'\u00ed'}a</Text>
              </View>
              <Text style={s.procedimientoText}>{data.procedimiento}</Text>
            </>
          ) : null}

          {/* Requerimientos especiales */}
          {data.requerimientos && data.requerimientos.length > 0 ? (
            <>
              <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
                <Text style={s.seccionTitle}>Requerimientos especiales</Text>
              </View>
              <View style={s.badgesWrap}>
                {data.requerimientos.map((req, i) => (
                  <View key={i} style={s.badge}>
                    <Text style={s.badgeText}>{req}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Justificación clínica */}
          {data.justificacion ? (
            <>
              <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
                <Text style={s.seccionTitle}>Justificaci{'\u00f3'}n cl{'\u00ed'}nica</Text>
              </View>
              <Text style={s.justificacionText}>{data.justificacion}</Text>
            </>
          ) : null}

          {/* Instrucciones para el paciente */}
          {data.instruccionesPaciente ? (
            <View style={s.instruccionesBox}>
              <Text style={s.instruccionesHeader}>Instrucciones para el paciente</Text>
              <Text style={s.instruccionesContent}>{data.instruccionesPaciente}</Text>
            </View>
          ) : null}

          {/* Indicaciones de piso */}
          {data.indicacionesPiso ? (
            <View style={s.indicacionesBox}>
              <Text style={s.indicacionesHeader}>Indicaciones de piso</Text>
              <Text style={s.indicacionesContent}>{data.indicacionesPiso}</Text>
            </View>
          ) : null}

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
        </View>

        {/* Numeración de página */}
        <Text
          style={baseStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `P\u00e1gina ${pageNumber} de ${totalPages}`}
          fixed
        />

        <BarraBottom colors={colors} medico={medico} />
      </Page>
    </Document>
  )
}
