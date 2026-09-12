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
          {/* ⚠️⚠️ SIN ESTA SALIDA LA PANTALLA ES UN CALLEJÓN, Y AQUÍ MÁS QUE EN
              NINGUNA OTRA. `reset()` vuelve a montar el mismo árbol: ante un
              fallo DETERMINISTA —datos que rompen un cálculo, un efecto que
              lanza siempre— vuelve a fallar y no hay tercer botón. Y esto
              sustituye el DOCUMENTO ENTERO, `<html>` incluido: no sobrevive el
              menú lateral, ni la barra de la agenda, ni ningún enlace de la
              aplicación. Sin esto, la única salida es escribir una URL a mano,
              que en la app instalada ni siquiera hay barra donde escribirla.
              Es la misma corrección que ya lleva `ErrorBoundary.tsx`, que cubre
              el piso de abajo —sólo `{children}` de `(app)`—; ésta cubre lo que
              se le escapa.

              ⚠️ ES UN `<a>` Y NO UN `<Link>`, POR LA MISMA RAZÓN QUE ALLÍ, y
              aquí es todavía más literal: `Link` navega del lado del cliente y
              reutiliza el árbol de React que acaba de romperse. Un `<a>` es una
              carga de documento entera — tira el árbol y empieza de cero, que
              es lo único sensato después de un error que nadie entiende.

              ⚠️ `/inicio` AUNQUE ESTA PANTALLA PUEDA SALIR SIN SESIÓN, y eso es
              lo que la hace buen destino en vez de un problema: `/inicio` NO
              está en la lista de rutas públicas de `src/middleware.ts`, así que
              sin cookie de sesión el middleware lo redirige él solo a `/login`.
              Un único destino que acierta en los dos casos —con sesión, la casa
              del usuario; sin ella, el sitio donde se entra— y sin una
              comprobación de sesión aquí dentro, que es lo último que conviene
              hacer en una pantalla que existe porque algo ya reventó.
              `/` sería más neutro y peor: dejaría al médico logueado en la
              página de marketing. */}
          <p className="mt-4">
            <a href="/inicio" className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors">
              Volver al inicio
            </a>
          </p>
        </div>
      </body>
    </html>
  )
}
