'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
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
