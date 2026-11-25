'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { generateHTML } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { editorExtensions } from '@/lib/documentos/editorExtensions'

interface Props {
  doc?: { schema: 'tiptap-doc-v1'; content: JSONContent } | null
  cuerpo?: string | null
  className?: string
}

// `blockquote` y `start` entran con el rediseño del escrito: sin ellos la cita
// llegaba como párrafos sueltos y una numeración que empieza en 3 salía desde 1.
const ALLOWED_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'div', 'span', 'hr', 'ul', 'ol', 'li', 'blockquote']
const ALLOWED_ATTR = ['style', 'class', 'start']

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

export default function TipTapViewer({ doc, cuerpo, className }: Props) {
  const html = useMemo(() => {
    if (doc?.schema === 'tiptap-doc-v1') {
      return sanitize(generateHTML(doc.content, editorExtensions))
    }
    return cuerpo ? sanitize(cuerpo) : ''
  }, [doc, cuerpo])

  if (!html) return null

  return (
    <div
      className={className ?? 'tiptap-viewer text-sm text-slate-700 leading-relaxed'}
      style={{ fontFamily: 'Georgia, serif' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
