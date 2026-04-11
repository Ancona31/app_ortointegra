import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'
import { contrastText } from './PdfStyles'

export function BarraTop({ colors }: { colors: PdfColors }) {
  return (
    <View>
      <View style={{ width: '100%', height: 14, backgroundColor: colors.cp }} />
      <View style={{ width: '100%', height: 2, backgroundColor: colors.cs }} />
    </View>
  )
}

interface BarraBottomProps {
  colors: PdfColors
  medico: PdfMedicoData | null
}

export function BarraBottom({ colors, medico }: BarraBottomProps) {
  const dir = medico?.direccion_consultorio ?? ''
  const tel = medico?.telefono_consultorio ?? ''
  const email = medico?.email_consultorio ?? ''

  const contactoParts = [
    dir,
    tel ? `Tel: ${tel}` : '',
    email,
  ].filter(Boolean).join('   ·   ')

  const textColor = contrastText(colors.cp)

  const s = StyleSheet.create({
    contactRow: {
      paddingHorizontal: 50,
      paddingVertical: 12,
      backgroundColor: colors.cp,
    },
    contactText: {
      fontSize: 6.5,
      color: textColor,
      opacity: 0.85,
      textAlign: 'center',
      marginBottom: 3,
    },
    branding: {
      fontSize: 5.5,
      color: textColor,
      opacity: 0.5,
      textAlign: 'center',
    },
  })

  return (
    <View>
      <View style={{ width: '100%', height: 2, backgroundColor: colors.cs }} />
      <View style={s.contactRow}>
        {contactoParts ? <Text style={s.contactText}>{contactoParts}</Text> : null}
        <Text style={s.branding}>{`Documento generado por Spinus\u00AE \u2014 La columna vertebral de tu pr\u00E1ctica m\u00E9dica`}</Text>
      </View>
    </View>
  )
}
