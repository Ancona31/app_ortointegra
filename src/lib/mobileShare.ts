/**
 * En desktop: abre ventana emergente y dispara el diálogo de impresión.
 * En móvil:   convierte imágenes a base64, envía el HTML a /api/generar-pdf
 *             (Puppeteer en Vercel) y comparte el PDF vectorial resultante.
 */

/** Convierte todas las imágenes externas del HTML a base64 data URLs.
 *  Necesario porque Puppeteer en Vercel no puede acceder a URLs de Supabase
 *  Storage que requieren sesión o tienen restricciones CORS desde el servidor.
 */
async function inlineImages(html: string): Promise<string> {
  const srcPattern = /src="(https?:\/\/[^"]+)"/g
  const urls = new Set<string>()

  let m
  while ((m = srcPattern.exec(html)) !== null) urls.add(m[1])

  const replacements = new Map<string, string>()
  await Promise.all([...urls].map(async (url) => {
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const b64  = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror  = reject
        reader.readAsDataURL(blob)
      })
      replacements.set(url, b64)
    } catch {
      // Si falla la carga, se deja la URL original
    }
  }))

  return html.replace(/src="(https?:\/\/[^"]+)"/g, (_, url) =>
    `src="${replacements.get(url) ?? url}"`
  )
}

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

  // ── Móvil: inline images → PDF vectorial vía Puppeteer ──
  const htmlConImagenes = await inlineImages(html)

  const res = await fetch('/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlConImagenes, filename }),
  })

  if (!res.ok) {
    alert('No se pudo generar el PDF. Verifica tu conexión e intenta de nuevo. Si el problema persiste, intenta desde una computadora.')
    return
  }

  const pdfBlob = await res.blob()
  const file    = new File([pdfBlob], filename, { type: 'application/pdf' })

  if (
    typeof navigator.share    === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title: filename.replace('.pdf', '') })
  } else {
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
