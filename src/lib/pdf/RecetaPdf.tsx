import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

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

/** Parsea las recomendaciones en fragmentos con estilo (compacto 7.5pt) */
function parseRecomendaciones(text: string, cpColor: string, csColor: string) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  return lines.map((line, i) => {
    const trimmed = line.trim()

    // Lines starting with alarm emoji — bold red
    if (trimmed.startsWith('\u{1F6A8}')) {
      return (
        <Text key={i} style={{ fontSize: 7.5, fontWeight: 700, color: '#dc2626', lineHeight: 1.3, marginBottom: 0.5 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines starting with any emoji — bold header in cp color
    const emojiHeaderMatch = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}][\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]*)\s*(.+)/u.exec(trimmed)
    if (emojiHeaderMatch) {
      return (
        <Text key={i} style={{ fontSize: 8, fontWeight: 700, color: cpColor, lineHeight: 1.3, marginTop: 2, marginBottom: 0.5 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines starting with bullet (-, *, •) — indented
    if (/^[-*\u2022]\s/.test(trimmed)) {
      return (
        <Text key={i} style={{ fontSize: 7.5, color: '#555', paddingLeft: 10, lineHeight: 1.3 }}>
          {trimmed}
        </Text>
      )
    }

    // Lines with "Keyword:" pattern — keyword bold in cs, rest normal
    const keywordMatch = /^([A-Za-z\u00C0-\u00FF\s]+):\s*(.*)/.exec(trimmed)
    if (keywordMatch) {
      return (
        <Text key={i} style={{ fontSize: 7.5, lineHeight: 1.3 }}>
          <Text style={{ fontWeight: 700, color: csColor }}>{keywordMatch[1]}:</Text>
          {' '}{keywordMatch[2]}
        </Text>
      )
    }

    // Default text
    return (
      <Text key={i} style={{ fontSize: 7.5, color: '#333', lineHeight: 1.3 }}>
        {trimmed}
      </Text>
    )
  })
}

/** Bloque de firma inline compacto */
function FirmaInline({ medico, colors }: { medico: PdfMedicoData | null; colors: PdfColors }) {
  const nombre = medico?.nombre || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  const s = StyleSheet.create({
    firma: {
      textAlign: 'center',
      minWidth: 190,
    },
    linea: {
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      borderTopStyle: 'dashed',
      paddingTop: 5,
    },
    nombre: {
      fontWeight: 700,
      fontSize: 8.5,
      color: colors.cp,
    },
    ced: {
      fontSize: 6.5,
      color: '#666',
      marginTop: 1,
    },
    firmaLabel: {
      fontSize: 5.5,
      color: '#c0c0c0',
      marginTop: 3,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  })

  return (
    <View style={s.firma}>
      <View style={s.linea}>
        <Text style={s.nombre}>{nombre}</Text>
        {cedProf ? <Text style={s.ced}>Céd. Prof. {cedProf}</Text> : null}
        {cedEsp ? <Text style={s.ced}>Céd. Esp. {cedEsp}</Text> : null}
        <Text style={s.firmaLabel}>Firma y sello</Text>
      </View>
    </View>
  )
}

export default function RecetaPdf({ medico, data, logoUrl }: RecetaPdfProps) {
  const colors = getPdfColors(medico)

  const s = StyleSheet.create({
    /* ---------- Contenido compacto para receta ---------- */
    contenido: {
      paddingHorizontal: 40,
      paddingTop: 12,
      paddingBottom: 6,
      flex: 1,
    },

    /* ---------- Rx decorativo ---------- */
    rxText: {
      position: 'absolute',
      top: 66,
      right: 40,
      fontSize: 34,
      fontWeight: 700,
      color: colors.cs,
      opacity: 0.8,
    },

    /* ---------- Datos del paciente ---------- */
    patientBox: {
      marginTop: 2,
      marginBottom: 2,
    },
    datoRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 0,
    },
    datoField: {
      flex: 1,
      marginBottom: 4,
      borderWidth: 0.5,
      borderColor: '#e5e7eb',
      borderRadius: 2,
      paddingHorizontal: 5,
      paddingTop: 2,
      paddingBottom: 3,
    },
    datoLabel: {
      fontSize: 5.5,
      fontWeight: 700,
      color: colors.cp,
      marginBottom: 0.5,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    datoValor: {
      fontSize: 8.5,
      color: '#1a1a1a',
      fontWeight: 500,
      lineHeight: 1.2,
    },

    /* ---------- Sección heading ---------- */
    seccionWrap: {
      backgroundColor: colors.cp + '0A',
      borderLeftWidth: 3,
      borderLeftColor: colors.cp,
      borderRadius: 3,
      paddingVertical: 3,
      paddingLeft: 8,
      marginTop: 6,
      marginBottom: 4,
    },
    seccionText: {
      color: colors.cp,
      fontSize: 9,
      fontWeight: 700,
    },

    /* ---------- Tabla medicamentos ---------- */
    tblHeader: {
      flexDirection: 'row',
      backgroundColor: colors.cp,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 3,
      paddingHorizontal: 4,
    },
    tblHeaderText: {
      fontSize: 6.5,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    tblRow: {
      flexDirection: 'row',
      paddingVertical: 3,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: '#e5e7eb',
    },
    tblRowAlt: {
      backgroundColor: '#f8f9fb',
    },
    colNum: {
      width: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colMed: {
      flex: 3,
      paddingRight: 4,
    },
    colVia: {
      flex: 1,
      paddingRight: 4,
    },
    colInd: {
      flex: 2,
    },
    numText: {
      fontSize: 8.5,
      fontWeight: 700,
      color: colors.cs,
    },
    medNombre: {
      fontSize: 8,
      fontWeight: 700,
      textTransform: 'uppercase',
    },
    medPresentacion: {
      fontSize: 7,
      color: '#555',
      marginTop: 0.5,
    },
    medPrincipio: {
      fontSize: 6.5,
      color: '#888',
      marginTop: 0.5,
    },
    viaText: {
      fontSize: 7.5,
      color: colors.cs,
      fontWeight: 500,
    },
    indText: {
      fontSize: 7.5,
      color: '#333',
      lineHeight: 1.3,
    },

    /* ---------- Recomendaciones ---------- */
    recomendacionesBody: {
      marginTop: 1,
      paddingLeft: 4,
    },

    /* ---------- Footer: QR + Firma ---------- */
    footerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 8,
    },
    qrGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    qrWrap: {
      alignItems: 'center',
      gap: 2,
    },
    qrImage: {
      width: 50,
      height: 50,
    },
    qrLabel: {
      fontSize: 5,
      color: '#999',
      textAlign: 'center',
      maxWidth: 58,
    },
    blogQrWrap: {
      alignItems: 'center',
      gap: 2,
    },
    blogQrImage: {
      width: 40,
      height: 40,
    },
    blogQrLabel: {
      fontSize: 4.5,
      color: '#aaa',
      textAlign: 'center',
      maxWidth: 50,
    },
    firmaWrap: {
      flex: 1,
      alignItems: 'flex-end',
    },
  })

  return (
    <Document>
      <Page size="LETTER" style={baseStyles.page}>
        <BarraTop colors={colors} />

        <View style={s.contenido}>
          <PdfWatermark logoUrl={logoUrl} />

          <PdfHeader
            medico={medico}
            colors={colors}
            logoUrl={logoUrl}
            folio={data.folio}
            fecha={data.fecha}
            compact
          />

          {/* Rx decorativo */}
          <Text style={s.rxText}>Rx</Text>

          {/* Datos del paciente — 2 filas compactas */}
          <View style={s.patientBox}>
            {/* Row 1: Fecha + Paciente + Edad + Sexo */}
            <View style={s.datoRow}>
              <View style={s.datoField}>
                <Text style={s.datoLabel}>FECHA</Text>
                <Text style={s.datoValor}>{data.fecha}</Text>
              </View>
              <View style={{ ...s.datoField, flex: 2 }}>
                <Text style={s.datoLabel}>PACIENTE</Text>
                <Text style={s.datoValor}>{data.paciente}</Text>
              </View>
              <View style={s.datoField}>
                <Text style={s.datoLabel}>EDAD</Text>
                <Text style={s.datoValor}>{data.edad || '\u2014'}</Text>
              </View>
              <View style={s.datoField}>
                <Text style={s.datoLabel}>SEXO</Text>
                <Text style={s.datoValor}>{data.sexo || '\u2014'}</Text>
              </View>
            </View>

            {/* Row 2: Diagnóstico (full width) */}
            <View style={{ ...s.datoField, marginBottom: 0 }}>
              <Text style={s.datoLabel}>{`DIAGN\u00D3STICO`}</Text>
              <Text style={s.datoValor}>{data.diagnostico || '\u2014'}</Text>
            </View>
          </View>

          {/* Sección Medicamentos */}
          <View style={s.seccionWrap}>
            <Text style={s.seccionText}>Medicamentos</Text>
          </View>

          {/* Tabla de medicamentos — wrap={false} mantiene cada fila junta */}
          <View>
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
                  <Text style={s.medNombre}>{med.nombre_comercial}</Text>
                  {med.presentacion ? (
                    <Text style={s.medPresentacion}>{med.presentacion}</Text>
                  ) : null}
                  {med.principio_activo ? (
                    <Text style={s.medPrincipio}>{med.principio_activo}</Text>
                  ) : null}
                </View>
                <View style={s.colVia}>
                  <Text style={s.viaText}>{med.via_administracion || '\u2014'}</Text>
                </View>
                <View style={s.colInd}>
                  <Text style={s.indText}>{med.indicacion || '\u2014'}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recomendaciones */}
          {data.recomendaciones ? (
            <View>
              <View style={s.seccionWrap}>
                <Text style={s.seccionText}>Recomendaciones</Text>
              </View>
              <View style={s.recomendacionesBody}>
                {parseRecomendaciones(data.recomendaciones, colors.cp, colors.cs)}
              </View>
            </View>
          ) : null}

          {/* Footer: QR(s) izquierda + Firma derecha */}
          <View style={s.footerRow} wrap={false}>
            <View style={s.qrGroup}>
              {data.qrDataUrl ? (
                <View style={s.qrWrap}>
                  <Image style={s.qrImage} src={data.qrDataUrl} />
                  <Text style={s.qrLabel}>Escanea para verificar autenticidad</Text>
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
              <FirmaInline medico={medico} colors={colors} />
            </View>
          </View>
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
