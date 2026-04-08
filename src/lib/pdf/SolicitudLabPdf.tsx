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
    checkItem: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 5,
      paddingLeft: 6,
    },
    checkMark: {
      fontSize: 10,
      color: colors.cs,
      fontWeight: 700,
    },
    checkText: {
      fontSize: 10.5,
      flex: 1,
      lineHeight: 1.4,
    },
    estudiosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    estudiosCol: {
      width: '50%',
    },
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftColor: colors.cp,
      borderRadius: 3,
    },
    notasText: {
      fontSize: 10,
      color: '#333',
      marginTop: 4,
      lineHeight: 1.6,
    },
  })

  const mitad = Math.ceil(data.estudios.length / 2)
  const col1 = data.estudios.slice(0, mitad)
  const col2 = data.estudios.slice(mitad)

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
            <Text style={s.tituloText}>Solicitud de Estudios de Laboratorio</Text>
          </View>

          {/* Datos del paciente — formato formulario médico */}
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
              <Text style={baseStyles.datoLabel}>DIAGN&#xD3;STICO</Text>
              <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
            </View>
          </View>

          {/* Estudios */}
          <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
            <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Se solicita:</Text>
          </View>
          <View style={s.estudiosGrid}>
            <View style={s.estudiosCol}>
              {col1.map((e, i) => (
                <View key={i} style={s.checkItem}>
                  <Text style={s.checkMark}>{'\u2713'}</Text>
                  <Text style={s.checkText}>{e}</Text>
                </View>
              ))}
            </View>
            <View style={s.estudiosCol}>
              {col2.map((e, i) => (
                <View key={i} style={s.checkItem}>
                  <Text style={s.checkMark}>{'\u2713'}</Text>
                  <Text style={s.checkText}>{e}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Notas */}
          {data.notas ? (
            <>
              <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
                <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Indicaciones</Text>
              </View>
              <Text style={s.notasText}>{data.notas}</Text>
            </>
          ) : null}

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
