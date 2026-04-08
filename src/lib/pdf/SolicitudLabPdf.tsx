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
    checkItem: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 4,
      paddingLeft: 4,
    },
    checkMark: {
      fontSize: 10,
      color: colors.cs,
      fontWeight: 700,
    },
    checkText: {
      fontSize: 10.5,
      flex: 1,
    },
    estudiosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    estudiosCol: {
      width: '50%',
    },
    notasText: {
      fontSize: 10,
      color: '#333',
      marginTop: 4,
      lineHeight: 1.5,
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
          <PdfHeader medico={medico} colors={colors} logoUrl={logoUrl} />

          <Text style={[baseStyles.tituloDoc, { color: colors.cp, borderColor: colors.cp }]}>
            Solicitud de Estudios de Laboratorio
          </Text>

          <View style={baseStyles.datoRow}>
            <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>Fecha:</Text>
            <Text style={baseStyles.datoValor}>{data.fecha}</Text>
          </View>
          <View style={baseStyles.datoRow}>
            <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>Paciente:</Text>
            <Text style={baseStyles.datoValor}>{data.paciente}</Text>
          </View>
          <View style={baseStyles.datoRow}>
            <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>Diagnóstico:</Text>
            <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
          </View>

          <Text style={[baseStyles.seccion, { color: colors.cp, borderBottomColor: colors.cp }]}>
            Se solicita:
          </Text>
          <View style={s.estudiosGrid}>
            <View style={s.estudiosCol}>
              {col1.map((e, i) => (
                <View key={i} style={s.checkItem}>
                  <Text style={s.checkMark}>{'✓'}</Text>
                  <Text style={s.checkText}>{e}</Text>
                </View>
              ))}
            </View>
            <View style={s.estudiosCol}>
              {col2.map((e, i) => (
                <View key={i} style={s.checkItem}>
                  <Text style={s.checkMark}>{'✓'}</Text>
                  <Text style={s.checkText}>{e}</Text>
                </View>
              ))}
            </View>
          </View>

          {data.notas ? (
            <>
              <Text style={[baseStyles.seccion, { color: colors.cp, borderBottomColor: colors.cp }]}>
                Indicaciones
              </Text>
              <Text style={s.notasText}>{data.notas}</Text>
            </>
          ) : null}

          <PdfFirma medico={medico} colors={colors} />
        </View>
        <BarraBottom colors={colors} />
      </Page>
    </Document>
  )
}
