import { View, Text, StyleSheet, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

/** Ancho de página LETTER en pt (612) — las barras van edge-to-edge */
const PW = 612

export function BarraTop({ colors }: { colors: PdfColors }) {
  return (
    <View>
      <Svg viewBox={`0 0 ${PW} 14`} style={{ width: PW, height: 14 }}>
        <Defs>
          <LinearGradient id="gradTop" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.cp} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.cs} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={PW} height="14" fill="url(#gradTop)" />
      </Svg>
      <Svg viewBox={`0 0 ${PW} 2`} style={{ width: PW, height: 2 }}>
        <Defs>
          <LinearGradient id="gradTopFino" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.cs} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.cp} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={PW} height="2" fill="url(#gradTopFino)" />
      </Svg>
    </View>
  )
}

interface BarraBottomProps {
  colors: PdfColors
  medico: PdfMedicoData | null
}

export function BarraBottom({ colors, medico }: BarraBottomProps) {
  const dir = medico?.direccion_consultorio || ''
  const tel = medico?.telefono_consultorio || ''
  const email = medico?.email_consultorio || ''

  const contactoParts = [
    dir,
    tel ? `Tel: ${tel}` : '',
    email,
  ].filter(Boolean).join('   ·   ')

  const s = StyleSheet.create({
    wrapper: {
    },
    contactRow: {
      paddingHorizontal: 50,
      paddingVertical: 12,
      position: 'relative',
      overflow: 'hidden',
    },
    contactBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    contactText: {
      fontSize: 6.5,
      color: '#ffffff',
      opacity: 0.85,
      textAlign: 'center',
      marginBottom: 3,
    },
    branding: {
      fontSize: 5.5,
      color: '#ffffff',
      opacity: 0.5,
      textAlign: 'center',
    },
  })

  return (
    <View style={s.wrapper}>
      <Svg viewBox={`0 0 ${PW} 2`} style={{ width: PW, height: 2 }}>
        <Defs>
          <LinearGradient id="gradBotFino" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.cs} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.cp} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={PW} height="2" fill="url(#gradBotFino)" />
      </Svg>
      <View style={s.contactRow}>
        <Svg viewBox={`0 0 ${PW} 50`} preserveAspectRatio="none" style={s.contactBg}>
          <Defs>
            <LinearGradient id="gradFooterBg" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.cp} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.cs} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={PW} height="50" fill="url(#gradFooterBg)" />
        </Svg>
        {contactoParts ? <Text style={s.contactText}>{contactoParts}</Text> : null}
        <Text style={s.branding}>{`Documento generado por Spinus\u00AE \u2014 La columna vertebral de tu pr\u00E1ctica m\u00E9dica`}</Text>
      </View>
    </View>
  )
}
