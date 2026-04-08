import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

export interface RecetaData {
  paciente: string
  fecha: string
  diagnostico?: string
  edad?: string
  sexo?: string
  folio: string
  medicamentos: Array<{
    nombre_comercial: string
    presentacion?: string
    principio_activo?: string
    via_administracion?: string
    indicacion?: string
  }>
  recomendaciones?: string
  qrDataUrl?: string
  blogQrDataUrl?: string
}

export interface RecetaPdfProps {
  medico: PdfMedicoData | null
  data: RecetaData
  logoUrl?: string
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderReceta(props: RecetaPdfProps) {
  return <RecetaPdf {...props} />
}

/** Parsea las recomendaciones en fragmentos con estilo */
function parseRecomendaciones(text: string, cpColor: string, csColor: string) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  return lines.map((line, i) => {
    const trimmed = line.trim()

    // Lines starting with alarm emoji — bold red
    if (trimmed.startsWith('\u{1F6A8}')) {
      return (
        <Text key={i} style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', lineHeight: 1.6, marginBottom: 2 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines starting with any emoji — bold header in cp color
    // Detect common emoji ranges without unicode property escapes (ES2017 compat)
    const emojiHeaderMatch = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}][\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]*)\s*(.+)/u.exec(trimmed)
    if (emojiHeaderMatch) {
      return (
        <Text key={i} style={{ fontSize: 10.5, fontWeight: 700, color: cpColor, lineHeight: 1.6, marginTop: 6, marginBottom: 2 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines starting with bullet (-, *, •) — italic indented
    if (/^[-*\u2022]\s/.test(trimmed)) {
      return (
        <Text key={i} style={{ fontSize: 9.5, color: '#555', paddingLeft: 14, lineHeight: 1.6, marginBottom: 1 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines with "Keyword:" pattern — keyword bold in cs, rest normal
    const keywordMatch = /^([A-Za-zÀ-ÿ\s]+):\s*(.*)/.exec(trimmed)
    if (keywordMatch) {
      return (
        <Text key={i} style={{ fontSize: 10, lineHeight: 1.6, marginBottom: 1 }}>
          <Text style={{ fontWeight: 700, color: csColor }}>{keywordMatch[1]}:</Text>
          {' '}{keywordMatch[2]}
        </Text>
      )
    }

    // Default text
    return (
      <Text key={i} style={{ fontSize: 10, color: '#333', lineHeight: 1.6, marginBottom: 1 }}>
        {trimmed}
      </Text>
    )
  })
}

export default function RecetaPdf({ medico, data, logoUrl }: RecetaPdfProps) {
  const colors = getPdfColors(medico)

  const s = StyleSheet.create({
    rxText: {
      position: 'absolute',
      top: 90,
      right: 50,
      fontSize: 40,
      fontWeight: 700,
      color: colors.cs,
      opacity: 0.85,
    },
    patientBox: {
      backgroundColor: colors.cp + '08',
      borderLeftWidth: 3,
      borderLeftColor: colors.cs,
      borderRadius: 4,
      padding: 12,
      marginTop: 8,
      marginBottom: 8,
    },
    tblHeader: {
      flexDirection: 'row',
      backgroundColor: colors.cp,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    tblHeaderText: {
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tblRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: '#e5e7eb',
    },
    tblRowAlt: {
      backgroundColor: '#f9fafb',
    },
    colNum: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colMed: {
      flex: 3,
      paddingRight: 6,
    },
    colVia: {
      flex: 1,
      paddingRight: 6,
    },
    colInd: {
      flex: 2,
    },
    numText: {
      fontSize: 11,
      fontWeight: 700,
      color: colors.cs,
    },
    medNombre: {
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
    },
    medPresentacion: {
      fontSize: 9,
      color: '#555',
    },
    medPrincipio: {
      fontSize: 8.5,
      color: '#888',
      marginTop: 1,
    },
    viaText: {
      fontSize: 9.5,
      color: colors.cs,
      fontWeight: 500,
    },
    indText: {
      fontSize: 9.5,
      color: '#333',
      lineHeight: 1.4,
    },
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftColor: colors.cp,
      borderRadius: 3,
    },
    recomendacionesBody: {
      marginTop: 4,
      paddingLeft: 6,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 28,
    },
    qrWrap: {
      alignItems: 'center',
      gap: 4,
    },
    qrImage: {
      width: 72,
      height: 72,
    },
    qrLabel: {
      fontSize: 6.5,
      color: '#999',
      textAlign: 'center',
      maxWidth: 80,
    },
    firmaWrap: {
      flex: 1,
      alignItems: 'flex-end',
    },
    blogQrWrap: {
      alignItems: 'center',
      gap: 4,
      marginLeft: 16,
    },
    blogQrImage: {
      width: 56,
      height: 56,
    },
    blogQrLabel: {
      fontSize: 6,
      color: '#aaa',
      textAlign: 'center',
      maxWidth: 70,
    },
  })

  const hasQr = Boolean(data.qrDataUrl)
  const hasBlogQr = Boolean(data.blogQrDataUrl)

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

          {/* Rx decorativo */}
          <Text style={s.rxText}>Rx</Text>

          {/* Datos del paciente */}
          <View style={s.patientBox}>
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
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>EDAD</Text>
                <Text style={baseStyles.datoValor}>{data.edad || '—'}</Text>
              </View>
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>SEXO</Text>
                <Text style={baseStyles.datoValor}>{data.sexo || '—'}</Text>
              </View>
            </View>
            <View style={{ ...baseStyles.datoField, marginBottom: 0 }}>
              <Text style={baseStyles.datoLabel}>{`DIAGN\u00D3STICO`}</Text>
              <Text style={baseStyles.datoValor}>{data.diagnostico || '—'}</Text>
            </View>
          </View>

          {/* Seccion Medicamentos */}
          <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cs }]}>
            <Text style={{ color: colors.cs, fontSize: 11, fontWeight: 700 }}>Medicamentos</Text>
          </View>

          {/* Tabla de medicamentos */}
          <View>
            {/* Header */}
            <View style={s.tblHeader}>
              <View style={s.colNum}>
                <Text style={s.tblHeaderText}>#</Text>
              </View>
              <View style={s.colMed}>
                <Text style={s.tblHeaderText}>Medicamento</Text>
              </View>
              <View style={s.colVia}>
                <Text style={s.tblHeaderText}>{`V\u00EDa`}</Text>
              </View>
              <View style={s.colInd}>
                <Text style={s.tblHeaderText}>Indicaciones</Text>
              </View>
            </View>

            {/* Rows */}
            {data.medicamentos.map((med, idx) => (
              <View
                key={idx}
                style={[s.tblRow, idx % 2 === 1 ? s.tblRowAlt : {}]}
                wrap={false}
              >
                <View style={s.colNum}>
                  <Text style={s.numText}>{idx + 1}</Text>
                </View>
                <View style={s.colMed}>
                  <Text style={s.medNombre}>
                    {med.nombre_comercial}
                    {med.presentacion ? (
                      <Text style={s.medPresentacion}>{`  ${med.presentacion}`}</Text>
                    ) : null}
                  </Text>
                  {med.principio_activo ? (
                    <Text style={s.medPrincipio}>{med.principio_activo}</Text>
                  ) : null}
                </View>
                <View style={s.colVia}>
                  <Text style={s.viaText}>{med.via_administracion || '—'}</Text>
                </View>
                <View style={s.colInd}>
                  <Text style={s.indText}>{med.indicacion || '—'}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recomendaciones */}
          {data.recomendaciones ? (
            <>
              <View style={[baseStyles.seccion, s.seccionWrap, { borderLeftColor: colors.cp }]}>
                <Text style={{ color: colors.cp, fontSize: 11, fontWeight: 700 }}>Recomendaciones</Text>
              </View>
              <View style={s.recomendacionesBody}>
                {parseRecomendaciones(data.recomendaciones, colors.cp, colors.cs)}
              </View>
            </>
          ) : null}

          {/* Footer: QR + Firma */}
          {hasQr || hasBlogQr ? (
            <View style={s.footerRow}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {data.qrDataUrl ? (
                  <View style={s.qrWrap}>
                    <Image style={s.qrImage} src={data.qrDataUrl} />
                    <Text style={s.qrLabel}>Escanea para verificar receta</Text>
                  </View>
                ) : null}
                {data.blogQrDataUrl ? (
                  <View style={s.blogQrWrap}>
                    <Image style={s.blogQrImage} src={data.blogQrDataUrl} />
                    <Text style={s.blogQrLabel}>Blog del especialista</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.firmaWrap}>
                <PdfFirma medico={medico} colors={colors} />
              </View>
            </View>
          ) : (
            <PdfFirma medico={medico} colors={colors} />
          )}
        </View>

        {/* Numeracion de pagina */}
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
