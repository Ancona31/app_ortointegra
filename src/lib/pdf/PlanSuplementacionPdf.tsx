import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
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
    /* Titulo doc */
    tituloBanner: {
      marginTop: 14,
      marginBottom: 16,
      paddingVertical: 9,
      borderRadius: 4,
      alignItems: 'center',
      backgroundColor: colors.cp,
    },
    /* Seccion heading */
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftWidth: 3,
      borderLeftColor: colors.cp,
      borderRadius: 3,
      paddingVertical: 6,
      paddingLeft: 10,
      marginTop: 18,
      marginBottom: 10,
    },
    seccionText: {
      color: colors.cp,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    /* Tabla header */
    tableHeader: {
      flexDirection: 'row',
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      paddingVertical: 7,
      paddingHorizontal: 10,
      backgroundColor: colors.cp,
    },
    thNum: {
      width: 26,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thNombre: {
      flex: 1,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thDosis: {
      width: 72,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thPresentacion: {
      width: 82,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thIndicacion: {
      width: 150,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    /* Tabla rows */
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 7,
      paddingHorizontal: 10,
      alignItems: 'flex-start',
    },
    tdNum: {
      width: 26,
      fontSize: 9,
      color: '#888',
      fontWeight: 500,
    },
    tdNombre: {
      flex: 1,
      fontSize: 10,
      fontWeight: 700,
      color: '#1a1a1a',
    },
    tdDosis: {
      width: 72,
      fontSize: 9.5,
      color: colors.cs,
      fontWeight: 500,
    },
    tdPresentacion: {
      width: 82,
      fontSize: 9.5,
      color: '#444',
    },
    tdIndicacion: {
      width: 150,
      fontSize: 9,
      color: '#333',
      lineHeight: 1.4,
    },
    justificacion: {
      fontSize: 7.5,
      color: '#999',
      paddingLeft: 26,
      paddingRight: 10,
      paddingBottom: 5,
      lineHeight: 1.4,
    },
    /* Notas */
    notasBox: {
      borderWidth: 0.75,
      borderColor: '#e5e7eb',
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 6,
    },
    notasText: {
      fontSize: 10,
      color: '#333',
      lineHeight: 1.6,
    },
    /* Cita control */
    citaBadge: {
      backgroundColor: colors.cs + '10',
      borderWidth: 0.5,
      borderColor: colors.cs + '30',
      borderRadius: 10,
      paddingVertical: 5,
      paddingHorizontal: 14,
      marginTop: 14,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    citaLabel: {
      fontSize: 7.5,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: 700,
    },
    citaText: {
      fontSize: 9.5,
      color: colors.cp,
      fontWeight: 500,
    },
    /* Footer area */
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 16,
      paddingTop: 10,
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
          {/* Titulo */}
          <View style={s.tituloBanner}>
            <Text style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: contrastText(colors.cp), letterSpacing: 1.5, textAlign: 'center' }}>
              Plan de Suplementación
            </Text>
          </View>

          {/* Datos del paciente */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data?.fecha ?? ''}</Text>
            </View>
            <View style={[baseStyles.datoField, { flex: 2 }]}>
              <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>PACIENTE</Text>
              <Text style={baseStyles.datoValor}>{data?.paciente ?? 'Pte. no identificado'}</Text>
            </View>
          </View>
          <View style={baseStyles.datoRow}>
            {data?.peso ? (
              <View style={baseStyles.datoField}>
                <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>PESO</Text>
                <Text style={baseStyles.datoValor}>{data.peso}</Text>
              </View>
            ) : null}
            {data?.diagnostico ? (
              <View style={[baseStyles.datoField, { flex: 2 }]}>
                <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>DIAGNÓSTICO</Text>
                <Text style={baseStyles.datoValor}>{data.diagnostico}</Text>
              </View>
            ) : null}
          </View>

          {/* Seccion suplementos */}
          <View style={s.seccionWrap}>
            <Text style={s.seccionText}>Suplementos recomendados</Text>
          </View>

          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={s.thNum}>#</Text>
            <Text style={s.thNombre}>Suplemento</Text>
            <Text style={s.thDosis}>Dosis</Text>
            <Text style={s.thPresentacion}>Presentación</Text>
            <Text style={s.thIndicacion}>Indicación</Text>
          </View>

          {/* Table rows */}
          {(data?.suplementos ?? []).map((sup, i) => (
            <View key={i} wrap={false}>
              <View
                style={[
                  s.tableRow,
                  { backgroundColor: i % 2 === 0 ? colors.cs + '0D' : '#ffffff' },
                ]}
              >
                <Text style={s.tdNum}>{i + 1}</Text>
                <Text style={s.tdNombre}>{sup?.nombre ?? ''}</Text>
                <Text style={s.tdDosis}>{sup?.dosis ?? ''}</Text>
                <Text style={s.tdPresentacion}>{sup?.presentacion ?? ''}</Text>
                <Text style={s.tdIndicacion}>{sup?.beneficio_paciente ?? ''}</Text>
              </View>
              {sup?.justificacion ? (
                <Text
                  style={[
                    s.justificacion,
                    { backgroundColor: i % 2 === 0 ? colors.cs + '0D' : '#ffffff' },
                  ]}
                >
                  {sup.justificacion}
                </Text>
              ) : null}
            </View>
          ))}

          {/* Notas */}
          {data?.notas ? (
            <>
              <View style={s.seccionWrap}>
                <Text style={s.seccionText}>Notas</Text>
              </View>
              <View style={s.notasBox}>
                <Text style={s.notasText}>{data.notas}</Text>
              </View>
            </>
          ) : null}

          {/* Cita de control */}
          {data?.citaControl ? (
            <View style={s.citaBadge}>
              <Text style={s.citaLabel}>Cita de control:</Text>
              <Text style={s.citaText}>{data.citaControl}</Text>
            </View>
          ) : null}

        </View>

          {/* Footer: QR izquierda + Firma derecha */}
          <View style={s.footerRow}>
            {data?.blogQrDataUrl ? (
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
      </Page>
    </Document>
  )
}
