import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

interface Props {
  medico: PdfMedicoData | null
  colors: PdfColors
}

export default function PdfFirma({ medico, colors }: Props) {
  const nombre = medico?.nombre || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  const s = StyleSheet.create({
    footerArea: {
      marginTop: 'auto',
      paddingTop: 20,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    firma: {
      textAlign: 'center',
      minWidth: 240,
    },
    linea: {
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      borderTopStyle: 'dashed',
      paddingTop: 8,
    },
    nombre: {
      fontWeight: 700,
      fontSize: 9.5,
      color: colors.cp,
    },
    ced: {
      fontSize: 7.5,
      color: '#666',
      marginTop: 2,
    },
    firmaLabel: {
      fontSize: 6,
      color: '#c0c0c0',
      marginTop: 5,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  })

  return (
    <View style={s.footerArea}>
      <View style={s.firma}>
        <View style={s.linea}>
          <Text style={s.nombre}>{nombre}</Text>
          {cedProf ? <Text style={s.ced}>Céd. Prof. {cedProf}</Text> : null}
          {cedEsp ? <Text style={s.ced}>Céd. Esp. {cedEsp}</Text> : null}
          <Text style={s.firmaLabel}>Firma y sello</Text>
        </View>
      </View>
    </View>
  )
}
