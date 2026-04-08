import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

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
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderSolicitudImagen(props: SolicitudImagenProps) {
  return <SolicitudImagenPdf {...props} />
}

export default function SolicitudImagenPdf({ medico, data, logoUrl }: SolicitudImagenProps) {
  const colors = getPdfColors(medico)

  const s = StyleSheet.create({
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
      backgroundColor: colors.cp,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    thNum: {
      width: 26,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thEstudio: {
      width: '28%',
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thRegion: {
      width: '32%',
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    thIndicacion: {
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
      fontSize: 10,
      fontWeight: 500,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    tdRegion: {
      width: '32%',
      fontSize: 10,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    tdIndicacion: {
      flex: 1,
      fontSize: 9.5,
      color: '#555',
      lineHeight: 1.4,
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
            Solicitud de Estudios de Imagen
          </Text>

          {/* Badge urgente */}
          {data.urgente ? (
            <View style={s.urgenteBadge}>
              <Text style={s.urgenteText}>URGENTE</Text>
            </View>
          ) : null}

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

          {/* Estudios solicitados */}
          <View style={[baseStyles.seccion, { backgroundColor: colors.cp + '08', borderLeftColor: colors.cp }]}>
            <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Estudios solicitados:</Text>
          </View>

          {/* Tabla de estudios */}
          <View>
            <View style={s.tableHeader}>
              <Text style={s.thNum}>#</Text>
              <Text style={s.thEstudio}>Estudio</Text>
              <Text style={s.thRegion}>{`Regi\u00F3n`}</Text>
              <Text style={s.thIndicacion}>{`Indicaci\u00F3n`}</Text>
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
                  <Text style={s.tdIndicacion}>{estudio.indicacion || '—'}</Text>
                </View>
              )
            })}
          </View>

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
