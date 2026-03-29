/**
 * En desktop: abre ventana emergente y dispara el diálogo de impresión.
 * En móvil:   envía el HTML a /api/generar-pdf (Puppeteer en Vercel),
 *             recibe el PDF vectorial y lo comparte vía Web Share API.
 */
export async function imprimirOCompartir(html: string, filename = 'documento.pdf') {
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768

  if (!isMobile) {
    // ── Desktop: comportamiento original ──
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
    return
  }

  // ── Móvil: PDF vectorial vía Puppeteer en servidor ──
  const res = await fetch('/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  })

  if (!res.ok) {
    alert('Error al generar el PDF. Intenta de nuevo.')
    return
  }

  const pdfBlob = await res.blob()
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

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
}
