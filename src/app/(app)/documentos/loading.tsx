import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de Documentos (/documentos).
 *
 * Calca lo que la página pinta al abrirse: la columna de 640 centrada,
 * cabecera (rótulo + título + subtítulo) y el Paso 1: rótulo, título, buscador
 * y su línea de ayuda.
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
    <div className="mx-auto w-full max-w-[640px] iv:max-w-[600px]" role="status" aria-label="Cargando documentos">

      {/* Cabecera */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Paso 1 — buscador de paciente */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-52" />
        <div className="pt-1">
          <Skeleton className="h-11 rounded-[var(--r-control)]" />
        </div>
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
    </div>
  )
}
