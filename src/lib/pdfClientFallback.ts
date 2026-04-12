/**
 * Motor de PDF en el cliente con @react-pdf/renderer.
 *
 * Fuentes: 100% Base64 TTF embebido en el bundle (via dynamic import).
 * Sin URLs, sin fetch, sin HEAD requests, sin dependencia del Service Worker.
 * Universalmente soportado en Chromium, WebKit (Mac/iOS) y Firefox.
 */
'use client'

import { pdf, Font, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

let fontsRegistered = false

async function registerFontsWithFallback(): Promise<void> {
  if (fontsRegistered) return

  // Desactivar hyphenation — corrompe caracteres acentuados (é, ó, ñ, etc.)
  Font.registerHyphenationCallback(word => [word])

  // Cargar fuentes Base64 TTF con dynamic import para no inflar el bundle inicial
  const { ROBOTO_FONTS } = await import('@/lib/pdf/fonts')
  Font.register({ family: 'Roboto', fonts: ROBOTO_FONTS })
  fontsRegistered = true
}

/**
 * No-op: las fuentes del PDF ahora son 100% Base64 embebido.
 * Se mantiene exportada para compatibilidad con `/inicio/page.tsx`.
 */
export async function precacheFonts(): Promise<void> {
  // Intencionalmente vacío — las fuentes del PDF no requieren pre-cache en CacheStorage
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
