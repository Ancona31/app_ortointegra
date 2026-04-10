/**
 * Fallback: genera PDFs en el CLIENTE con @react-pdf/renderer.
 * Se usa cuando el servidor no responde en 5s.
 *
 * Las fuentes Roboto se registran por URL (no path.join)
 * y se precachean al iniciar sesión.
 */
'use client'

import { pdf, Font, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

let fontsRegistered = false

const FONT_URLS = [
  { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 as const },
  { src: '/fonts/Roboto-Medium.ttf', fontWeight: 500 as const },
  { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 as const },
  { src: '/fonts/Roboto-Italic.ttf', fontWeight: 400 as const, fontStyle: 'italic' as const },
]

function registerFonts() {
  if (fontsRegistered) return
  Font.register({ family: 'Roboto', fonts: FONT_URLS })
  fontsRegistered = true
}

/** Precarga las fuentes en el Cache API del browser */
export async function precacheFonts(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const cache = await caches.open('spinus-pdf-fonts-v1')
    const urls = FONT_URLS.map(f => f.src)

    for (const url of urls) {
      const cached = await cache.match(url)
      if (!cached) {
        const res = await fetch(url)
        if (res.ok) await cache.put(url, res)
      }
    }
  } catch {
    // Cache API no disponible — las fuentes se cargarán por red
  }
}

/** Genera un PDF blob en el cliente a partir de un componente react-pdf */
export async function generatePdfClient(element: ReactElement<DocumentProps>): Promise<Blob> {
  registerFonts()
  const doc = pdf(element)
  return doc.toBlob()
}
