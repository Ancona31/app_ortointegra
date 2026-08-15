'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // El SDK se carga dinámicamente A PROPÓSITO. NO lo vuelvas a importar
    // estáticamente: este archivo pertenece al segmento raíz, así que un
    // `import` estático mete `@sentry/nextjs` —que en servidor resuelve a
    // `@sentry/node` con todo OpenTelemetry detrás— en el grafo de servidor de
    // TODAS las rutas, y se paga en cada arranque en frío. Medido: ~2.4 MB de
    // chunks de servidor por ruta. El reporte del error no cambia.
    async function reportar(): Promise<void> {
      try {
        const Sentry = await import('@sentry/nextjs')
        Sentry.captureException(error)
      } catch {
        // Si el SDK no carga (chunk perdido, sin red) no hay nada que hacer:
        // ya estamos en la pantalla de error global, el peor caso posible.
      }
    }
    void reportar()
  }, [error])

  return (
    <html lang="es">
      <body className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-[#1a3a5c] mb-2">Algo salió mal</h2>
          <p className="text-sm text-slate-500 mb-6">
            Se ha producido un error inesperado. El equipo técnico ha sido notificado automáticamente.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
