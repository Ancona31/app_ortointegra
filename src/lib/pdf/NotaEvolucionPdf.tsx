import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface NotaEvolucionData {
  paciente: string
  fecha: string
  edad?: string
  sexo?: string
  peso?: string
  talla?: string
  contenido: string
  terapeutica?: Array<{
    medicamento: string
    dosis: string
    frecuencia: string
    duracion: string
  }>
  folio?: string
}

export interface NotaEvolucionProps {
  medico: PdfMedicoData | null
  data: NotaEvolucionData
  logoUrl?: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Patron para detectar encabezados de seccion (linea que termina en ":") */
const HEADER_PATTERN = /^(motivo de consulta|exploraci[oó]n f[ií]sica|diagn[oó]stico|plan|antecedentes|subjetivo|objetivo|an[aá]lisis|tratamiento|estudios|valoraci[oó]n|evoluci[oó]n|pronóstico|pron[oó]stico|nota|observaciones|indicaciones|hallazgos|interrogatorio|inspecci[oó]n)\s*:/i

function isSubsectionHeader(line: string): boolean {
  return HEADER_PATTERN.test(line.trim())
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                               */
/* ------------------------------------------------------------------ */

export function renderNotaEvolucion(props: NotaEvolucionProps) {
  return <NotaEvolucionPdf {...props} />
}

export default function NotaEvolucionPdf({ medico, data, logoUrl }: NotaEvolucionProps) {
  const colors = getPdfColors(medico)

  const s = StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 10,
      color: '#1a1a1a',
      paddingTop: 100,
      paddingBottom: 54,
      paddingHorizontal: 50,
    },
    headerFixed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    headerInner: {
      paddingHorizontal: 50,
      paddingTop: 8,
    },
    footerFixed: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    tituloWrap: {
      backgroundColor: colors.cp + '0D',
      borderRadius: 4,
      paddingVertical: 8,
      marginTop: 18,
      marginBottom: 18,
    },
    tituloText: {
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: colors.cp,
      letterSpacing: 1,
    },
    /* Patient data grid */
    patientGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 14,
    },
    patientCell: {
      marginBottom: 10,
      paddingRight: 12,
    },
    patientCellWide: {
      width: '50%',
      marginBottom: 10,
      paddingRight: 12,
    },
    patientCellNarrow: {
      width: '25%',
      marginBottom: 10,
      paddingRight: 12,
    },
    /* Content area */
    contentWrap: {
      marginBottom: 14,
    },
    subsectionHeader: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors.cp,
      marginTop: 12,
      marginBottom: 4,
    },
    contentLine: {
      fontSize: 10,
      color: '#1a1a1a',
      textAlign: 'justify',
      lineHeight: 1.7,
      marginBottom: 3,
    },
    /* Terapeutica table */
    tableWrap: {
      marginTop: 16,
      marginBottom: 14,
    },
    tableSectionHeader: {
      fontSize: 11,
      fontWeight: 700,
      paddingVertical: 6,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: colors.cp,
      backgroundColor: colors.cp + '0A',
      borderRadius: 3,
      color: colors.cp,
      marginBottom: 8,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: colors.cp,
    },
    tableHeaderCell: {
      fontSize: 8,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: '#e5e7eb',
    },
    tableRowAlt: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: '#e5e7eb',
      backgroundColor: colors.cs + '0D',
    },
    tableCell: {
      fontSize: 9.5,
      color: '#1a1a1a',
      lineHeight: 1.4,
    },
    colMed: { width: '30%' },
    colDosis: { width: '25%' },
    colFrec: { width: '25%' },
    colDur: { width: '20%' },
  })

  /* ---------- Parse contenido into elements ---------- */
  function renderContenido(): ReactElement[] {
    const lines = data.contenido.split('\n')
    const elements: ReactElement[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      if (isSubsectionHeader(line.trim())) {
        elements.push(
          <Text key={`h-${i}`} style={s.subsectionHeader}>
            {line.trim()}
          </Text>
        )
      } else {
        elements.push(
          <Text key={`l-${i}`} style={s.contentLine}>
            {line}
          </Text>
        )
      }
    }

    return elements
  }

  /* ---------- Patient data cells ---------- */
  const patientFields: Array<{
    label: string
    value: string | undefined
    style: 'wide' | 'narrow'
  }> = [
    { label: 'PACIENTE', value: data.paciente, style: 'wide' },
    { label: 'FECHA', value: data.fecha, style: 'wide' },
    { label: 'EDAD', value: data.edad, style: 'narrow' },
    { label: 'SEXO', value: data.sexo, style: 'narrow' },
    { label: 'PESO', value: data.peso, style: 'narrow' },
    { label: 'TALLA', value: data.talla, style: 'narrow' },
  ]

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header fixed — se repite en cada página */}
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader
              medico={medico}
              colors={colors}
              logoUrl={logoUrl}
              folio={data.folio}
              fecha={data.fecha}
              compact
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} />
        </View>

        <View style={{ flex: 1 }}>
          {/* Title */}
          <View style={s.tituloWrap}>
            <Text style={s.tituloText}>Nota de Evolución Médica</Text>
          </View>

          {/* Patient data */}
          <View style={s.patientGrid}>
            {patientFields
              .filter((f) => f.value)
              .map((f) => (
                <View
                  key={f.label}
                  style={f.style === 'wide' ? s.patientCellWide : s.patientCellNarrow}
                >
                  <Text style={baseStyles.datoLabel}>{f.label}</Text>
                  <Text style={baseStyles.datoValor}>{f.value}</Text>
                </View>
              ))}
          </View>

          {/* Content */}
          <View style={s.contentWrap}>{renderContenido()}</View>

          {/* Terapeutica table */}
          {data.terapeutica && data.terapeutica.length > 0 ? (
            <View style={s.tableWrap}>
              <Text style={s.tableSectionHeader}>Terapéutica</Text>
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableHeaderCell, s.colMed]}>Medicamento</Text>
                <Text style={[s.tableHeaderCell, s.colDosis]}>Dosis</Text>
                <Text style={[s.tableHeaderCell, s.colFrec]}>Frecuencia</Text>
                <Text style={[s.tableHeaderCell, s.colDur]}>Duración</Text>
              </View>
              {data.terapeutica.map((med, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, s.colMed]}>{med.medicamento}</Text>
                  <Text style={[s.tableCell, s.colDosis]}>{med.dosis}</Text>
                  <Text style={[s.tableCell, s.colFrec]}>{med.frecuencia}</Text>
                  <Text style={[s.tableCell, s.colDur]}>{med.duracion}</Text>
                </View>
              ))}
            </View>
          ) : null}

        </View>

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
      </Page>
    </Document>
  )
}
