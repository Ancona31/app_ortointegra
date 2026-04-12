'use client'

/**
 * ChunkMissingListener — escucha el evento custom 'spinus:chunk-missing'
 * disparado por el synthetic fallback del Service Worker cuando un chunk
 * JavaScript no está disponible en cache y no hay red.
 *
 * En lugar de que Webpack runtime lance un ChunkLoadError fatal, el SW
 * devuelve un stub JS que dispara este evento. El listener captura la
 * señal y muestra un toast amigable al usuario.
 *
 * Throttle: máximo 1 toast cada 10 segundos para evitar spam si hay
 * múltiples chunks faltantes en una misma ruta.
 *
 * Componente sin renderizado visible (retorna null).
 */

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'

const THROTTLE_MS = 10_000

export default function ChunkMissingListener() {
  const toast = useToast()
  const lastShownRef = useRef(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url?: string } | undefined

      // Throttle: max 1 toast cada 10s. Los siguientes eventos dentro de
      // la ventana siguen logueándose en consola para debugging.
      const now = Date.now()
      if (now - lastShownRef.current < THROTTLE_MS) {
        // eslint-disable-next-line no-console
        console.warn('[Spinus] chunk missing (throttled):', detail?.url)
        return
      }
      lastShownRef.current = now

      toast.warning(
        'Módulo no disponible offline. Conéctate para descargarlo por primera vez.',
      )
      // eslint-disable-next-line no-console
      console.warn('[Spinus] chunk missing:', detail?.url)
    }

    window.addEventListener('spinus:chunk-missing', handler)
    return () => window.removeEventListener('spinus:chunk-missing', handler)
  }, [toast])

  return null
}
