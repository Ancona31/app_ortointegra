import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto del expediente de un paciente (/expediente/[id]).
 *
 * Calca la forma real de la página (rediseño B7): en `esc`, la ficha a la
 * izquierda (volver, avatar, nombre, pares y acciones) y las pestañas a la
 * derecha; en el resto, una columna con la cabecera, las pestañas y el cuerpo.
 * Todo por CSS (variantes de formato), como la página.
 *
 * ⚠️ EL CUERPO VA SIN RÓTULOS, y es a propósito: la pestaña que se abrirá
 * depende del `?tab=` de la url, que este esqueleto no lee. Se dibuja la forma
 * —dos bloques anchos— y las palabras las pone la pestaña al montar.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function ExpedientePacienteLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1120px] esc:grid esc:grid-cols-[280px_minmax(0,1fr)] esc:items-start esc:gap-10"
      role="status"
      aria-label="Cargando expediente"
    >
      {/* ── Ficha / cabecera del paciente ── */}
      <div className="flex flex-col gap-3 esc:gap-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-start gap-3 esc:flex-col">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-7 w-60 max-w-full" />
            <Skeleton className="h-4 w-44 max-w-full" />
          </div>
        </div>
        <div className="hidden space-y-3 esc:block">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
        <div className="flex items-center gap-3 esc:flex-col esc:items-stretch">
          <Skeleton className="h-10 w-[150px] rounded-[var(--r-control)] esc:w-full" />
          <Skeleton className="h-5 w-[130px]" />
        </div>
      </div>

      <div className="mt-5 min-w-0 esc:mt-0">
        {/* ── Barra de pestañas ── */}
        <div className="flex items-center gap-6 border-b border-linea pb-3">
          <Skeleton className="h-4 w-[64px] shrink-0" />
          <Skeleton className="h-4 w-[84px] shrink-0" />
          <Skeleton className="h-4 w-[96px] shrink-0" />
          <Skeleton className="h-4 w-[84px] shrink-0 esc:w-[150px]" />
        </div>

        {/* ── Cuerpo, sin rótulos ── */}
        <div className="mt-5 flex flex-col gap-6 esc:mt-6">
          <Skeleton className="h-[140px] rounded-[var(--r-tarjeta)]" />
          <Skeleton className="h-[220px] rounded-[var(--r-tarjeta)]" />
        </div>
      </div>
    </div>
  )
}
