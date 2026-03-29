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

  // El overlay cubre la pantalla para que el usuario no vea el contenido.
  // CRÍTICO: usamos ignoreElements para excluirlo del render de html2canvas.
  // Sin esto, el overlay blanco (z-index mayor) tapa el container y el PDF sale en blanco.
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:#fff', 'pointer-events:none',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';')
  overlay.innerHTML = '<p style="font-family:Arial,sans-serif;color:#1a3a5c;font-size:15px;font-weight:500;">Generando PDF…</p>'

  // Container dentro del viewport (position:fixed top:0 left:0) para que
  // html2canvas pueda capturar sus dimensiones reales.
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:#fff;z-index:9998;'

  // Extraemos <style> y <link> del <head> para que los estilos apliquen
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  const linkMatches  = html.match(/<link[^>]+stylesheet[^>]*>/gi) || []
  const bodyMatch    = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent  = bodyMatch ? bodyMatch[1] : html
  // Eliminamos marca de agua (position:fixed que escapa del container)
  const cleanBody    = bodyContent.replace(/<img[^>]+class="watermark"[^>]*>/gi, '')
  container.innerHTML = linkMatches.join('\n') + styleMatches.join('\n') + cleanBody

  document.body.appendChild(overlay)
  document.body.appendChild(container)

  // Esperar a que el browser aplique estilos, fuentes e imágenes
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  await new Promise(resolve => setTimeout(resolve, 500))

  try {
    const opt = {
      margin:  0,
      filename,
      image:   { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale:          1.5,          // 2 puede exceder límite de canvas en móvil
        useCORS:        true,         // para imágenes de Supabase Storage
        logging:        false,
        windowWidth:    816,
        scrollX:        0,
        scrollY:        0,
        // CRÍTICO: excluimos el overlay para que no tape el contenido capturado
        ignoreElements: (el: Element) => el === overlay,
      },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
    }

    const pdfBlob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    const file = new File([pdfBlob], filename, { type: 'application/pdf' })

    // Web Share API (iOS Safari 15+, Android Chrome 86+)
    if (
      typeof navigator.share   === 'function' &&
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
    document.body.removeChild(overlay)
    document.body.removeChild(container)
  }
}
