import { View, Text, StyleSheet, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

export function BarraTop({ colors }: { colors: PdfColors }) {
  return (
    <View>
      <Svg width="100%" height={14}>
        <Defs>
          <LinearGradient id="gradTop" x1="0" y1="0" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.cp} />
            <Stop offset="100%" stopColor={colors.cs} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={14} fill="url(#gradTop)" />
      </Svg>
      <Svg width="100%" height={2}>
        <Defs>
          <LinearGradient id="gradTopFino" x1="0" y1="0" x2="100%" y2="0">
            <Stop offset="0%" stopColor={colors.cs} />
            <Stop offset="100%" stopColor={colors.cp} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={2} fill="url(#gradTopFino)" />
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
      marginTop: 'auto',
    },
    contactRow: {
      paddingHorizontal: 50,
      paddingVertical: 12,
      backgroundColor: colors.cp,
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
    <View style={s.wrapper} fixed>
      <Svg width="100%" height={2}>
        <Defs>
          <LinearGradient id="gradBotFino" x1="0" y1="0" x2="100%" y2="0">
            <Stop offset="0%" stopColor={colors.cs} />
            <Stop offset="100%" stopColor={colors.cp} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={2} fill="url(#gradBotFino)" />
      </Svg>
      <View style={s.contactRow}>
        {contactoParts ? <Text style={s.contactText}>{contactoParts}</Text> : null}
        <Text style={s.branding}>{`Documento generado por Spinus\u00AE \u2014 La columna vertebral de tu pr\u00E1ctica m\u00E9dica`}</Text>
      </View>
    </View>
  )
}
