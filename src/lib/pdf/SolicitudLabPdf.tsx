import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
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
  const cpText = contrastText(colors.cp)

  // Partir estudios en 2 columnas
  const mid = Math.ceil(data.estudios.length / 2)
  const col1 = data.estudios.slice(0, mid)
  const col2 = data.estudios.slice(mid)

  const s = StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 10,
      color: '#1a1a1a',
      paddingTop: 100,
      paddingBottom: 54,
      paddingHorizontal: 50,
    },
    headerFixed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    headerInner: {
      paddingHorizontal: 50,
      paddingTop: 8,
    },
    footerFixed: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    /* ── Titulo pegado a las líneas divisorias ── */
    titulo: {
      textAlign: 'center',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      marginTop: 2,
      marginBottom: 10,
      paddingVertical: 7,
      borderRadius: 4,
      letterSpacing: 1.5,
      color: cpText,
      backgroundColor: colors.cp,
    },

    /* ── Datos del paciente compactos ── */
    datoRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 1,
    },
    datoField: {
      flex: 1,
      marginBottom: 4,
      borderWidth: 0.75,
      borderColor: '#e5e7eb',
      borderRadius: 3,
      paddingHorizontal: 8,
      paddingTop: 2,
      paddingBottom: 3,
    },
    datoLabel: {
      fontSize: 7,
      fontWeight: 700,
      marginBottom: 1,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.cp,
    },
    datoValor: {
      fontSize: 10.5,
      color: '#1a1a1a',
      fontWeight: 500,
      lineHeight: 1.2,
    },

    /* ── Sección heading ── */
    seccion: {
      paddingVertical: 5,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: colors.cs,
      borderRadius: 3,
      marginTop: 10,
      marginBottom: 8,
      backgroundColor: colors.cp,
    },
    seccionText: {
      color: cpText,
      fontSize: 11,
      fontWeight: 700,
    },

    /* ── Tabla 2 columnas ── */
    tableHeader: {
      flexDirection: 'row',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: colors.cp,
    },
    tableHeaderNum: {
      width: 24,
      fontSize: 7.5,
      fontWeight: 700,
      color: cpText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableHeaderText: {
      flex: 1,
      fontSize: 7.5,
      fontWeight: 700,
      color: cpText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableColSep: {
      width: 12,
    },
    tableBody: {
      flexDirection: 'row',
    },
    tableCol: {
      flex: 1,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    tableRowAlt: {
      backgroundColor: colors.cs + '0D',
    },
    bulletCol: {
      width: 24,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    bullet: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.cs,
    },
    studyName: {
      flex: 1,
      fontSize: 9.5,
      color: '#1a1a1a',
      fontWeight: 500,
      lineHeight: 1.3,
    },

    /* ── Notas ── */
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

  const renderColumn = (estudios: string[], startIdx: number) => (
    <View style={s.tableCol}>
      {/* Header de columna */}
      <View style={s.tableHeader}>
        <Text style={s.tableHeaderNum}>#</Text>
        <Text style={s.tableHeaderText}>Estudio solicitado</Text>
      </View>
      {/* Filas */}
      {estudios.map((estudio, i) => (
        <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
          <View style={s.bulletCol}>
            <View style={s.bullet} />
          </View>
          <Text style={s.studyName}>{estudio}</Text>
        </View>
      ))}
    </View>
  )

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header fixed — se repite en cada página */}
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader
              medico={medico}
              colors={colors}
              logoUrl={logoUrl}
              folio={data.folio}
              fecha={data.fecha}
              compact
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
          {/* Titulo — pegado a las líneas divisorias */}
          <View style={s.titulo}>
            <Text>Solicitud de Estudios de Laboratorio</Text>
          </View>

          {/* Datos del paciente — compactos */}
          <View style={s.datoRow}>
            <View style={s.datoField}>
              <Text style={s.datoLabel}>FECHA</Text>
              <Text style={s.datoValor}>{data.fecha}</Text>
            </View>
          </View>
          <View style={s.datoRow}>
            <View style={s.datoField}>
              <Text style={s.datoLabel}>PACIENTE</Text>
              <Text style={s.datoValor}>{data.paciente}</Text>
            </View>
            <View style={s.datoField}>
              <Text style={s.datoLabel}>DIAGNÓSTICO</Text>
              <Text style={s.datoValor}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Sección "Se solicita" */}
          <View style={s.seccion}>
            <Text style={s.seccionText}>Se solicita:</Text>
          </View>

          {/* Tabla de estudios — 2 columnas */}
          <View style={s.tableBody}>
            {renderColumn(col1, 0)}
            <View style={s.tableColSep} />
            {renderColumn(col2, 1)}
          </View>

          {/* Notas */}
          {data.notas ? (
            <>
              <View style={s.seccion}>
                <Text style={s.seccionText}>Indicaciones</Text>
              </View>
              <View style={s.notasBox}>
                <Text style={s.notasText}>{data.notas}</Text>
              </View>
            </>
          ) : null}

        </View>

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
      </Page>
    </Document>
  )
}
