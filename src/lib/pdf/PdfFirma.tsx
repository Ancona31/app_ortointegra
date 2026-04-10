import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
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
      marginTop: 16,
      paddingTop: 20,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    firma: {
      textAlign: 'center',
      alignItems: 'center',
      minWidth: 240,
    },
    linea: {
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      borderTopStyle: 'dashed',
      paddingTop: 8,
      alignItems: 'center',
      width: '100%',
    },
    nombre: {
      fontWeight: 700,
      fontSize: 9.5,
      color: colors.cp,
      textAlign: 'center',
    },
    ced: {
      fontSize: 7.5,
      color: '#666',
      marginTop: 2,
      textAlign: 'center',
    },
    firmaLabel: {
      fontSize: 6,
      color: '#c0c0c0',
      marginTop: 5,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      textAlign: 'center',
    },
  })

  return (
    <View style={s.footerArea}>
      <View style={s.firma}>
        {medico?.firma_url ? (
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <Image
              src={medico.firma_url}
              style={{ width: 140, height: 52, objectFit: 'contain' }}
            />
          </View>
        ) : null}
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
