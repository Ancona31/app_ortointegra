import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import DOMPurify from 'isomorphic-dompurify'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Configuración de DOMPurify para PDFs médicos:
// Permite estilos inline y estructura HTML necesaria para documentos,
// pero bloquea scripts, iframes, event handlers y cualquier vector de XSS/SSRF.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'html', 'head', 'body', 'meta', 'title', 'style',
    'div', 'span', 'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small',
    'img', 'a',
    'header', 'footer', 'section', 'article', 'nav', 'main',
    'blockquote', 'pre', 'code',
    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g',
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'id', 'width', 'height', 'align', 'valign',
    'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border',
    'src', 'alt', 'href', 'target', 'rel',
    'role', 'aria-label', 'aria-hidden',
    'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r',
    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select', 'link'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  WHOLE_DOCUMENT: true,
}

// Sanitiza filename para evitar path traversal
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ._\- ]/g, '').slice(0, 100) || 'documento.pdf'
}

export async function POST(req: NextRequest) {
  // Verificar autenticación
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { html, filename = 'documento.pdf' } = await req.json()
  if (!html) {
    return NextResponse.json({ error: 'HTML requerido' }, { status: 400 })
  }

  const safeName = safeFilename(filename)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  logAudit({ userId: user.id, accion: 'generar_pdf', ip, descripcion: safeName })

  // Sanitizar HTML con DOMPurify antes de pasarlo a Puppeteer
  // Previene XSS, SSRF y ejecución de código arbitrario
  const cleanHtml = DOMPurify.sanitize(html, PURIFY_CONFIG)

  let browser = null
  try {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteer = (await import('puppeteer-core')).default

    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    )

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()

    // SSRF protection: interceptar requests y bloquear URLs externas
    // Solo permitir data: URIs (imágenes inline) y about:blank
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('data:') || url === 'about:blank') {
        request.continue()
      } else {
        // Bloquear cualquier request a URLs externas o internas
        request.abort('blockedbyclient')
      }
    })

    await page.setContent(cleanHtml, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // preferCSSPageSize respeta las reglas @page del HTML (márgenes, tamaño)
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
    })

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}"`,
      },
    })
  } finally {
    if (browser) await browser.close()
  }
}
