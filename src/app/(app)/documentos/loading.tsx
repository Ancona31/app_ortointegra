import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de Documentos (/documentos).
 *
 * Calca lo que la página pinta al abrirse: contenedor `max-w-4xl mx-auto
 * space-y-4`, cabecera (eyebrow + título + subtítulo) y la tarjeta del Paso 1,
 * el buscador de paciente, con su `max-w-lg`.
 *
 * NO se dibuja la rejilla de tipos de documento: el Paso 2 solo aparece después
 * de elegir paciente, así que un esqueleto con las tarjetas de tipo prometería
 * algo que nunca está en el primer pintado y provocaría el salto que este
 * archivo evita.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function DocumentosLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-4" role="status" aria-label="Cargando documentos">

      {/* Cabecera */}
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>

      {/* Paso 1 — buscador de paciente */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 max-w-lg space-y-1">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3 w-72 max-w-full" />
        <div className="pt-3">
          <Skeleton className="h-[42px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}
