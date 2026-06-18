import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData, PdfConsultorioData } from './PdfStyles'

export interface SolicitudImagenData {
  paciente: string
  fecha: string // already formatted
  diagnostico: string
  estudios: Array<{ tipo: string; region: string; proyecciones?: string; indicacion?: string }>
  urgente?: boolean
  folio?: string
}

export interface SolicitudImagenProps {
  medico: PdfMedicoData | null
  data: SolicitudImagenData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderSolicitudImagen(props: SolicitudImagenProps) {
  return <SolicitudImagenPdf {...props} />
}

export default function SolicitudImagenPdf({ medico, data, logoUrl, consultorio }: SolicitudImagenProps) {
  const colors = getPdfColors(medico)

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
    urgenteBadge: {
      backgroundColor: '#dc2626',
      borderRadius: 3,
      paddingVertical: 5,
      paddingHorizontal: 20,
      alignSelf: 'center',
      marginBottom: 10,
    },
    urgenteText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    tableHeader: {
      flexDirection: 'row',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.cp,
    },
    thNum: {
      width: 26,
      fontSize: 8,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thEstudio: {
      width: '28%',
      paddingRight: 8,
      fontSize: 8,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thRegion: {
      width: '32%',
      paddingRight: 8,
      fontSize: 8,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thComplemento: {
      flex: 1,
    },
    thComplementoTitle: {
      fontSize: 8,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thComplementoSub: {
      fontSize: 5.5,
      color: '#ffffffcc',
      marginTop: 1,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    tableRowAlt: {
      backgroundColor: colors.cs + '0D',
    },
    tdNum: {
      width: 26,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.cs,
    },
    tdEstudio: {
      width: '28%',
      paddingRight: 8,
      fontSize: 10,
      fontWeight: 500,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    tdRegion: {
      width: '32%',
      paddingRight: 8,
      fontSize: 10,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    tdComplemento: {
      flex: 1,
      fontSize: 9.5,
      color: '#555',
      lineHeight: 1.4,
    },
  })

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
              consultorio={consultorio}
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
          {/* Titulo */}
          <View style={{ marginTop: 14, marginBottom: 16, paddingVertical: 9, borderRadius: 4, alignItems: 'center', backgroundColor: colors.cp }}>
            <Text style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: contrastText(colors.cp), letterSpacing: 1.5, textAlign: 'center' }}>
              Solicitud de Estudios de Imagen
            </Text>
          </View>

          {/* Badge urgente */}
          {data.urgente ? (
            <View style={s.urgenteBadge}>
              <Text style={s.urgenteText}>URGENTE</Text>
            </View>
          ) : null}

          {/* Datos del paciente — compactos */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0.5 }}>
            <View style={{ flex: 1, borderWidth: 0.75, borderColor: '#e5e7eb', borderRadius: 3, paddingHorizontal: 8, paddingTop: 0.5, paddingBottom: 1, marginBottom: 0.5 }}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp, marginBottom: 0, lineHeight: 1 }]}>FECHA</Text>
              <Text style={[baseStyles.datoValor, { lineHeight: 1.1 }]}>{data.fecha}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0.5 }}>
            <View style={{ flex: 1, borderWidth: 0.75, borderColor: '#e5e7eb', borderRadius: 3, paddingHorizontal: 8, paddingTop: 0.5, paddingBottom: 1, marginBottom: 0.5 }}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp, marginBottom: 0, lineHeight: 1 }]}>PACIENTE</Text>
              <Text style={[baseStyles.datoValor, { lineHeight: 1.1 }]}>{data.paciente}</Text>
            </View>
            <View style={{ flex: 1, borderWidth: 0.75, borderColor: '#e5e7eb', borderRadius: 3, paddingHorizontal: 8, paddingTop: 0.5, paddingBottom: 1, marginBottom: 0.5 }}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp, marginBottom: 0, lineHeight: 1 }]}>DIAGNÓSTICO</Text>
              <Text style={[baseStyles.datoValor, { lineHeight: 1.1 }]}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Estudios solicitados */}
          <View style={[baseStyles.seccion, { backgroundColor: colors.cp + '08', borderLeftColor: colors.cp }]}>
            <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Estudios solicitados:</Text>
          </View>

          {/* Tabla de estudios */}
          <View>
            <View style={s.tableHeader}>
              <Text style={s.thNum}>#</Text>
              <Text style={s.thEstudio}>Estudio</Text>
              <Text style={s.thRegion}>Región</Text>
              <Text style={s.thComplementoTitle}>Complemento</Text>
            </View>
            {data.estudios.map((estudio, i) => {
              const regionText = estudio.region + (estudio.proyecciones ? ` — ${estudio.proyecciones}` : '')
              return (
                <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
                  <View style={s.tdNum}>
                    <View style={s.bullet} />
                  </View>
                  <Text style={s.tdEstudio}>{estudio.tipo}</Text>
                  <Text style={s.tdRegion}>{regionText}</Text>
                  <Text style={s.tdComplemento}>{estudio.indicacion || '—'}</Text>
                </View>
              )
            })}
          </View>

        </View>

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
      </Page>
    </Document>
  )
}
