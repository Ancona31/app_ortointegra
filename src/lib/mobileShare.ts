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

  // Montamos el HTML en un contenedor oculto fuera de la pantalla
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;top:-99999px;left:-99999px;width:816px;background:#fff;'
  // Incluimos <style> y <link> del <head> para que los estilos se apliquen
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  const linkMatches = html.match(/<link[^>]+>/gi) || []
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html
  // Eliminamos elementos con position:fixed (marca de agua) ya que se sale del contenedor
  const cleanBody = bodyContent.replace(/<img[^>]+class="watermark"[^>]*>/gi, '')
  container.innerHTML = linkMatches.join('\n') + styleMatches.join('\n') + cleanBody
  document.body.appendChild(container)

  try {
    const opt = {
      margin:      0,
      filename,
      image:       { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF:       { unit: 'mm', format: 'letter', orientation: 'portrait' },
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
    document.body.removeChild(container)
  }
}
