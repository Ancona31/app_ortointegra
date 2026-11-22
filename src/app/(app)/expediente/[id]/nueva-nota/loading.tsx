import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de la nota nueva (/expediente/[id]/nueva-nota).
 *
 * Calca el estado de Captura, que es el único con el que abre la página:
 * contenedor `max-w-7xl mx-auto`, la cabecera («‹ paciente», «Nueva nota» y la
 * línea de datos; rediseño B8, ya sin migas de pan) y la rejilla
 * de 5 columnas —3/5 para signos vitales y la Card Captura, 2/5 para el contexto
 * del paciente y el panel de documentos—. El estado de Cierre (nota guardada)
 * no se dibuja: solo se llega a él después de guardar.
 *
 * La tarjeta de captura empieza con la fila plegada «Signos vitales ›»
 * (SignosVitalesCard) y sigue con el dictado sin caja; debajo, el principal.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function NuevaNotaLoading() {
  return (
    <div className="max-w-7xl mx-auto" role="status" aria-label="Cargando nota médica">

      {/* ── Cabecera: regreso, título y línea de datos ── */}
      <div className="mb-5 space-y-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        {/* H1 .k-t-pantalla — 26/32 */}
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      {/* ── Rejilla de dos columnas ── */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start space-y-5 lg:space-y-0">

        {/* Columna izquierda (3/5) */}
        <div className="lg:col-span-3 space-y-[var(--sp-gap-block)]">

          {/* Tarjeta de captura: fila de signos vitales y dictado */}
          <div className="k-tarjeta">
            <div className="flex min-h-[44px] items-center gap-3 border-b border-linea pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-3.5 w-24" />
            </div>
            <div className="space-y-3 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="h-[200px] esc:h-[300px]" />
          </div>
          <Skeleton className="h-12 w-full rounded-[var(--r-control)] esc:ml-auto esc:h-10 esc:w-44" />
        </div>

        {/* Columna derecha (2/5) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Contexto del paciente */}
          <div className="k-tarjeta space-y-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3.5 w-full" />
          </div>

          {/* Panel de documentos — estado a la espera de la nota */}
          <div className="k-tarjeta">
            <Skeleton className="h-3 w-44" />
            <div className="flex flex-col items-center gap-3 py-5">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3.5 w-56 max-w-full" />
              <Skeleton className="h-3.5 w-40 max-w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
