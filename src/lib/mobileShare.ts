/**
 * Genera PDFs 100% en el CLIENTE con @react-pdf/renderer.
 * Sin dependencia del servidor — funciona online y offline.
 *
 * Estrategia de entrega:
 *  - Desktop: descarga vía <a download> (sobrevive async sin popup blocker)
 *  - Mobile:  navigator.share con File (estándar iOS/Android)
 *  - Fallback móvil: descarga vía <a download>
 *
 * imprimirOCompartir() — legacy: abre ventana print en desktop
 * generarPdf()         — genera PDF vía react-pdf en todas las plataformas
 */

import type { PdfMedicoData } from '@/lib/pdf/PdfStyles'

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

/** Guard de concurrencia — evita ejecuciones paralelas por multi-clic */
let isGenerating = false

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

/**
 * Descarga el blob vía elemento <a download> oculto.
 * Este patrón es el único que sobrevive async work sin ser bloqueado
 * por popup blockers en Mac Chrome/Safari.
 */
function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Liberar memoria tras 1s (suficiente para que el browser procese)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Compartir en móvil con navigator.share (iOS/Android).
 * Fallback a descarga directa si share no está disponible o falla.
 */
async function compartirODescargar(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      // eslint-disable-next-line no-console
      console.log('[generarPdf] intentando navigator.share (iOS/Android)')
      await navigator.share({ files: [file], title: filename.replace('.pdf', '') })
      return
    } catch (err) {
      // NotAllowedError: user gesture perdido, o AbortError: usuario canceló
      // eslint-disable-next-line no-console
      console.warn('[generarPdf] navigator.share falló, fallback a descarga:', err)
    }
  }
  descargarBlob(blob, filename)
}

export interface GenerarPdfResult {
  blob: Blob
  storagePath: string | null
}

/**
 * Genera PDF 100% en el cliente.
 * Si se pasa pacienteId, sube el PDF a Supabase Storage (documentos-pdf)
 * y retorna el storagePath. Si el upload falla, retorna storagePath=null
 * pero el PDF se entrega al usuario normalmente.
 */
export async function generarPdf(params: {
  tipo: string
  medico: PdfMedicoData | null
  data: Record<string, unknown>
  logoUrl?: string
  filename?: string
  pacienteId?: string
}): Promise<GenerarPdfResult> {
  // Guard de concurrencia: ignorar multi-clics
  if (isGenerating) {
    console.warn('[generarPdf] ya hay una generación en curso — ignorando llamada duplicada')
    throw new Error('Generación en curso')
  }

  isGenerating = true
  const { tipo, medico, data, logoUrl, filename, pacienteId } = params
  const defaultFilename = `${tipo.replace(/_/g, '-')}.pdf`

  let phase = 'inicio'

  try {
    console.log('[generarPdf] 1/6 inicio — tipo:', tipo)

    // ── Fase 1: resolver logo ──
    phase = 'resolviendo logo'
    let effectiveLogoUrl: string | undefined = undefined

    if (logoUrl && logoUrl.startsWith('https://')) {
      try {
        const res = await fetch(logoUrl)
        if (res.ok) {
          const fetchedBlob = await res.blob()
          effectiveLogoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(fetchedBlob)
          })
        }
      } catch {
        // Fetch falló → fallback
      }
    }

    if (!effectiveLogoUrl) {
      const { LOGO_BASE64 } = await import('@/lib/pdf/logo')
      effectiveLogoUrl = LOGO_BASE64
    }

    // ── Fase 2: construir elemento react-pdf ──
    phase = 'construyendo elemento react-pdf'
    const element = await buildClientElement(tipo, medico, data, effectiveLogoUrl)
    if (!element) throw new Error(`Tipo de documento no válido: ${tipo}`)
    console.log('[generarPdf] 2/6 elemento construido')

    // ── Fase 3: renderizar a blob ──
    phase = 'renderizando PDF'
    const { generatePdfClient } = await import('@/lib/pdfClientFallback')
    const rawBlob = await generatePdfClient(element)

    // ── Fase 4: blindar MIME type ──
    phase = 'blindando MIME type'
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
    console.log('[generarPdf] 3/6 blob generado — size:', pdfBlob.size, 'bytes')

    // ── Fase 5: upload a Storage (si hay pacienteId) ──
    let storagePath: string | null = null
    if (pacienteId) {
      phase = 'subiendo a Storage'
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const finalName = filename ?? defaultFilename
        const path = `${pacienteId}/${finalName}`

        const { error: uploadError } = await supabase.storage
          .from('documentos-pdf')
          .upload(path, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadError) {
          console.error('[generarPdf] upload falló:', uploadError.message)
        } else {
          storagePath = path
          console.log('[generarPdf] 4/6 subido a Storage:', path)
        }
      } catch (storageErr) {
        console.error('[generarPdf] Storage error:', storageErr)
        // No lanzar — el PDF se entrega al usuario de todos modos
      }
    }

    // ── Fase 6: disparar entrega al usuario ──
    phase = 'disparando entrega'
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768

    const finalName = filename ?? defaultFilename
    if (isMobile) {
      await compartirODescargar(pdfBlob, finalName)
    } else {
      descargarBlob(pdfBlob, finalName)
    }

    console.log('[generarPdf] 6/6 completado', storagePath ? '(con Storage)' : '(sin Storage)')

    return { blob: pdfBlob, storagePath }
  } catch (err) {
    console.error(`[generarPdf] falló en fase "${phase}":`, err)
    throw new Error('No se pudo generar el PDF.')
  } finally {
    isGenerating = false
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
