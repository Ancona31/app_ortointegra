import { StyleSheet, Font, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer'
import React from 'react'
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

/**
 * Fondo con degradado cp → cs para usar como background absoluto.
 * Requiere que el padre tenga `position: 'relative'` y `overflow: 'hidden'`.
 */
export function GradientBg({ cp, cs, id }: { cp: string; cs: string; id: string }) {
  return (
    <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={cp} stopOpacity={1} />
          <Stop offset="1" stopColor={cs} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  )
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
