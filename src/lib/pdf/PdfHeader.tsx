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

  const s = StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 0,
    },
    logoWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 2.5,
      borderColor: colors.cs,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
    },
    logo: {
      width: 62,
      height: 62,
      objectFit: 'contain',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: 700,
      color: colors.cp,
      letterSpacing: 0.5,
      lineHeight: 1.2,
    },
    especialidadBadge: {
      backgroundColor: colors.cs + '15',
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      borderRadius: 10,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    especialidadText: {
      fontSize: 8.5,
      color: colors.cs,
      fontWeight: 400,
      letterSpacing: 0.3,
    },
    credsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 5,
    },
    cedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cedDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.cs,
    },
    cedText: {
      fontSize: 8,
      color: '#666',
    },
    meta: {
      alignItems: 'flex-end',
      minWidth: 100,
    },
    metaText: {
      fontSize: 7.5,
      color: '#999',
      lineHeight: 1.5,
    },
    metaFolio: {
      fontSize: 8,
      color: colors.cp,
      fontWeight: 500,
      lineHeight: 1.5,
    },
    separadorGrueso: {
      height: 2.5,
      backgroundColor: colors.cp,
      marginTop: 12,
    },
    separadorFino: {
      height: 0.75,
      backgroundColor: colors.cs,
      marginTop: 1.5,
      marginBottom: 14,
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
        </View>
        {(folio || fecha) ? (
          <View style={s.meta}>
            {folio ? <Text style={s.metaFolio}>No. {folio}</Text> : null}
            {fecha ? <Text style={s.metaText}>{fecha}</Text> : null}
          </View>
        ) : null}
      </View>
      <View style={s.separadorGrueso} />
      <View style={s.separadorFino} />
    </View>
  )
}
