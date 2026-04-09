import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

interface Props {
  medico: PdfMedicoData | null
  colors: PdfColors
  logoUrl?: string
  folio?: string
  fecha?: string
  /** Modo compacto: logo más pequeño, menos espaciado (para receta) */
  compact?: boolean
}

export default function PdfHeader({ medico, colors, logoUrl, folio, fecha, compact }: Props) {
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

  const logoSize = compact ? 42 : 62
  const logoInner = compact ? 38 : 56

  const s = StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 10 : 14,
      marginBottom: 0,
    },
    logoWrap: {
      width: logoSize,
      height: logoSize,
      borderRadius: logoSize / 2,
      borderWidth: 1.5,
      borderColor: colors.cp + '40',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fafbfc',
    },
    logo: {
      width: logoInner,
      height: logoInner,
      objectFit: 'contain',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: compact ? 13 : 16,
      fontWeight: 700,
      color: colors.cp,
      letterSpacing: 0.3,
      lineHeight: 1.2,
    },
    especialidadBadge: {
      backgroundColor: colors.cs + '12',
      paddingHorizontal: compact ? 6 : 8,
      paddingVertical: compact ? 1.5 : 2,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.cs + '30',
      alignSelf: 'flex-start',
      marginTop: compact ? 2 : 3,
    },
    especialidadText: {
      fontSize: compact ? 7 : 8,
      color: colors.cs,
      fontWeight: 500,
      letterSpacing: 0.3,
    },
    credsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: compact ? 2 : 4,
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
      fontSize: compact ? 7 : 7.5,
      color: '#666',
    },
    contacto: {
      fontSize: compact ? 6.5 : 7,
      color: '#888',
      marginTop: compact ? 1 : 3,
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
      height: compact ? 1.5 : 2,
      backgroundColor: colors.cp,
      marginTop: compact ? 6 : 10,
    },
    separadorFino: {
      height: 0.5,
      backgroundColor: colors.cs,
      marginTop: 1.5,
      marginBottom: compact ? 8 : 12,
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
