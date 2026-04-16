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

/** Genera PDF 100% en el cliente — sin servidor, sin delay, sin popup blocker */
export async function generarPdf(params: {
  tipo: string
  medico: PdfMedicoData | null
  data: Record<string, unknown>
  logoUrl?: string
  filename?: string
}): Promise<void> {
  // Guard de concurrencia: ignorar multi-clics
  if (isGenerating) {
    // eslint-disable-next-line no-console
    console.warn('[generarPdf] ya hay una generación en curso — ignorando llamada duplicada')
    return
  }

  isGenerating = true
  const { tipo, medico, data, logoUrl, filename } = params
  const defaultFilename = `${tipo.replace(/_/g, '-')}.pdf`

  // Variable de fase para diagnosticar exactamente dónde falla
  let phase = 'inicio'

  try {
    // eslint-disable-next-line no-console
    console.log('[generarPdf] 1/5 inicio — tipo:', tipo)

    // ── Fase 1: resolver logo ──
    // Si hay URL https del logo personalizado → convertir a Base64 data URL
    // para que @react-pdf/renderer lo embeba sin depender de CORS/red.
    // Si no hay logo o la URL no es https → fallback al logo de Spinus.
    phase = 'resolviendo logo'
    let effectiveLogoUrl: string | undefined = undefined

    if (logoUrl && logoUrl.startsWith('https://')) {
      try {
        const res = await fetch(logoUrl)
        if (res.ok) {
          const blob = await res.blob()
          effectiveLogoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }
      } catch {
        // Fetch falló (red, CORS, URL rota) → caer al fallback
      }
    }

    // Fallback: logo de Spinus en Base64 si no se pudo resolver el personalizado
    if (!effectiveLogoUrl) {
      const { LOGO_BASE64 } = await import('@/lib/pdf/logo')
      effectiveLogoUrl = LOGO_BASE64
    }

    // ── Fase 2: construir elemento react-pdf ──
    phase = 'construyendo elemento react-pdf'
    const element = await buildClientElement(tipo, medico, data, effectiveLogoUrl)
    if (!element) {
      throw new Error(`Tipo de documento no válido: ${tipo}`)
    }
    // eslint-disable-next-line no-console
    console.log('[generarPdf] 2/5 elemento construido')

    // ── Fase 3: renderizar a blob ──
    phase = 'renderizando PDF'
    const { generatePdfClient } = await import('@/lib/pdfClientFallback')
    const rawBlob = await generatePdfClient(element)

    // ── Fase 4: blindar MIME type ──
    phase = 'blindando MIME type'
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
    // eslint-disable-next-line no-console
    console.log('[generarPdf] 3/5 blob generado — size:', pdfBlob.size, 'bytes, type:', pdfBlob.type)

    // ── Fase 5: disparar entrega ──
    phase = 'disparando entrega'
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768

    // eslint-disable-next-line no-console
    console.log('[generarPdf] 4/5 disparando:', isMobile ? 'mobile (share)' : 'desktop (download)')

    const finalName = filename ?? defaultFilename
    if (isMobile) {
      await compartirODescargar(pdfBlob, finalName)
    } else {
      descargarBlob(pdfBlob, finalName)
    }

    // eslint-disable-next-line no-console
    console.log('[generarPdf] 5/5 completado')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[generarPdf] falló en fase "${phase}":`, err)
    throw new Error('No se pudo generar el PDF.')
  } finally {
    // Siempre liberar el guard, incluso en error
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
