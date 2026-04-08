import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

interface Props {
  medico: PdfMedicoData | null
  colors: PdfColors
  logoUrl?: string
}

export default function PdfHeader({ medico, colors, logoUrl }: Props) {
  const nombre = medico?.nombre || 'Médico'
  const esp = medico?.especialidad || ''
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''
  const dir = medico?.direccion_consultorio || ''
  const tel = medico?.telefono_consultorio || ''

  const contactoParts = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean)
  const contacto = contactoParts.join('  ·  ')

  const creds = [
    cedProf ? `Cédula Prof.: ${cedProf}` : '',
    cedEsp ? `Cédula Esp.: ${cedEsp}` : '',
  ].filter(Boolean).join('  ·  ')

  const s = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingBottom: 12,
      marginBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: colors.cp,
    },
    logoWrap: {
      width: 70,
      height: 70,
      borderRadius: 35,
      borderWidth: 3,
      borderColor: colors.cs,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
    },
    logo: {
      width: 64,
      height: 64,
      objectFit: 'contain',
    },
    info: { flex: 1 },
    name: { fontSize: 14, fontWeight: 700, color: colors.cp, lineHeight: 1.2 },
    especialidad: { fontSize: 9, color: colors.cs, marginTop: 3, fontStyle: 'italic' },
    credenciales: { fontSize: 8, color: '#666', marginTop: 2 },
    contacto: { fontSize: 7.5, color: '#888', marginTop: 3 },
  })

  return (
    <View style={s.header}>
      {logoUrl ? (
        <View style={s.logoWrap}>
          <Image style={s.logo} src={logoUrl} />
        </View>
      ) : null}
      <View style={s.info}>
        <Text style={s.name}>{nombre}</Text>
        {esp ? <Text style={s.especialidad}>{esp}</Text> : null}
        {creds ? <Text style={s.credenciales}>{creds}</Text> : null}
        {contacto ? <Text style={s.contacto}>{contacto}</Text> : null}
      </View>
    </View>
  )
}
