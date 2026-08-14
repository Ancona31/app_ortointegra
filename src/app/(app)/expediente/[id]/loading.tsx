import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto del expediente de un paciente (/expediente/[id]).
 *
 * Calca la forma real de la página: contenedor `max-w-4xl mx-auto space-y-4`,
 * bloque de hero (HeroExpediente: volver + nombre + barra de estadísticas) y
 * rejilla de tarjetas (ExpedienteCardsGrid), más los accesos rápidos.
 *
 * Se dibujan 6 tarjetas porque es lo que ve el médico —el caso normal aquí: el
 * layout de [id] redirige a la secretaria—. Un admin no médico ve 5 y la
 * rejilla se recoloca sola al llegar el contenido.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function ExpedientePacienteLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-4" role="status" aria-label="Cargando expediente">
      {/* ── Hero ── */}
      <div>
        {/* Volver a pacientes */}
        <Skeleton className="h-4 w-32 mb-4" />

        <div className="flex items-start justify-between gap-8 mb-5">
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            {/* Nombre del paciente — 36px con line-height 1.15 */}
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-40 rounded-xl" />
          </div>
        </div>

        {/* Barra de estadísticas: última consulta · total · dashboard */}
        <div className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-px h-7 bg-slate-100 mr-2" />}
              <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rejilla de tarjetas ── */}
      <div
        className="grid gap-3 mb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>

      {/* ── Accesos rápidos ── */}
      <Skeleton className="h-[120px] rounded-2xl" />

      {/* Eliminar paciente */}
      <div className="flex justify-end">
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
