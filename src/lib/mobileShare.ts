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
  // Cargamos html2pdf de forma dinámica para no aumentar el bundle en desktop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (await import('html2pdf.js' as any)).default

  // El contenedor DEBE estar dentro del viewport para que html2canvas lo capture.
  // Usamos un overlay position:fixed con opacity:0 — mismo patrón que usa html2pdf
  // internamente en su worker.js. top:-99999px no funciona porque html2canvas
  // no puede obtener las dimensiones reales de elementos fuera del viewport.
  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;opacity:0;pointer-events:none;overflow:hidden;'

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;top:0;left:0;width:816px;background:#fff;'

  // Extraemos los <style> del <head> para que los estilos apliquen al contenido.
  // Los selectores body{} del CSS inyectado SOLAN al <body> real (que es ancestro
  // del container), así que la herencia CSS funciona correctamente.
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html
  // Eliminamos la marca de agua (usa position:fixed que escapa al container)
  const cleanBody = bodyContent.replace(/<img[^>]+class="watermark"[^>]*>/gi, '')
  container.innerHTML = styleMatches.join('\n') + cleanBody

  overlay.appendChild(container)
  document.body.appendChild(overlay)

  // Esperamos a que el browser aplique estilos y compute el layout completo
  // (2 animation frames + 300ms para fuentes e imágenes)
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
  }
}
