/**
 * Genera PDFs vía @react-pdf/renderer en el servidor.
 * Tanto desktop como móvil usan el mismo endpoint para PDFs consistentes.
 *
 * imprimirOCompartir() — legacy: abre ventana print en desktop, PDF en móvil
 * generarPdf()         — nuevo: genera PDF vía react-pdf en ambas plataformas
 */

import type { PdfMedicoData } from '@/lib/pdf/PdfStyles'

const PDF_TIMEOUT_MS = 30_000

async function fetchPdfConReintento(body: string): Promise<Blob | null> {
  for (let intento = 1; intento <= 2; intento++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS)

    try {
      const res = await fetch('/api/generar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 504 && intento === 1) continue

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const detail = json?.error ? `\n\nDetalle: ${json.error}` : ''
        alert(`No se pudo generar el PDF.${detail}`)
        return null
      }

      return await res.blob()
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (intento === 1) continue
        alert('El servidor tardó demasiado en generar el PDF. Intenta de nuevo.')
        return null
      }
      alert('Error de conexión al generar el PDF. Verifica tu red e intenta de nuevo.')
      return null
    }
  }
  return null
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

/** Genera PDF vía react-pdf en el servidor — funciona en desktop y móvil */
export async function generarPdf(params: {
  tipo: string
  medico: PdfMedicoData | null
  data: Record<string, unknown>
  logoUrl?: string
  filename?: string
}): Promise<void> {
  const { tipo, medico, data, logoUrl, filename } = params
  const defaultFilename = `${tipo.replace(/_/g, '-')}.pdf`
  const body = JSON.stringify({ tipo, medico, data, logoUrl })

  const pdfBlob = await fetchPdfConReintento(body)
  if (!pdfBlob) return

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768

  if (isMobile) {
    await compartirODescargar(pdfBlob, filename ?? defaultFilename)
  } else {
    // Desktop: abrir PDF en nueva pestaña
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
