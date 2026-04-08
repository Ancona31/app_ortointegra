import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import type { PdfMedicoData } from '@/lib/pdf/PdfStyles'
import { renderSolicitudLab } from '@/lib/pdf/SolicitudLabPdf'
import { renderSolicitudImagen } from '@/lib/pdf/SolicitudImagenPdf'
import { renderReceta } from '@/lib/pdf/RecetaPdf'
import { renderPlanSuplementacion } from '@/lib/pdf/PlanSuplementacionPdf'
import { renderNotaHonorarios } from '@/lib/pdf/NotaHonorariosPdf'
import { renderSolicitudInternamiento } from '@/lib/pdf/SolicitudInternamientoPdf'
import { renderEscritoMedico } from '@/lib/pdf/EscritoMedicoPdf'
import { renderConsentimiento } from '@/lib/pdf/ConsentimientoInformadoPdf'
import { renderNotaEvolucion } from '@/lib/pdf/NotaEvolucionPdf'

export const dynamic = 'force-dynamic'

type DocType =
  | 'solicitud_lab'
  | 'solicitud_imagen'
  | 'receta'
  | 'plan_suplementacion'
  | 'nota_honorarios'
  | 'solicitud_internamiento'
  | 'escrito_medico'
  | 'consentimiento_informado'
  | 'nota_evolucion'

const RENDERERS: Record<DocType, (props: { medico: PdfMedicoData | null; data: Record<string, unknown>; logoUrl?: string }) => React.ReactElement> = {
  solicitud_lab: (p) => renderSolicitudLab({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  solicitud_imagen: (p) => renderSolicitudImagen({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  receta: (p) => renderReceta({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  plan_suplementacion: (p) => renderPlanSuplementacion({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  nota_honorarios: (p) => renderNotaHonorarios({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  solicitud_internamiento: (p) => renderSolicitudInternamiento({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  escrito_medico: (p) => renderEscritoMedico({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  consentimiento_informado: (p) => renderConsentimiento({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
  nota_evolucion: (p) => renderNotaEvolucion({ medico: p.medico, data: p.data as never, logoUrl: p.logoUrl }),
}

const FILENAMES: Record<DocType, string> = {
  solicitud_lab: 'solicitud-laboratorio.pdf',
  solicitud_imagen: 'solicitud-imagenologia.pdf',
  receta: 'receta-medica.pdf',
  plan_suplementacion: 'plan-suplementacion.pdf',
  nota_honorarios: 'nota-honorarios.pdf',
  solicitud_internamiento: 'solicitud-internamiento.pdf',
  escrito_medico: 'escrito-medico.pdf',
  consentimiento_informado: 'consentimiento-informado.pdf',
  nota_evolucion: 'nota-medica.pdf',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { tipo, medico, data, logoUrl } = await req.json() as {
      tipo: string
      medico: PdfMedicoData
      data: Record<string, unknown>
      logoUrl?: string
    }

    if (!tipo || !RENDERERS[tipo as DocType]) {
      return NextResponse.json({ error: `Tipo de documento no válido: ${tipo}` }, { status: 400 })
    }

    const docType = tipo as DocType
    const filename = FILENAMES[docType]

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    logAudit({ userId: user.id, accion: 'generar_pdf', ip, descripcion: filename })

    const element = RENDERERS[docType]({ medico, data, logoUrl })
    const pdfBuffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[generar-pdf] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
