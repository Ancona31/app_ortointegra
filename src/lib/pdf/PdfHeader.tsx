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
  /** Mostrar el símbolo "Rx" (solo recetas médicas) */
  showRx?: boolean
  /** Texto adicional debajo de cédulas (ej: universidad, solo receta) */
  extraCredencial?: string
}

export default function PdfHeader({ medico, colors, logoUrl, folio, fecha, compact, showRx, extraCredencial }: Props) {
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

  const logoBoxW = compact ? 52 : 62
  const logoBoxH = compact ? 52 : 62

  const s = StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 10 : 14,
      marginBottom: 0,
    },
    logoWrap: {
      width: logoBoxW,
      height: logoBoxH,
      borderRadius: logoBoxW / 2,
      borderWidth: 1.5,
      borderColor: '#d1d5db',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fafbfc',
    },
    logo: {
      width: 80,
      height: 40,
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
    especialidadText: {
      fontSize: compact ? 7.5 : 8.5,
      color: colors.cs,
      fontWeight: 500,
      marginTop: compact ? 1 : 2,
      letterSpacing: 0.3,
    },
    credsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: compact ? 2 : 4,
    },
    cedItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 3,
    },
    cedDot: {
      width: 2.5,
      height: 2.5,
      borderRadius: 1.25,
      backgroundColor: colors.cs,
      marginTop: compact ? 3 : 3.5,
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
    rxWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: logoBoxW,
      height: logoBoxH,
    },
    rxText: {
      fontSize: compact ? 34 : 38,
      fontWeight: 700,
      color: colors.cs,
      opacity: 0.85,
      textAlign: 'center',
    },
    rxFolio: {
      fontSize: 7,
      color: colors.cp,
      fontWeight: 700,
      textAlign: 'center',
      marginTop: 31,
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
          {esp ? <Text style={s.especialidadText}>{esp}</Text> : null}
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
          {extraCredencial ? (
            <Text style={{ fontSize: compact ? 6.5 : 7, color: '#888', marginTop: compact ? 1 : 2 }}>
              {extraCredencial}
            </Text>
          ) : null}
          {contacto ? <Text style={s.contacto}>{contacto}</Text> : null}
        </View>
        {showRx ? (
          <View style={s.rxWrap}>
            <Text style={s.rxText}>Rx</Text>
            {folio ? <Text style={s.rxFolio}>{folio}</Text> : null}
          </View>
        ) : (folio ? (
          <View style={{ alignItems: 'flex-end', minWidth: 90 }}>
            <Text style={s.rxFolio}>No. {folio}</Text>
          </View>
        ) : null)}
      </View>
      {/* Separador grueso cp */}
      <View style={{ width: '100%', height: compact ? 1.5 : 2, backgroundColor: colors.cp, marginTop: compact ? 6 : 10 }} />
      {/* Separador fino cs */}
      <View style={{ width: '100%', height: 0.5, backgroundColor: colors.cs, marginTop: 1.5, marginBottom: compact ? 8 : 12 }} />
    </View>
  )
}
