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
      marginTop: 24,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    firma: {
      textAlign: 'center',
      minWidth: 210,
      borderTopWidth: 1.5,
      borderTopColor: colors.cp,
      paddingTop: 8,
    },
    nombre: { fontWeight: 700, fontSize: 9.5, color: colors.cp },
    ced: { fontSize: 8, color: '#666', marginTop: 2 },
  })

  return (
    <View style={s.footerArea}>
      <View style={s.firma}>
        <Text style={s.nombre}>{nombre}</Text>
        {cedProf ? <Text style={s.ced}>Céd. Prof. {cedProf}</Text> : null}
        {cedEsp ? <Text style={s.ced}>Céd. Esp. {cedEsp}</Text> : null}
      </View>
    </View>
  )
}
