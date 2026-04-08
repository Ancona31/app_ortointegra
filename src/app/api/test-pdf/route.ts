import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { renderSolicitudLab } from '@/lib/pdf/SolicitudLabPdf'
import type { SolicitudLabData } from '@/lib/pdf/SolicitudLabPdf'
import type { PdfMedicoData } from '@/lib/pdf/PdfStyles'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { medico, data, logoUrl } = await req.json() as {
      medico: PdfMedicoData
      data: SolicitudLabData
      logoUrl?: string
    }

    const pdfBuffer = await renderToBuffer(
      renderSolicitudLab({ medico, data, logoUrl })
    )

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="solicitud-laboratorio.pdf"',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[test-pdf] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
