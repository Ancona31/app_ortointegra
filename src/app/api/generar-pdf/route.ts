import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  logAudit({ userId: user.id, accion: 'generar_pdf', ip, descripcion: filename })

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

    // Cargamos el HTML completo — Puppeteer lo renderiza igual que Chrome
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 })

    // preferCSSPageSize respeta las reglas @page del HTML (márgenes, tamaño)
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
    })

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } finally {
    if (browser) await browser.close()
  }
}
