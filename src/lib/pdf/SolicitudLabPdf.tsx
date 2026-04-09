import { Document, Page, View, Text, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer'
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

/** Colores más oscuros para las barras de sección y tabla */
function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function SolicitudLabPdf({ medico, data, logoUrl }: SolicitudLabProps) {
  const colors = getPdfColors(medico)
  const darkCp = darkenHex(colors.cp, 40)
  const darkCs = darkenHex(colors.cs, 40)

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
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
    },
    tituloBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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

    /* ── Sección heading con gradiente oscuro ── */
    seccion: {
      paddingVertical: 5,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: darkCp,
      borderRadius: 3,
      marginTop: 10,
      marginBottom: 8,
      position: 'relative',
      overflow: 'hidden',
    },
    seccionBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    seccionText: {
      color: '#ffffff',
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
      position: 'relative',
      overflow: 'hidden',
    },
    tableHeaderBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    tableHeaderNum: {
      width: 24,
      fontSize: 7.5,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableHeaderText: {
      flex: 1,
      fontSize: 7.5,
      fontWeight: 700,
      color: '#ffffff',
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
      backgroundColor: '#f8f9fa',
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
        <Svg viewBox="0 0 100 20" preserveAspectRatio="none" style={s.tableHeaderBg}>
          <Defs>
            <LinearGradient id={`gTblLab${startIdx}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={darkCp} stopOpacity={1} />
              <Stop offset="1" stopColor={darkCs} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="20" fill={`url(#gTblLab${startIdx})`} />
        </Svg>
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
            <Svg viewBox="0 0 100 30" preserveAspectRatio="none" style={s.tituloBg}>
              <Defs>
                <LinearGradient id="gTitLab" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={darkCp} stopOpacity={1} />
                  <Stop offset="1" stopColor={darkCs} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="30" fill="url(#gTitLab)" />
            </Svg>
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Solicitud de Estudios de Laboratorio
            </Text>
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
              <Text style={s.datoLabel}>DIAGN{'\u00D3'}STICO</Text>
              <Text style={s.datoValor}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Sección "Se solicita" con gradiente oscuro */}
          <View style={s.seccion}>
            <Svg viewBox="0 0 100 20" preserveAspectRatio="none" style={s.seccionBg}>
              <Defs>
                <LinearGradient id="gSecLab" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={darkCp} stopOpacity={1} />
                  <Stop offset="1" stopColor={darkCs} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="20" fill="url(#gSecLab)" />
            </Svg>
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
                <Svg viewBox="0 0 100 20" preserveAspectRatio="none" style={s.seccionBg}>
                  <Defs>
                    <LinearGradient id="gSecNot" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={darkCp} stopOpacity={1} />
                      <Stop offset="1" stopColor={darkCs} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100" height="20" fill="url(#gSecNot)" />
                </Svg>
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
