import { Document, Page, View, Text, Image, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { getPdfColors } from './PdfStyles'
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

/* ────────────────────────────────────────────────────────────────
   Sistema semántico de colores para recomendaciones
   ──────────────────────────────────────────────────────────────── */

interface SemanticPalette {
  bar: string
  bg: string
  border: string
  text: string
}

type SemanticKey = 'red' | 'orange' | 'green' | 'purple' | 'blue'

function getSemanticColors(cpColor: string): Record<SemanticKey, SemanticPalette> {
  return {
    red:    { bar: '#dc2626', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    orange: { bar: '#d97706', bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    green:  { bar: '#16a34a', bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    purple: { bar: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
    blue:   { bar: cpColor, bg: cpColor + '08', border: cpColor + '30', text: '#1a1a1a' },
  }
}

function detectSemantic(text: string): SemanticKey {
  const lower = text.toLowerCase()
  if (/alarma|urgente|emergencia|acudir\s*(inmediatamente|a\s*urgencias)|peligro/.test(lower)) return 'red'
  if (/evit[aeo]r?|no\s+debe|prohibido|restricci[oó]n|precauci[oó]n|no\s+aplique/.test(lower)) return 'orange'
  if (/se\s+(recomienda|sugiere)|consejo|nota\s+importante/.test(lower)) return 'green'
  if (/fisioterapia|rehabilitaci[oó]n|terapia\s+manual|sesiones|ejercicio/.test(lower)) return 'purple'
  return 'blue'
}

/** Regex para quitar emojis del inicio de una línea */
const EMOJI_STRIP_RE = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2702}-\u{27B0}\u{1FA00}-\u{1FA9F}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2702}-\u{27B0}\u{E0020}-\u{E007F}]+\s*/u

/** Detecta si una línea empieza con emoji */
const EMOJI_START_RE = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2702}-\u{27B0}\u{1FA00}-\u{1FA9F}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{E0020}-\u{E007F}]/u

/** Parsea las recomendaciones con sistema semántico de colores */
function parseRecomendaciones(text: string, cpColor: string) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  const palette = getSemanticColors(cpColor)

  return lines.map((line, i) => {
    const trimmed = line.trim()
    const cleanText = trimmed.replace(EMOJI_STRIP_RE, '')

    // ── Línea de alarma (🚨 o contiene "alarma") ──
    const isAlarm = trimmed.startsWith('\u{1F6A8}') ||
      /^(datos\s+de\s+)?alarma/i.test(cleanText)
    if (isAlarm) {
      const pal = palette.red
      const displayText = cleanText.replace(/^(datos\s+de\s+)?alarma[:\s]*/i, '').trim()
      return (
        <View key={i} style={{
          flexDirection: 'row',
          backgroundColor: pal.bg,
          borderWidth: 0.75,
          borderColor: pal.border,
          borderRadius: 3,
          paddingVertical: 4,
          paddingHorizontal: 6,
          marginTop: 4,
          marginBottom: 2,
          gap: 4,
          alignItems: 'center',
        }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: pal.bar }} />
          <Text style={{ fontSize: 7.5, fontWeight: 700, color: pal.text, flex: 1, lineHeight: 1.3 }}>
            <Text style={{ fontWeight: 700 }}>Datos de Alarma: </Text>
            {displayText || cleanText}
          </Text>
        </View>
      )
    }

    // ── Header de sección (empieza con emoji) ──
    if (EMOJI_START_RE.test(trimmed)) {
      const sem = detectSemantic(cleanText)
      const pal = palette[sem]
      return (
        <View key={i} style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderLeftWidth: 3,
          borderLeftColor: pal.bar,
          backgroundColor: pal.bg,
          borderRadius: 2,
          paddingVertical: 3,
          paddingLeft: 7,
          marginTop: i === 0 ? 0 : 5,
          marginBottom: 2,
        }}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: pal.text, lineHeight: 1.3 }}>
            {cleanText}
          </Text>
        </View>
      )
    }

    // ── Bullet (-, *, •) ──
    if (/^[-*\u2022]\s/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*\u2022]\s+/, '')
      const sem = detectSemantic(bulletText)
      const pal = palette[sem]
      return (
        <View key={i} style={{ flexDirection: 'row', gap: 4, paddingLeft: 10, marginBottom: 0.5, alignItems: 'flex-start' }}>
          <View style={{ width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: pal.bar, marginTop: 3 }} />
          <Text style={{ fontSize: 7.5, color: '#444', flex: 1, lineHeight: 1.3 }}>
            {bulletText}
          </Text>
        </View>
      )
    }

    // ── Keyword:value ──
    const keywordMatch = /^([A-Za-z\u00C0-\u00FF\s]+):\s*(.*)/.exec(cleanText)
    if (keywordMatch) {
      const keyword = keywordMatch[1]
      const value = keywordMatch[2]
      const sem = detectSemantic(keyword)
      const pal = palette[sem]
      return (
        <View key={i} style={{ flexDirection: 'row', gap: 4, paddingLeft: 6, marginBottom: 0.5, alignItems: 'flex-start' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: pal.bar, marginTop: 2.5 }} />
          <Text style={{ fontSize: 7.5, color: '#333', flex: 1, lineHeight: 1.3 }}>
            <Text style={{ fontWeight: 700, color: pal.text }}>{keyword}:</Text>
            {' '}{value}
          </Text>
        </View>
      )
    }

    // ── Texto general ──
    return (
      <Text key={i} style={{ fontSize: 7.5, color: '#333', lineHeight: 1.3, paddingLeft: 6 }}>
        {cleanText}
      </Text>
    )
  })
}

/* ────────────────────────────────────────────────────────────────
   Firma inline compacta
   ──────────────────────────────────────────────────────────────── */

function FirmaInline({ medico, colors }: { medico: PdfMedicoData | null; colors: PdfColors }) {
  const nombre = medico?.nombre || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  const s = StyleSheet.create({
    firma: {
      textAlign: 'center',
      alignItems: 'center',
      minWidth: 190,
    },
    linea: {
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      borderTopStyle: 'dashed',
      paddingTop: 5,
      alignItems: 'center',
      width: '100%',
    },
    nombre: {
      fontWeight: 700,
      fontSize: 8.5,
      color: colors.cp,
      textAlign: 'center',
    },
    ced: {
      fontSize: 6.5,
      color: '#666',
      marginTop: 1,
      textAlign: 'center',
    },
    firmaLabel: {
      fontSize: 5.5,
      color: '#c0c0c0',
      marginTop: 3,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      textAlign: 'center',
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

/* ────────────────────────────────────────────────────────────────
   Componente principal — RecetaPdf
   ──────────────────────────────────────────────────────────────── */

export default function RecetaPdf({ medico, data, logoUrl }: RecetaPdfProps) {
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
      marginBottom: 2.5,
      borderWidth: 0.5,
      borderColor: '#e5e7eb',
      borderRadius: 2,
      paddingHorizontal: 5,
      paddingTop: 1,
      paddingBottom: 1.5,
    },
    datoLabel: {
      fontSize: 7.5,
      fontWeight: 700,
      color: colors.cp,
      marginBottom: 0,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    datoValor: {
      fontSize: 10,
      color: '#1a1a1a',
      fontWeight: 500,
      lineHeight: 1.1,
    },
    diagField: {
      marginBottom: 0,
      marginTop: 0,
      borderWidth: 0.5,
      borderColor: '#e5e7eb',
      borderRadius: 2,
      paddingHorizontal: 6,
      paddingTop: 2.5,
      paddingBottom: 3,
    },
    diagLabel: {
      fontSize: 7.5,
      fontWeight: 700,
      color: colors.cp,
      marginBottom: 0.5,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    diagValor: {
      fontSize: 12,
      color: '#1a1a1a',
      fontWeight: 700,
      lineHeight: 1.3,
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
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 3,
      paddingHorizontal: 4,
      position: 'relative',
      overflow: 'hidden',
    },
    tblHeaderBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
      paddingLeft: 2,
    },

    /* ---------- Footer: QR + Firma ---------- */
    footerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 6,
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
      fontSize: 6.5,
      color: '#777',
      textAlign: 'center',
      maxWidth: 72,
      lineHeight: 1.1,
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
      fontSize: 5.5,
      color: '#999',
      textAlign: 'center',
      maxWidth: 56,
      lineHeight: 1.1,
    },
    firmaWrap: {
      flex: 1,
      alignItems: 'flex-end',
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
              compact
              showRx
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
        {/* Datos del paciente */}
        <View style={s.patientBox}>
            {/* Row 1: Paciente + Edad + Sexo */}
            <View style={s.datoRow}>
              <View style={{ ...s.datoField, flex: 3 }}>
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

            {/* Diagnóstico (full width, prominente) */}
            <View style={s.diagField}>
              <Text style={s.diagLabel}>{`DIAGN\u00D3STICO`}</Text>
              <Text style={s.diagValor}>{data.diagnostico || '\u2014'}</Text>
            </View>
          </View>

          {/* Sección Medicamentos */}
          <View style={s.seccionWrap}>
            <Text style={s.seccionText}>Medicamentos</Text>
          </View>

          {/* Tabla de medicamentos */}
          <View>
            <View style={s.tblHeader}>
              <Svg viewBox="0 0 100 20" preserveAspectRatio="none" style={s.tblHeaderBg}>
                <Defs>
                  <LinearGradient id="gTbl" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.cp} stopOpacity={1} />
                    <Stop offset="1" stopColor={colors.cs} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100" height="20" fill="url(#gTbl)" />
              </Svg>
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

          {/* Recomendaciones con sistema semántico */}
          {data.recomendaciones ? (
            <View>
              <View style={s.seccionWrap}>
                <Text style={s.seccionText}>Recomendaciones</Text>
              </View>
              <View style={s.recomendacionesBody}>
                {parseRecomendaciones(data.recomendaciones, colors.cp)}
              </View>
            </View>
          ) : null}

        </View>

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
      </Page>
    </Document>
  )
}
