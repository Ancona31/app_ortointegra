import { Skeleton, PatientListSkeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de la LISTA de pacientes (/expediente).
 *
 * Calca la geometría de expediente/page.tsx: contenedor `max-w-6xl mx-auto
 * space-y-4`, encabezado con botón de alta, barra de búsqueda + filtros de
 * escritorio, y la lista.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function ExpedienteListaLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-4" role="status" aria-label="Cargando pacientes">
      {/* Encabezado */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-[38px] w-40 rounded-xl" />
      </div>

      {/* Barra: buscador + filtros avanzados (solo escritorio, como en la página) */}
      <div className="flex flex-col md:flex-row md:items-end gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="h-[42px] flex-1 rounded-xl" />
          <Skeleton className="md:hidden h-[42px] w-[42px] flex-shrink-0 rounded-xl" />
        </div>
        {/* Cada filtro real lleva su etiqueta encima (`text-[11px] mb-1`): sin
            ella el bloque mediría 42px en vez de ~62 y la lista saltaría hacia
            arriba al llegar el contenido. */}
        <div className="hidden md:flex md:items-end gap-2">
          {['w-44', 'w-36', 'w-36', 'w-36'].map((w, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className={`h-[42px] ${w} rounded-xl`} />
            </div>
          ))}
          <Skeleton className="h-[42px] w-[42px] rounded-xl" />
        </div>
      </div>

      {/* Lista */}
      <PatientListSkeleton />
    </div>
  )
}
