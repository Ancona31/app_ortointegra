/**
 * En desktop: abre ventana emergente y dispara el diálogo de impresión.
 * En móvil:   genera un PDF y lo comparte vía Web Share API o lo descarga.
 */
export async function imprimirOCompartir(html: string, filename = 'documento.pdf') {
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768

  if (!isMobile) {
    // ── Desktop: comportamiento existente ──
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
    return
  }

  // ── Móvil: generar PDF con html2canvas + jsPDF directamente ──
  // Usamos las librerías directamente en vez del wrapper html2pdf para
  // tener control total. El container debe estar VISIBLE y sin nada encima
  // para que html2canvas lo capture correctamente.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2canvas = (await import('html2canvas' as any)).default
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = await import('jspdf' as any)

  // Badge de carga en esquina inferior — EXCLUIDO de la captura via ignoreElements
  const badge = document.createElement('div')
  badge.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:10000', 'background:#1a3a5c', 'color:#fff',
    'padding:10px 24px', 'border-radius:24px',
    'font-family:Arial,sans-serif', 'font-size:14px', 'font-weight:500',
    'pointer-events:none', 'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
  ].join(';')
  badge.textContent = 'Generando PDF…'

  // Container al máximo z-index, sin nada encima — html2canvas captura directo
  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:816px',
    'background:#fff', 'z-index:9999',
  ].join(';')

  // Extraemos <style> y <link> del <head> para que los estilos apliquen
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  const linkMatches  = html.match(/<link[^>]+stylesheet[^>]*>/gi) || []
  const bodyMatch    = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent  = bodyMatch ? bodyMatch[1] : html
  // Eliminamos marca de agua (position:fixed que escapa del container)
  const cleanBody    = bodyContent.replace(/<img[^>]+class="watermark"[^>]*>/gi, '')
  container.innerHTML = linkMatches.join('\n') + styleMatches.join('\n') + cleanBody

  document.body.appendChild(badge)
  document.body.appendChild(container)

  // Esperar a que el browser aplique estilos y compute el layout
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  await new Promise(resolve => setTimeout(resolve, 400))

  try {
    const canvas = await html2canvas(container, {
      scale:          1.5,
      useCORS:        true,
      logging:        false,
      windowWidth:    816,
      scrollX:        0,
      scrollY:        0,
      // Excluimos el badge de carga para que no aparezca en el PDF
      ignoreElements: (el: Element) => el === badge,
    })

    const imgData   = canvas.toDataURL('image/jpeg', 0.95)
    const pdf       = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' })
    const pageW     = pdf.internal.pageSize.getWidth()
    const pageH     = pdf.internal.pageSize.getHeight()
    const imgH      = (canvas.height * pageW) / canvas.width

    // Soporte multi-página
    let posY = 0
    pdf.addImage(imgData, 'JPEG', 0, posY, pageW, imgH)
    let remaining = imgH - pageH
    while (remaining > 0) {
      posY -= pageH
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, posY, pageW, imgH)
      remaining -= pageH
    }

    const pdfBlob = pdf.output('blob') as Blob
    const file    = new File([pdfBlob], filename, { type: 'application/pdf' })

    // Web Share API (iOS Safari 15+, Android Chrome 86+)
    if (
      typeof navigator.share    === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: filename.replace('.pdf', '') })
    } else {
      // Fallback: descarga directa
      const url = URL.createObjectURL(pdfBlob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } finally {
    document.body.removeChild(container)
    document.body.removeChild(badge)
  }
}
