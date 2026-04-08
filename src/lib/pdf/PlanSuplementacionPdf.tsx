import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

export interface PlanSuplementacionData {
  paciente: string
  fecha: string
  diagnostico?: string
  peso?: string
  suplementos: Array<{
    nombre: string
    dosis: string
    presentacion: string
    beneficio_clinico: string
    beneficio_paciente: string
    justificacion?: string
  }>
  notas?: string
  citaControl?: string
  folio?: string
  blogQrDataUrl?: string
}

export interface PlanSuplementacionProps {
  medico: PdfMedicoData | null
  data: PlanSuplementacionData
  logoUrl?: string
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderPlanSuplementacion(props: PlanSuplementacionProps) {
  return <PlanSuplementacionPdf {...props} />
}

export default function PlanSuplementacionPdf({
  medico,
  data,
  logoUrl,
}: PlanSuplementacionProps) {
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
    /* Sección heading */
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftWidth: 3,
      borderLeftColor: colors.cp,
      borderRadius: 3,
      paddingVertical: 6,
      paddingLeft: 10,
      marginTop: 20,
      marginBottom: 12,
    },
    seccionText: {
      color: colors.cp,
      fontSize: 11,
      fontWeight: 700,
    },
    /* Suplemento card */
    card: {
      borderLeftWidth: 2.5,
      borderLeftColor: colors.cs,
      backgroundColor: '#f9fafb',
      borderRadius: 3,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    cardNombre: {
      fontSize: 11,
      fontWeight: 700,
      color: colors.cp,
    },
    cardDosis: {
      fontSize: 9,
      color: colors.cs,
      fontWeight: 500,
    },
    cardPresentacion: {
      fontSize: 9,
      color: '#666',
      marginBottom: 4,
    },
    beneficioRow: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 2,
    },
    beneficioLabel: {
      fontSize: 8.5,
      fontWeight: 700,
      color: '#555',
    },
    beneficioText: {
      fontSize: 8.5,
      color: '#333',
      flex: 1,
      lineHeight: 1.5,
    },
    justificacion: {
      fontSize: 8,
      color: '#999',
      fontStyle: 'italic',
      marginTop: 3,
      lineHeight: 1.4,
    },
    cardNum: {
      fontSize: 8,
      color: '#aaa',
      fontWeight: 700,
      marginRight: 6,
    },
    /* Notas */
    notasText: {
      fontSize: 10,
      color: '#333',
      marginTop: 4,
      lineHeight: 1.6,
    },
    /* Cita control */
    citaWrap: {
      backgroundColor: colors.cs + '12',
      borderRadius: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginTop: 14,
      alignSelf: 'flex-start',
    },
    citaLabel: {
      fontSize: 7.5,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    citaText: {
      fontSize: 10,
      color: colors.cp,
      fontWeight: 500,
    },
    /* QR */
    qrRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 20,
    },
    qrWrap: {
      alignItems: 'center',
    },
    qrImage: {
      width: 64,
      height: 64,
    },
    qrCaption: {
      fontSize: 6,
      color: '#aaa',
      marginTop: 3,
      textAlign: 'center',
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
            <Text style={s.tituloText}>Plan de Suplementación</Text>
          </View>

          {/* Datos del paciente */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>PACIENTE</Text>
              <Text style={baseStyles.datoValor}>{data.paciente}</Text>
            </View>
          </View>
          <View style={baseStyles.datoRow}>
            {data.peso ? (
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>PESO</Text>
                <Text style={baseStyles.datoValor}>{data.peso}</Text>
              </View>
            ) : null}
            {data.diagnostico ? (
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>DIAGNÓSTICO</Text>
                <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
              </View>
            ) : null}
          </View>

          {/* Sección suplementos */}
          <View style={s.seccionWrap}>
            <Text style={s.seccionText}>Suplementos recomendados</Text>
          </View>

          {data.suplementos.map((sup, i) => (
            <View key={i} style={s.card} wrap={false}>
              <View style={s.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.cardNum}>{i + 1}.</Text>
                  <Text style={s.cardNombre}>{sup.nombre}</Text>
                </View>
                <Text style={s.cardDosis}>{sup.dosis}</Text>
              </View>
              <Text style={s.cardPresentacion}>{sup.presentacion}</Text>
              <View style={s.beneficioRow}>
                <Text style={s.beneficioLabel}>Beneficio clínico:</Text>
                <Text style={s.beneficioText}>{sup.beneficio_clinico}</Text>
              </View>
              <View style={s.beneficioRow}>
                <Text style={s.beneficioLabel}>Para el paciente:</Text>
                <Text style={s.beneficioText}>{sup.beneficio_paciente}</Text>
              </View>
              {sup.justificacion ? (
                <Text style={s.justificacion}>{sup.justificacion}</Text>
              ) : null}
            </View>
          ))}

          {/* Notas */}
          {data.notas ? (
            <>
              <View style={s.seccionWrap}>
                <Text style={s.seccionText}>Notas</Text>
              </View>
              <Text style={s.notasText}>{data.notas}</Text>
            </>
          ) : null}

          {/* Cita de control */}
          {data.citaControl ? (
            <View style={s.citaWrap}>
              <Text style={s.citaLabel}>CITA DE CONTROL</Text>
              <Text style={s.citaText}>{data.citaControl}</Text>
            </View>
          ) : null}

          {/* QR + Firma */}
          <View style={s.qrRow}>
            {data.blogQrDataUrl ? (
              <View style={s.qrWrap}>
                <Image style={s.qrImage} src={data.blogQrDataUrl} />
                <Text style={s.qrCaption}>Más información</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={{ minWidth: 240 }}>
              <PdfFirma medico={medico} colors={colors} />
            </View>
          </View>
        </View>

        {/* Numeración de página */}
        <Text
          style={baseStyles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />

        <BarraBottom colors={colors} medico={medico} />
      </Page>
    </Document>
  )
}
