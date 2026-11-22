import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de la LISTA de pacientes (/expediente).
 *
 * Calca la geometría de expediente/page.tsx (rediseño B6): contenedor
 * `max-w-6xl mx-auto space-y-5`, cabecera con título y botón de alta, barra
 * (buscador + «Ordenado por» + «Filtros»; en una fila desde `ih`, en dos en
 * `ext`/`tel`) y la lista en una tarjeta.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
function FilaHueso() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-9 w-9 flex-none rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export default function ExpedienteListaLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5" role="status" aria-label="Cargando pacientes" aria-busy="true">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 ih:h-9 iv:h-9 esc:h-9" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <Skeleton className="h-10 w-32 rounded-[var(--r-control)] ext:w-28 ih:h-9 esc:h-9" />
      </div>

      {/* Barra */}
      <div className="flex flex-col gap-2 ih:flex-row iv:flex-row esc:flex-row ih:items-center iv:items-center esc:items-center ih:gap-4 iv:gap-4 esc:gap-4">
        <Skeleton className="h-11 w-full rounded-[var(--r-control)] ih:h-10 esc:h-10 ih:max-w-[300px] iv:max-w-[300px] esc:max-w-[340px]" />
        <div className="flex h-9 items-center justify-between gap-3 ih:ml-auto iv:ml-auto esc:ml-auto">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </div>

      {/* Lista */}
      <div className="k-tarjeta k-lista">
        <div className="k-lista">
          {[1, 2, 3, 4, 5, 6].map(i => <FilaHueso key={i} />)}
        </div>
      </div>
    </div>
  )
}
