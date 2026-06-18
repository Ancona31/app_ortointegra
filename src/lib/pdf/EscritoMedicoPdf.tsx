import React, { type ReactElement } from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { JSONContent } from '@tiptap/core'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData, PdfColors, PdfConsultorioData } from './PdfStyles'
import { decodificarEntidadesHTML } from '@/lib/textUtils'

export interface EscritoMedicoData {
  paciente?: string
  fecha: string
  asunto?: string
  cuerpo: string
  // Phase 2: campo persistido pero NO leído por este renderer todavía.
  // Phase 3 reescribe el parser para consumir `doc` directamente.
  doc?: { schema: 'tiptap-doc-v1'; content: JSONContent }
  folio?: string
}

export interface EscritoMedicoProps {
  medico: PdfMedicoData | null
  data: EscritoMedicoData
  logoUrl?: string
  consultorio?: PdfConsultorioData
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
          {decodificarEntidadesHTML(stripTags(seg.content))}
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
          {decodificarEntidadesHTML(stripTags(seg.content))}
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
          {decodificarEntidadesHTML(stripTags(seg.content))}
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
              {decodificarEntidadesHTML(il.text)}
            </Text>
          ))}
        </Text>
      )
    }
  }

  return elements
}

/* ---------- TipTap JSON renderer (Phase 3) ---------- */

type ProseNode = JSONContent
type ProseMarks = JSONContent['marks']

interface InlineStyle {
  fontWeight?: number
  fontStyle?: 'italic'
  textDecoration?: 'underline'
}

interface RenderCtx {
  colors: PdfColors
  bodyStyle: { fontSize: number; color: string; lineHeight: number; textAlign: 'justify' }
}

function marksToStyle(marks: ProseMarks): InlineStyle {
  const style: InlineStyle = {}
  if (!marks) return style
  for (const m of marks) {
    if (m.type === 'bold') style.fontWeight = 700
    else if (m.type === 'italic') style.fontStyle = 'italic'
    else if (m.type === 'underline') style.textDecoration = 'underline'
  }
  return style
}

function getTextAlign(attrs: ProseNode['attrs']): 'left' | 'center' | 'right' | 'justify' | undefined {
  const a = attrs?.textAlign
  if (a === 'left' || a === 'center' || a === 'right' || a === 'justify') return a
  return undefined
}

function renderInlineChildren(
  nodes: ProseNode[] | undefined,
  keyPrefix: string,
): Array<ReactElement | string> {
  const out: Array<ReactElement | string> = []
  if (!nodes) return out
  nodes.forEach((n, i) => {
    if (n.type === 'text') {
      const decoded = decodificarEntidadesHTML(n.text ?? '')
      const style = marksToStyle(n.marks)
      const hasMarks = Object.keys(style).length > 0
      if (hasMarks) {
        out.push(
          <Text key={`${keyPrefix}-t-${i}`} style={style as Style}>
            {decoded}
          </Text>,
        )
      } else {
        out.push(decoded)
      }
    } else if (n.type === 'hardBreak') {
      out.push('\n')
    }
  })
  return out
}

function renderParagraph(node: ProseNode, key: string, ctx: RenderCtx): ReactElement {
  const align = getTextAlign(node.attrs)
  return (
    <Text key={key} style={align ? { ...ctx.bodyStyle, textAlign: align } : ctx.bodyStyle}>
      {renderInlineChildren(node.content, key)}
    </Text>
  )
}

function renderHeading(node: ProseNode, key: string, ctx: RenderCtx): ReactElement {
  const rawLevel = node.attrs?.level
  const level: 1 | 2 | 3 = rawLevel === 1 || rawLevel === 3 ? rawLevel : 2
  const sizeByLevel = { 1: 18, 2: 14, 3: 12 } as const
  const marginTopByLevel = { 1: 16, 2: 14, 3: 10 } as const
  const marginBottomByLevel = { 1: 8, 2: 6, 3: 4 } as const
  const align = getTextAlign(node.attrs)
  return (
    <Text
      key={key}
      style={{
        fontSize: sizeByLevel[level],
        fontWeight: 700,
        color: ctx.colors.cp,
        marginTop: marginTopByLevel[level],
        marginBottom: marginBottomByLevel[level],
        lineHeight: 1.4,
        ...(align ? { textAlign: align } : {}),
      }}
    >
      {renderInlineChildren(node.content, key)}
    </Text>
  )
}

function renderListItem(
  item: ProseNode,
  marker: string,
  ctx: RenderCtx,
  depth: number,
  itemKey: string,
): ReactElement {
  return (
    <View key={itemKey} style={{ flexDirection: 'row', marginLeft: depth * 14, marginBottom: 2 }}>
      <Text style={{ ...ctx.bodyStyle, width: 22, textAlign: 'left' }}>{marker}</Text>
      <View style={{ flex: 1 }}>
        {(item.content ?? [])
          .map((child, i) => renderNode(child, `${itemKey}-c-${i}`, ctx, depth + 1))
          .filter((el): el is ReactElement => el !== null)}
      </View>
    </View>
  )
}

function renderList(
  node: ProseNode,
  key: string,
  ctx: RenderCtx,
  depth: number,
  ordered: boolean,
): ReactElement {
  const start = ordered ? Number(node.attrs?.start ?? 1) : 0
  const items = node.content ?? []
  return (
    <View key={key} style={{ marginVertical: 4 }}>
      {items.map((item, i) => {
        const marker = ordered ? `${start + i}.` : '•'
        return renderListItem(item, marker, ctx, depth, `${key}-i-${i}`)
      })}
    </View>
  )
}

function renderNode(node: ProseNode, key: string, ctx: RenderCtx, depth = 0): ReactElement | null {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node, key, ctx)
    case 'heading':
      return renderHeading(node, key, ctx)
    case 'bulletList':
      return renderList(node, key, ctx, depth, false)
    case 'orderedList':
      return renderList(node, key, ctx, depth, true)
    case 'horizontalRule':
      return (
        <View
          key={key}
          style={{ borderBottomWidth: 0.75, borderBottomColor: '#d1d5db', marginVertical: 10 }}
        />
      )
    default:
      return null
  }
}

function renderTipTapDoc(doc: JSONContent, colors: PdfColors): ReactElement[] {
  const ctx: RenderCtx = {
    colors,
    bodyStyle: { fontSize: 10.5, color: '#1a1a1a', lineHeight: 1.75, textAlign: 'justify' },
  }
  const top = doc.content ?? []
  return top
    .map((n, i) => renderNode(n, `n-${i}`, ctx, 0))
    .filter((el): el is ReactElement => el !== null)
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

export default function EscritoMedicoPdf({ medico, data, logoUrl, consultorio }: EscritoMedicoProps) {
  const colors = getPdfColors(medico)
  const s = buildStyles(colors)
  const bodyElements = data.doc?.schema === 'tiptap-doc-v1'
    ? renderTipTapDoc(data.doc.content, colors)
    : parseHtmlToElements(data.cuerpo, colors)

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
              consultorio={consultorio}
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
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
                <Text style={baseStyles.datoValor}>{decodificarEntidadesHTML(data.paciente)}</Text>
              </View>
            ) : null}
          </View>

          {/* Asunto */}
          {data.asunto ? (
            <View style={[s.asuntoBanner, { backgroundColor: colors.cp }]}>
              <Text style={[s.asuntoText, { color: contrastText(colors.cp) }]}>{decodificarEntidadesHTML(data.asunto)}</Text>
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
