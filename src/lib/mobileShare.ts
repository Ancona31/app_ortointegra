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

  // ── Móvil: generar PDF ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (await import('html2pdf.js' as any)).default

  // CRÍTICO: el container debe ser hermano del overlay, NO hijo.
  // Si está dentro de un elemento con opacity:0, hereda esa opacidad
  // y html2canvas captura todo en blanco.
  //
  // El overlay cubre la pantalla para que el usuario no vea el contenido.
  // El container está detrás (z-index menor) pero html2canvas lo captura
  // directamente por subtree, sin verse afectado por el overlay encima.
  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:#fff;pointer-events:none;'

  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;top:0;left:0;width:816px;background:#fff;z-index:9998;'

  // Extraemos <style> del <head> — necesarios para que apliquen los estilos
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html
  // Eliminamos marca de agua (position:fixed que escapa al container)
  const cleanBody = bodyContent.replace(/<img[^>]+class="watermark"[^>]*>/gi, '')
  container.innerHTML = styleMatches.join('\n') + cleanBody

  // Overlay primero (encima), container después (debajo)
  document.body.appendChild(overlay)
  document.body.appendChild(container)

  // Esperamos a que el browser compute el layout y aplique estilos
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  await new Promise(resolve => setTimeout(resolve, 300))

  try {
    const opt = {
      margin:      0,
      filename,
      image:       { type: 'jpeg', quality: 0.97 },
      html2canvas: {
        scale:       2,
        useCORS:     true,
        allowTaint:  true,
        logging:     false,
        windowWidth: 816,
      },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
    }

    const pdfBlob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    const file = new File([pdfBlob], filename, { type: 'application/pdf' })

    // Web Share API (iOS Safari 15+, Android Chrome 86+)
    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: filename.replace('.pdf', '') })
    } else {
      // Fallback: descarga directa
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } finally {
    document.body.removeChild(overlay)
    document.body.removeChild(container)
  }
}
