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
    /* --- Titulo documento --- */
    tituloDoc: {
      ...baseStyles.tituloDoc,
      backgroundColor: colors.cp,
    },
    urgenteBadge: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 3,
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 4,
    },
    urgenteBadgeText: {
      fontSize: 10,
      fontWeight: 700,
      color: '#ffffff',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      textAlign: 'center',
    },

    /* --- Grid de datos del paciente --- */
    lugarValor: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors.cp,
      lineHeight: 1.4,
    },

    /* --- Secciones --- */
    seccion: {
      ...baseStyles.seccion,
      backgroundColor: colors.cp + '0A',
      borderLeftColor: colors.cp,
    },
    seccionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: colors.cp,
    },

    /* --- Diagnosticos --- */
    diagPrincipal: {
      fontSize: 10.5,
      fontWeight: 700,
      color: '#1a1a1a',
      marginBottom: 6,
      paddingLeft: 6,
      lineHeight: 1.5,
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

    /* --- Procedimiento / Justificacion --- */
    justifiedText: {
      fontSize: 10.5,
      color: '#333',
      lineHeight: 1.6,
      textAlign: 'justify',
      paddingLeft: 6,
      marginTop: 4,
    },

    /* --- Badges requerimientos --- */
    badgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
      paddingLeft: 6,
    },
    badge: {
      backgroundColor: colors.cp + '10',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.cp + '30',
    },
    badgeText: {
      fontSize: 9,
      color: colors.cp,
      fontWeight: 500,
    },

    /* --- Instrucciones paciente --- */
    instruccionesBox: {
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 4,
      padding: 10,
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

    /* --- Indicaciones de piso --- */
    indicacionesBox: {
      backgroundColor: colors.cp + '06',
      borderWidth: 1,
      borderColor: colors.cp + '30',
      borderRadius: 4,
      padding: 10,
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

    /* --- Firmas (doble) --- */
    firmasRow: {
      marginTop: 'auto',
      paddingTop: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 30,
    },
    firmaPaciente: {
      flex: 1,
      alignItems: 'center',
    },
    firmaLineaDashed: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: '#999',
      borderTopStyle: 'dashed',
      paddingTop: 8,
    },
    firmaLabel: {
      fontSize: 8,
      color: '#888',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1,
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
          <Text style={s.tituloDoc}>
            Solicitud de Internamiento Hospitalario
          </Text>

          {/* Badge urgente */}
          {data.urgente ? (
            <View style={s.urgenteBadge}>
              <Text style={s.urgenteBadgeText}>URGENTE</Text>
            </View>
          ) : null}

          {/* Row 1: FECHA + PACIENTE + FECHA DE INGRESO */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
            <View style={[baseStyles.datoField, { flex: 2 }]}>
              <Text style={baseStyles.datoLabel}>PACIENTE</Text>
              <Text style={baseStyles.datoValor}>{data.paciente}</Text>
            </View>
            {data.fechaIngreso ? (
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>FECHA DE INGRESO</Text>
                <Text style={baseStyles.datoValor}>{data.fechaIngreso}</Text>
              </View>
            ) : null}
          </View>

          {/* Row 2: HOSPITAL/LUGAR (full width) */}
          {data.lugar ? (
            <View style={baseStyles.datoRow}>
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>HOSPITAL / LUGAR</Text>
                <Text style={s.lugarValor}>{data.lugar}</Text>
              </View>
            </View>
          ) : null}

          {/* Row 3: TIPO + DIAS ESTIMADOS + ASA */}
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

          {/* Diagnosticos */}
          <View style={s.seccion}>
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
              <View style={s.seccion}>
                <Text style={s.seccionTitle}>Procedimiento / Cirug{'\u00ed'}a</Text>
              </View>
              <Text style={s.justifiedText}>{data.procedimiento}</Text>
            </>
          ) : null}

          {/* Requerimientos especiales */}
          {data.requerimientos && data.requerimientos.length > 0 ? (
            <>
              <View style={s.seccion}>
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

          {/* Justificacion clinica */}
          {data.justificacion ? (
            <>
              <View style={s.seccion}>
                <Text style={s.seccionTitle}>Justificaci{'\u00f3'}n cl{'\u00ed'}nica</Text>
              </View>
              <Text style={s.justifiedText}>{data.justificacion}</Text>
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

          {/* Doble firma: paciente/familiar + medico */}
          <View style={s.firmasRow}>
            <View style={s.firmaPaciente}>
              <View style={s.firmaLineaDashed}>
                <Text style={s.firmaLabel}>Firma del Paciente o Familiar</Text>
              </View>
            </View>
            <PdfFirma medico={medico} colors={colors} />
          </View>
        </View>

        {/* Numeracion de pagina */}
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
