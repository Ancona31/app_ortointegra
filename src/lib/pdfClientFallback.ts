/**
 * Fallback: genera PDFs en el CLIENTE con @react-pdf/renderer.
 * Se usa cuando el servidor no responde en 5s.
 *
 * Las fuentes Roboto se cargan en este orden:
 * 1. URLs locales (/fonts/*.ttf) — rápido si están cacheadas por el SW
 * 2. Base64 embebido — fallback garantizado offline (dynamic import)
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

async function registerFontsWithFallback(): Promise<void> {
  if (fontsRegistered) return

  // Desactivar hyphenation — corrompe caracteres acentuados (é, ó, ñ, etc.)
  Font.registerHyphenationCallback(word => [word])

  // Verificar si las fuentes están disponibles (cache o red)
  try {
    const test = await fetch(FONT_URLS[0].src, { method: 'HEAD' })
    if (test.ok) {
      Font.register({ family: 'Roboto', fonts: FONT_URLS })
      fontsRegistered = true
      return
    }
  } catch {
    // Fuentes no disponibles por URL — usar Base64
  }

  // Fallback: cargar fuentes Base64 con dynamic import
  const { ROBOTO_FONTS } = await import('@/lib/pdf/fonts')
  Font.register({ family: 'Roboto', fonts: ROBOTO_FONTS })
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
    // Cache API no disponible — las fuentes se cargarán por Base64
  }
}

/** Genera un PDF blob en el cliente a partir de un componente react-pdf */
export async function generatePdfClient(element: ReactElement<DocumentProps>): Promise<Blob> {
  try {
    await registerFontsWithFallback()
  } catch (fontErr) {
    // eslint-disable-next-line no-console
    console.error('[generatePdfClient] Error registrando fuentes:', fontErr)
    throw new Error('Error en renderizado: fallo al cargar fuentes')
  }

  try {
    const doc = pdf(element)
    return await doc.toBlob()
  } catch (renderErr) {
    // eslint-disable-next-line no-console
    console.error('[generatePdfClient] Error en renderizado PDF:', renderErr)
    throw new Error(`Error en renderizado: ${renderErr instanceof Error ? renderErr.message : 'desconocido'}`)
  }
}
