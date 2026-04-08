import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import sanitizeHtml from 'sanitize-html'

export const maxDuration = 180
export const dynamic = 'force-dynamic'

// Configuración de sanitize-html para PDFs médicos:
// Permite estilos inline y estructura HTML necesaria para documentos,
// pero bloquea scripts, iframes, event handlers y cualquier vector de XSS/SSRF.
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    '*': ['style', 'class', 'id', 'role', 'aria-label', 'aria-hidden'],
    table: ['width', 'height', 'align', 'cellpadding', 'cellspacing', 'border'],
    td: ['width', 'height', 'align', 'valign', 'colspan', 'rowspan'],
    th: ['width', 'height', 'align', 'valign', 'colspan', 'rowspan'],
    tr: ['align', 'valign'],
    col: ['width', 'span'],
    colgroup: ['span'],
    // onerror y onload en img: se usan para ocultar logos que no cargan.
    // No son vector de ataque en Puppeteer server-side (no hay usuario interactuando).
    img: ['src', 'alt', 'width', 'height', 'onerror', 'onload'],
    a: ['href', 'target', 'rel'],
    meta: ['charset', 'name', 'content'],
    svg: ['viewBox', 'xmlns', 'width', 'height'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'transform'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
    polyline: ['points', 'fill', 'stroke', 'stroke-width'],
    polygon: ['points', 'fill', 'stroke', 'stroke-width'],
    g: ['transform', 'fill', 'stroke'],
  },
  allowedSchemes: ['data', 'https'],
  // Necesario para permitir <style>, <html>, <head> (documento PDF completo)
  allowVulnerableTags: true,
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

  // Sanitizar HTML con sanitize-html antes de pasarlo a Puppeteer
  // Previene XSS, SSRF y ejecución de código arbitrario
  const cleanHtml = sanitizeHtml(html, SANITIZE_CONFIG)

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

    // SSRF protection: interceptar requests y bloquear URLs no confiables
    // Permitir: data: URIs (imágenes inline), about:blank, y Supabase Storage (logos)
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = request.url()
      if (
        url.startsWith('data:') ||
        url === 'about:blank' ||
        url.includes('.supabase.co/storage/')
      ) {
        request.continue()
      } else {
        request.abort('blockedbyclient')
      }
    })

    // networkidle0: esperar a que todas las imágenes (Supabase Storage) terminen de cargar
    await page.setContent(cleanHtml, { waitUntil: 'networkidle0', timeout: 30000 })

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[generar-pdf] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
