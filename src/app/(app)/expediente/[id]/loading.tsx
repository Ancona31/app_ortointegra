import { ExpedientePacienteSkeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto del expediente de un paciente (/expediente/[id]) al llegar por
 * navegación. Es la MISMA pieza que pinta la página mientras lee la ficha del
 * paciente (`page.tsx`), para que no haya dos formas de «cargando» ni un salto
 * entre ellas. La geometría vive en `ui/Skeleton.tsx`.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */
export default function ExpedientePacienteLoading() {
  return <ExpedientePacienteSkeleton />
}
