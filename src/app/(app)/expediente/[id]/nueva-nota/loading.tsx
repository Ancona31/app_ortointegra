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
 * Las medidas de la card de signos vitales salen de su CSS embebido
 * (SignosVitalesCard.tsx): header de 10px 18px y rejilla 1.9fr + 4×1fr con
 * gap 12 y padding 12px 18px. No se reutilizan sus clases `sv-*` porque viven
 * en un <style> dentro del componente y aquí no estarían montadas.
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

          {/* Signos vitales */}
          <div className="overflow-hidden rounded-[var(--r-tarjeta)] bg-sup">
            <div className="flex items-center gap-2.5 border-b border-linea px-[18px] py-2.5">
              <Skeleton className="w-[26px] h-[26px] rounded-lg flex-shrink-0" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-6 w-20 rounded-full ml-auto" />
            </div>
            <div
              className="grid gap-3 px-[18px] py-3"
              style={{ gridTemplateColumns: '1.9fr 1fr 1fr 1fr 1fr' }}
            >
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-[58px] rounded-[14px]" />
              ))}
            </div>
          </div>

          {/* Card Captura — usa el chrome real del sistema (.sp-card--hero) */}
          <div className="sp-card sp-card--hero space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
            <Skeleton className="h-3 w-44" />
            {/* Textarea de captura — rows=10 */}
            <Skeleton className="h-[248px] rounded-xl" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
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
