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
 * Arriba la tarjeta de signos vitales (banda de cinco celdas,
 * SignosVitalesCard); debajo la de captura con su título y el pozo del
 * dictado; al pie, el principal.
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

          {/* Tarjeta de signos vitales: cabecera y banda de cinco celdas */}
          <div className="k-tarjeta">
            <div className="mb-2.5 flex min-h-[28px] items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="sv-banda">
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className={`h-16 rounded-[var(--r-control)] ${i === 0 ? 'sv-celda--pa' : ''}`} />
              ))}
            </div>
          </div>

          {/* Tarjeta de captura: título, ayuda y el pozo del dictado */}
          <div className="k-tarjeta">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-[12px]" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3.5 w-11/12" />
              </div>
            </div>
            <Skeleton className="mt-4 h-[264px] w-full rounded-[var(--r-control)] esc:h-[274px]" />
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
