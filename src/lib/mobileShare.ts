/**
 * Genera PDFs vía @react-pdf/renderer en el servidor.
 * Offline: genera directamente en el CLIENTE sin intentar el servidor.
 *
 * imprimirOCompartir() — legacy: abre ventana print en desktop, PDF en móvil
 * generarPdf()         — nuevo: genera PDF vía react-pdf en ambas plataformas
 */

import type { PdfMedicoData } from '@/lib/pdf/PdfStyles'
import { getStatus } from '@/lib/connectionMonitor'

const SERVER_TIMEOUT_MS = 5_000

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

async function fetchPdfConReintento(body: string): Promise<Blob | null> {
  for (let intento = 1; intento <= 2; intento++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS)

    try {
      const res = await fetch('/api/generar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 504 && intento === 1) continue
      if (!res.ok) return null

      return await res.blob()
    } catch {
      clearTimeout(timer)
      if (intento === 1) continue
      return null
    }
  }
  return null
}

/** Importa dinámicamente el renderer correcto y genera el elemento react-pdf */
async function buildClientElement(
  tipo: string,
  medico: PdfMedicoData | null,
  data: Record<string, unknown>,
  logoUrl?: string,
) {
  const props = { medico, data, logoUrl }

  switch (tipo as DocType) {
    case 'receta': {
      const { renderReceta } = await import('@/lib/pdf/RecetaPdf')
      return renderReceta({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'solicitud_lab': {
      const { renderSolicitudLab } = await import('@/lib/pdf/SolicitudLabPdf')
      return renderSolicitudLab({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'solicitud_imagen': {
      const { renderSolicitudImagen } = await import('@/lib/pdf/SolicitudImagenPdf')
      return renderSolicitudImagen({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'plan_suplementacion': {
      const { renderPlanSuplementacion } = await import('@/lib/pdf/PlanSuplementacionPdf')
      return renderPlanSuplementacion({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'nota_honorarios': {
      const { renderNotaHonorarios } = await import('@/lib/pdf/NotaHonorariosPdf')
      return renderNotaHonorarios({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'solicitud_internamiento': {
      const { renderSolicitudInternamiento } = await import('@/lib/pdf/SolicitudInternamientoPdf')
      return renderSolicitudInternamiento({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'escrito_medico': {
      const { renderEscritoMedico } = await import('@/lib/pdf/EscritoMedicoPdf')
      return renderEscritoMedico({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'consentimiento_informado': {
      const { renderConsentimiento } = await import('@/lib/pdf/ConsentimientoInformadoPdf')
      return renderConsentimiento({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    case 'nota_evolucion': {
      const { renderNotaEvolucion } = await import('@/lib/pdf/NotaEvolucionPdf')
      return renderNotaEvolucion({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl })
    }
    default:
      return null
  }
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function compartirODescargar(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename.replace('.pdf', '') })
      return
    } catch {
      // NotAllowedError: user gesture lost after async fetch
    }
  }
  descargarBlob(blob, filename)
}

/** Genera PDF — servidor si hay conexión, cliente directo si offline */
export async function generarPdf(params: {
  tipo: string
  medico: PdfMedicoData | null
  data: Record<string, unknown>
  logoUrl?: string
  filename?: string
}): Promise<void> {
  const { tipo, medico, data, logoUrl, filename } = params
  const defaultFilename = `${tipo.replace(/_/g, '-')}.pdf`

  let pdfBlob: Blob | null = null
  const offline = getStatus() === 'offline'

  // Si hay conexión, intentar servidor
  if (!offline) {
    const body = JSON.stringify({ tipo, medico, data, logoUrl })
    pdfBlob = await fetchPdfConReintento(body)
  }

  // Si no hay blob (offline o servidor falló), generar en el cliente
  if (!pdfBlob) {
    try {
      // Si está offline y el logo es URL externa, usar Base64
      let effectiveLogoUrl = logoUrl
      if (offline && (!logoUrl || logoUrl.startsWith('https://'))) {
        const { LOGO_BASE64 } = await import('@/lib/pdf/logo')
        effectiveLogoUrl = LOGO_BASE64
      }
      const element = await buildClientElement(tipo, medico, data, effectiveLogoUrl)
      if (element) {
        const { generatePdfClient } = await import('@/lib/pdfClientFallback')
        pdfBlob = await generatePdfClient(element)
      }
    } catch {
      // fallthrough to error
    }
  }

  if (!pdfBlob) {
    throw new Error('No se pudo generar el PDF.')
  }

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768

  if (isMobile) {
    await compartirODescargar(pdfBlob, filename ?? defaultFilename)
  } else {
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}

/**
 * Legacy: mantiene compatibilidad con formularios que aún envían HTML.
 * Desktop: abre ventana print. Móvil: no soportado (usar generarPdf).
 */
export async function imprimirOCompartir(html: string, _filename = 'documento.pdf') {
  const ventana = window.open('', '_blank', 'width=800,height=600')
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 500)
}
