import { StyleSheet, Font } from '@react-pdf/renderer'

// Registro de fuentes: servidor usa rutas del filesystem, cliente usa URLs
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const fontsDir = path.join(process.cwd(), 'public', 'fonts')
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(fontsDir, 'Roboto-Regular.ttf'), fontWeight: 400 },
      { src: path.join(fontsDir, 'Roboto-Medium.ttf'), fontWeight: 500 },
      { src: path.join(fontsDir, 'Roboto-Bold.ttf'), fontWeight: 700 },
      { src: path.join(fontsDir, 'Roboto-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    ],
  })
} else {
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/Roboto-Medium.ttf', fontWeight: 500 },
      { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
      { src: '/fonts/Roboto-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  })
}

// Desactivar hyphenation — el callback por defecto corrompe caracteres acentuados
Font.registerHyphenationCallback(word => [word])

/**
 * Normaliza texto para PDF: aplica NFC para que los acentos sean glifos únicos
 * y no secuencias combining (base + acento separado).
 */
export function t(text: string | undefined | null): string {
  if (!text) return ''
  return text.normalize('NFC')
}

export interface PdfColors {
  cp: string
  cs: string
}

/** Datos del médico necesarios para los PDFs */
export interface PdfMedicoData {
  nombre: string
  especialidad?: string
  cedula_profesional?: string
  cedula_especialidad?: string
  logo_url?: string | null
  /** URL firmada (1h) de la firma autógrafa en PNG transparente */
  firma_url?: string | null
  color_primario?: string
  color_secundario?: string
  direccion_consultorio?: string
  telefono_consultorio?: string
  email_consultorio?: string
}

export function getPdfColors(medico: PdfMedicoData | null): PdfColors {
  return {
    cp: medico?.color_primario ?? '#004A99',
    cs: medico?.color_secundario ?? '#1e5fa8',
  }
}

/**
 * Retorna '#ffffff' o '#1a1a1a' según la luminosidad del color de fondo.
 * Garantiza que el texto sea siempre legible sobre cualquier color corporativo.
 */
export function contrastText(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
}

/** Estilos base reutilizables — diseño premium clínica privada */
export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.6,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  contenido: {
    paddingHorizontal: 50,
    paddingTop: 16,
    paddingBottom: 28,
  },
  tituloDoc: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 8,
    paddingVertical: 6,
    borderRadius: 4,
    letterSpacing: 1.5,
    color: '#ffffff',
  },
  datoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 1,
  },
  datoField: {
    flex: 1,
    marginBottom: 4,
    borderWidth: 0.75,
    borderColor: '#e5e7eb',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingTop: 3,
    paddingBottom: 3,
  },
  datoLabel: {
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datoValor: {
    fontSize: 10.5,
    color: '#1a1a1a',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  seccion: {
    fontSize: 11,
    fontWeight: 700,
    paddingVertical: 4,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 48,
    right: 50,
    fontSize: 7,
    color: '#aaa',
  },
})
