import { StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Roboto-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Roboto-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
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
    paddingTop: 28,
    paddingBottom: 40,
    flex: 1,
  },
  tituloDoc: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 18,
    paddingVertical: 8,
    borderRadius: 4,
    letterSpacing: 1,
  },
  datoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  datoField: {
    flex: 1,
    marginBottom: 12,
  },
  datoLabel: {
    fontSize: 7.5,
    fontWeight: 500,
    color: '#888',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datoValor: {
    fontSize: 10.5,
    color: '#1a1a1a',
    borderBottomWidth: 0.75,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
    lineHeight: 1.4,
  },
  seccion: {
    fontSize: 11,
    fontWeight: 700,
    paddingVertical: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderRadius: 3,
    marginTop: 20,
    marginBottom: 12,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 52,
    right: 50,
    fontSize: 7,
    color: '#aaa',
  },
})
