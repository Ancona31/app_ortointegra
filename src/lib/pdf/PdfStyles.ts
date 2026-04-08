import { StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

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
  color_primario?: string
  color_secundario?: string
  direccion_consultorio?: string
  telefono_consultorio?: string
  email_consultorio?: string
}

export function getPdfColors(medico: PdfMedicoData | null): PdfColors {
  return {
    cp: medico?.color_primario || '#1a3a5c',
    cs: medico?.color_secundario || '#1e5fa8',
  }
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
    paddingTop: 24,
    paddingBottom: 44,
    flex: 1,
  },
  tituloDoc: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 16,
    paddingVertical: 9,
    borderRadius: 4,
    letterSpacing: 1.5,
    color: '#ffffff',
  },
  datoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  datoField: {
    flex: 1,
    marginBottom: 10,
    borderWidth: 0.75,
    borderColor: '#e5e7eb',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 6,
  },
  datoLabel: {
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datoValor: {
    fontSize: 10.5,
    color: '#1a1a1a',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  seccion: {
    fontSize: 11,
    fontWeight: 700,
    paddingVertical: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderRadius: 3,
    marginTop: 16,
    marginBottom: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 48,
    right: 50,
    fontSize: 7,
    color: '#aaa',
  },
})
