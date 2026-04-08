import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

export interface SolicitudLabData {
  paciente: string
  fecha: string
  diagnostico: string
  estudios: string[]
  notas?: string
  folio?: string
}

export interface SolicitudLabProps {
  medico: PdfMedicoData | null
  data: SolicitudLabData
  logoUrl?: string
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderSolicitudLab(props: SolicitudLabProps) {
  return <SolicitudLabPdf {...props} />
}

export default function SolicitudLabPdf({ medico, data, logoUrl }: SolicitudLabProps) {
  const colors = getPdfColors(medico)

  const s = StyleSheet.create({
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.cp,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    tableHeaderNum: {
      width: 30,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableHeaderText: {
      flex: 1,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    tableRowAlt: {
      backgroundColor: '#f8f9fa',
    },
    bulletCol: {
      width: 30,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.cs,
    },
    studyName: {
      flex: 1,
      fontSize: 10.5,
      color: '#1a1a1a',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    notasBox: {
      borderWidth: 0.75,
      borderColor: '#e5e7eb',
      borderRadius: 3,
      padding: 8,
    },
    notasText: {
      fontSize: 10,
      color: '#333',
      lineHeight: 1.6,
    },
  })

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
          <Text style={[baseStyles.tituloDoc, { backgroundColor: colors.cp }]}>
            Solicitud de Estudios de Laboratorio
          </Text>

          {/* Datos del paciente */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
          </View>
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>PACIENTE</Text>
              <Text style={baseStyles.datoValor}>{data.paciente}</Text>
            </View>
            <View style={baseStyles.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>DIAGN{'\u00D3'}STICO</Text>
              <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Estudios */}
          <View style={[baseStyles.seccion, { backgroundColor: colors.cp + '08', borderLeftColor: colors.cp }]}>
            <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Se solicita:</Text>
          </View>

          {/* Tabla de estudios */}
          <View>
            <View style={s.tableHeader}>
              <Text style={s.tableHeaderNum}>#</Text>
              <Text style={s.tableHeaderText}>Estudio solicitado</Text>
            </View>
            {data.estudios.map((estudio, i) => (
              <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
                <View style={s.bulletCol}>
                  <View style={s.bullet} />
                </View>
                <Text style={s.studyName}>{estudio}</Text>
              </View>
            ))}
          </View>

          {/* Notas */}
          {data.notas ? (
            <>
              <View style={[baseStyles.seccion, { backgroundColor: colors.cp + '08', borderLeftColor: colors.cp }]}>
                <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Indicaciones</Text>
              </View>
              <View style={s.notasBox}>
                <Text style={s.notasText}>{data.notas}</Text>
              </View>
            </>
          ) : null}

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
        </View>

        {/* Numeraci{'\u00F3'}n de p{'\u00E1'}gina */}
        <Text
          style={baseStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `P\u00E1gina ${pageNumber} de ${totalPages}`}
          fixed
        />

        <BarraBottom colors={colors} medico={medico} />
      </Page>
    </Document>
  )
}
