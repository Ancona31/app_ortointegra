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
      borderRadius: 4,
      paddingVertical: 4,
      paddingHorizontal: 14,
      alignSelf: 'center',
      marginBottom: 14,
    },
    urgenteText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftColor: colors.cp,
      borderRadius: 3,
    },
    estudioCard: {
      borderLeftWidth: 3,
      borderLeftColor: colors.cs,
      backgroundColor: colors.cs + '08',
      borderRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    estudioNombre: {
      fontSize: 10.5,
      fontWeight: 700,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    estudioIndicacion: {
      fontSize: 9,
      color: '#666',
      marginTop: 3,
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
          <View style={s.tituloWrap}>
            <Text style={s.tituloText}>Solicitud de Estudios de Imagen</Text>
          </View>

          {/* Badge urgente */}
          {data.urgente ? (
            <View style={s.urgenteBadge}>
              <Text style={s.urgenteText}>URGENTE</Text>
            </View>
          ) : null}

          {/* Datos del paciente */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
          </View>
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>PACIENTE</Text>
              <Text style={baseStyles.datoValor}>{data.paciente}</Text>
            </View>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>{'\u0044IAGN\u00D3STICO'}</Text>
              <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Estudios solicitados */}
          <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
            <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Estudios solicitados:</Text>
          </View>
          {data.estudios.map((estudio, i) => {
            const nombre = `${estudio.tipo} de ${estudio.region}${estudio.proyecciones ? ` — ${estudio.proyecciones}` : ''}`
            return (
              <View key={i} style={s.estudioCard}>
                <Text style={s.estudioNombre}>{nombre}</Text>
                {estudio.indicacion ? (
                  <Text style={s.estudioIndicacion}>{estudio.indicacion}</Text>
                ) : null}
              </View>
            )
          })}

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
        </View>

        {/* Numeración de página */}
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
