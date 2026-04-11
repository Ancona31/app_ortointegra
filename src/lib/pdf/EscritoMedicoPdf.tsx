import React, { type ReactElement } from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData, PdfColors } from './PdfStyles'

export interface EscritoMedicoData {
  paciente?: string
  fecha: string
  asunto?: string
  cuerpo: string
  folio?: string
}

export interface EscritoMedicoProps {
  medico: PdfMedicoData | null
  data: EscritoMedicoData
  logoUrl?: string
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderEscritoMedico(props: EscritoMedicoProps) {
  return <EscritoMedicoPdf {...props} />
}

/* ---------- HTML parser simple ---------- */

interface HtmlSegment {
  tag: string
  content: string
}

function tokenizeHtml(html: string): HtmlSegment[] {
  const segments: HtmlSegment[] = []
  // Normalizar <br>, <br/>, <br /> a \n
  let cleaned = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '<hr>')

  // Regex para capturar bloques de tags conocidos + texto suelto
  const blockPattern =
    /<(h2|h3|p|div|ul|ol|li|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi
  const parts: string[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  // Primero dividir por <hr>
  const hrSplit = cleaned.split(/<hr>/gi)
  for (let hi = 0; hi < hrSplit.length; hi++) {
    if (hi > 0) {
      segments.push({ tag: 'hr', content: '' })
    }
    const chunk = hrSplit[hi]
    lastIdx = 0
    const regex = new RegExp(blockPattern.source, 'gi')
    while ((match = regex.exec(chunk)) !== null) {
      if (match.index > lastIdx) {
        const before = chunk.slice(lastIdx, match.index).trim()
        if (before) {
          segments.push({ tag: 'p', content: before })
        }
      }
      const tagName = match[1].toLowerCase()
      const inner = match[0]
        .replace(new RegExp(`^<${tagName}[^>]*>`, 'i'), '')
        .replace(new RegExp(`</${tagName}>$`, 'i'), '')
      segments.push({ tag: tagName, content: inner })
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < chunk.length) {
      const remaining = chunk.slice(lastIdx).trim()
      if (remaining) {
        segments.push({ tag: 'p', content: remaining })
      }
    }
  }

  return segments
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

interface InlineSegment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

function parseInline(html: string): InlineSegment[] {
  const result: InlineSegment[] = []
  // Simple approach: process inline tags one pass
  const inlineRegex = /<(b|strong|i|em|u)(?: [^>]*)?>([^<]*)<\/\1>/gi
  let lastIdx = 0
  let match: RegExpExecArray | null

  const source = html
  const regex = /<(b|strong|i|em|u)(?: [^>]*)?>([^<]*)<\/\1>/gi
  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIdx) {
      const plain = stripTags(source.slice(lastIdx, match.index))
      if (plain) result.push({ text: plain, bold: false, italic: false, underline: false })
    }
    const tag = match[1].toLowerCase()
    const content = match[2]
    result.push({
      text: content,
      bold: tag === 'b' || tag === 'strong',
      italic: tag === 'i' || tag === 'em',
      underline: tag === 'u',
    })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < source.length) {
    const plain = stripTags(source.slice(lastIdx))
    if (plain) result.push({ text: plain, bold: false, italic: false, underline: false })
  }

  return result.length > 0 ? result : [{ text: stripTags(html), bold: false, italic: false, underline: false }]
}

function parseHtmlToElements(html: string, colors: PdfColors): ReactElement[] {
  const segments = tokenizeHtml(html)
  const elements: ReactElement[] = []

  const _s = StyleSheet.create({
    bodyText: {
      fontSize: 10.5,
      color: '#1a1a1a',
      lineHeight: 1.75,
      textAlign: 'justify' as const,
    },
  })
  const bodyText = _s.bodyText

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    if (seg.tag === 'hr') {
      elements.push(
        <View
          key={`hr-${i}`}
          style={{ borderBottomWidth: 0.75, borderBottomColor: '#d1d5db', marginVertical: 10 }}
        />
      )
      continue
    }

    if (seg.tag === 'h2') {
      elements.push(
        <Text
          key={`h2-${i}`}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: colors.cp,
            marginTop: 14,
            marginBottom: 6,
            lineHeight: 1.4,
          }}
        >
          {stripTags(seg.content)}
        </Text>
      )
      continue
    }

    if (seg.tag === 'h3') {
      elements.push(
        <Text
          key={`h3-${i}`}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: colors.cp,
            marginTop: 10,
            marginBottom: 4,
            lineHeight: 1.4,
          }}
        >
          {stripTags(seg.content)}
        </Text>
      )
      continue
    }

    // Default: paragraph-like (p, div, li, blockquote, etc.)
    const inlines = parseInline(seg.content)
    const hasFormatting = inlines.some((il) => il.bold || il.italic || il.underline)

    if (!hasFormatting) {
      elements.push(
        <Text key={`p-${i}`} style={bodyText}>
          {stripTags(seg.content)}
        </Text>
      )
    } else {
      elements.push(
        <Text key={`p-${i}`} style={bodyText}>
          {inlines.map((il, j) => (
            <Text
              key={j}
              style={{
                fontWeight: il.bold ? 700 : 400,
                color: il.italic ? '#555' : '#1a1a1a',
                textDecoration: il.underline ? 'underline' : 'none',
              }}
            >
              {il.text}
            </Text>
          ))}
        </Text>
      )
    }
  }

  return elements
}

/* ---------- Component ---------- */

function buildStyles(_colors: PdfColors) {
  return StyleSheet.create({
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
    metaRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    asuntoBanner: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 4,
      marginBottom: 18,
    },
    asuntoText: {
      fontSize: 12,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
    },
    bodyWrap: {
      marginTop: 4,
    },
  })
}

export default function EscritoMedicoPdf({ medico, data, logoUrl }: EscritoMedicoProps) {
  const colors = getPdfColors(medico)
  const s = buildStyles(colors)
  const bodyElements = parseHtmlToElements(data.cuerpo, colors)

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

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
          {/* Meta: fecha + paciente */}
          <View style={s.metaRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
            {data.paciente ? (
              <View style={baseStyles.datoField}>
                <Text style={baseStyles.datoLabel}>PACIENTE</Text>
                <Text style={baseStyles.datoValor}>{data.paciente}</Text>
              </View>
            ) : null}
          </View>

          {/* Asunto */}
          {data.asunto ? (
            <View style={[s.asuntoBanner, { backgroundColor: colors.cp }]}>
              <Text style={[s.asuntoText, { color: contrastText(colors.cp) }]}>{data.asunto}</Text>
            </View>
          ) : null}

          {/* Cuerpo */}
          <View style={s.bodyWrap}>
            {bodyElements}
          </View>

        </View>

          {/* Firma */}
          <PdfFirma medico={medico} colors={colors} />
      </Page>
    </Document>
  )
}
