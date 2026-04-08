import { StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuZebmmT.ttf', fontWeight: 700 },
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
}

export function getPdfColors(medico: PdfMedicoData | null): PdfColors {
  return {
    cp: medico?.color_primario || '#1a3a5c',
    cs: medico?.color_secundario || '#1e5fa8',
  }
}

/** Estilos base reutilizables */
export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#1a1a1a',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  contenido: {
    paddingHorizontal: 50,
    paddingTop: 32,
    paddingBottom: 28,
    flex: 1,
  },
  tituloDoc: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 14,
    paddingVertical: 6,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  datoRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  datoLabel: {
    fontWeight: 700,
    minWidth: 80,
    fontSize: 10,
  },
  datoValor: {
    flex: 1,
    fontSize: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#aaa',
    paddingBottom: 1,
  },
  seccion: {
    fontSize: 11,
    fontWeight: 700,
    borderBottomWidth: 1,
    paddingBottom: 3,
    marginTop: 16,
    marginBottom: 10,
  },
})
