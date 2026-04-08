import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

interface Props {
  medico: PdfMedicoData | null
  colors: PdfColors
  logoUrl?: string
  folio?: string
  fecha?: string
}

export default function PdfHeader({ medico, colors, logoUrl, folio, fecha }: Props) {
  const nombre = medico?.nombre || 'Médico'
  const esp = medico?.especialidad || ''
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''
  const dir = medico?.direccion_consultorio || ''
  const tel = medico?.telefono_consultorio || ''

  const contactoParts = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean)
  const contacto = contactoParts.join('  ·  ')

  const creds = [
    cedProf ? `Céd. Prof. ${cedProf}` : '',
    cedEsp ? `Céd. Esp. ${cedEsp}` : '',
  ].filter(Boolean).join('   ·   ')

  const s = StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 0,
    },
    logoWrap: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 1.5,
      borderColor: colors.cp + '40',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fafbfc',
    },
    logo: {
      width: 56,
      height: 56,
      objectFit: 'contain',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: 700,
      color: colors.cp,
      letterSpacing: 0.3,
      lineHeight: 1.2,
    },
    especialidadBadge: {
      backgroundColor: colors.cs + '12',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.cs + '30',
      alignSelf: 'flex-start',
      marginTop: 3,
    },
    especialidadText: {
      fontSize: 8,
      color: colors.cs,
      fontWeight: 500,
      letterSpacing: 0.3,
    },
    credsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    cedDot: {
      width: 2.5,
      height: 2.5,
      borderRadius: 1.25,
      backgroundColor: colors.cs,
    },
    cedText: {
      fontSize: 7.5,
      color: '#666',
    },
    contacto: {
      fontSize: 7,
      color: '#888',
      marginTop: 3,
    },
    meta: {
      alignItems: 'flex-end',
      minWidth: 90,
    },
    metaFolio: {
      fontSize: 7.5,
      color: colors.cp,
      fontWeight: 700,
      lineHeight: 1.5,
    },
    metaFecha: {
      fontSize: 7.5,
      color: '#777',
      lineHeight: 1.5,
      marginTop: 1,
    },
    separadorGrueso: {
      height: 2,
      backgroundColor: colors.cp,
      marginTop: 10,
    },
    separadorFino: {
      height: 0.5,
      backgroundColor: colors.cs,
      marginTop: 1.5,
      marginBottom: 12,
    },
  })

  return (
    <View>
      <View style={s.headerRow}>
        {logoUrl ? (
          <View style={s.logoWrap}>
            <Image style={s.logo} src={logoUrl} />
          </View>
        ) : null}
        <View style={s.info}>
          <Text style={s.name}>{nombre}</Text>
          {esp ? (
            <View style={s.especialidadBadge}>
              <Text style={s.especialidadText}>{esp}</Text>
            </View>
          ) : null}
          <View style={s.credsRow}>
            {cedProf ? (
              <View style={s.cedItem}>
                <View style={s.cedDot} />
                <Text style={s.cedText}>Céd. Prof. {cedProf}</Text>
              </View>
            ) : null}
            {cedEsp ? (
              <View style={s.cedItem}>
                <View style={s.cedDot} />
                <Text style={s.cedText}>Céd. Esp. {cedEsp}</Text>
              </View>
            ) : null}
          </View>
          {contacto ? <Text style={s.contacto}>{contacto}</Text> : null}
        </View>
        {(folio || fecha) ? (
          <View style={s.meta}>
            {folio ? <Text style={s.metaFolio}>No. {folio}</Text> : null}
            {fecha ? <Text style={s.metaFecha}>{fecha}</Text> : null}
          </View>
        ) : null}
      </View>
      <View style={s.separadorGrueso} />
      <View style={s.separadorFino} />
    </View>
  )
}
