import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto del expediente de un paciente (/expediente/[id]).
 *
 * Calca la forma real de la página: contenedor de 960 px, cabecera del paciente
 * —volver, avatar, nombre y línea de identificación, más las acciones— y la
 * barra de cuatro pestañas que la cierra.
 *
 * ⚠️ EL CUERPO VA SIN RÓTULOS, y es a propósito: la pestaña que se abrirá
 * depende del `?tab=` de la url, que este esqueleto no lee. Escribir aquí
 * «Resumen» significaría acertar tres de cada cuatro veces. Se dibuja la forma
 * —dos bloques anchos— y las palabras las pone la pestaña al montar.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function ExpedientePacienteLoading() {
  return (
    <div className="max-w-[960px] mx-auto" role="status" aria-label="Cargando expediente">
      {/* ── Cabecera del paciente ── */}
      <div className="pb-[var(--sp-4-5)]">
        <Skeleton className="h-3.5 w-36 mb-[var(--sp-3)]" />
        <div className="flex flex-col gap-[var(--sp-4)] lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-[var(--sp-3-5)]">
            <Skeleton className="w-[50px] h-[50px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-[var(--sp-1-5)]">
              <Skeleton className="h-8 w-72 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-[var(--sp-2-5)] lg:shrink-0">
            <Skeleton className="h-[42px] w-[104px] rounded-[var(--sp-r-btn)]" />
            <Skeleton className="h-[42px] w-[118px] rounded-[var(--sp-r-btn)]" />
            <Skeleton className="h-[42px] w-[186px] rounded-[var(--sp-r-btn)]" />
            <Skeleton className="h-[42px] w-[176px] rounded-[var(--sp-r-btn)]" />
          </div>
        </div>
      </div>

      {/* ── Barra de pestañas ── */}
      <div className="flex items-center gap-[var(--sp-4)] border-b border-[color:var(--sp-line-card)] pb-[var(--sp-3)]">
        {/* Anchos fijos por clase y no por `style`: el bloque de hueso solo
            admite `className`. Son los cuatro rótulos de pestaña, medidos. */}
        <Skeleton className="h-4 w-[92px] shrink-0" />
        <Skeleton className="h-4 w-[108px] shrink-0" />
        <Skeleton className="h-4 w-[124px] shrink-0" />
        <Skeleton className="h-4 w-[168px] shrink-0" />
      </div>

      {/* ── Cuerpo, sin rótulos ── */}
      <div className="mt-[var(--sp-gap-band)] flex flex-col gap-[var(--sp-gap-band)]">
        <Skeleton className="h-[168px] rounded-2xl" />
        <Skeleton className="h-[168px] rounded-2xl" />
      </div>
    </div>
  )
}
