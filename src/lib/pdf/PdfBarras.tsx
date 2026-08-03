import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors, PdfConsultorioData } from './PdfStyles'
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
  /** F3-10: consultorio activo. Si llega, dir/tel prevalecen sobre los del medico legacy. */
  consultorio?: PdfConsultorioData
}

export function BarraBottom({ colors, medico, consultorio }: BarraBottomProps) {
  const dir = consultorio?.direccion || medico?.direccion_consultorio || ''
  const tel = consultorio?.telefono || medico?.telefono_consultorio || ''
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
        <Text style={s.branding}>Documento generado por Spinus — La columna vertebral de tu práctica médica</Text>
      </View>
    </View>
  )
}
