import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de la Agenda (/agenda).
 *
 * Calca la forma de agenda/page.tsx: contenedor `flex flex-col`, cabecera con
 * título + controles a la derecha, leyenda de estados y la tarjeta blanca del
 * calendario con su barra de herramientas arriba y la rejilla semanal debajo.
 *
 * Se dibuja el caso single-doctor —el habitual—: leyenda de estados visible y
 * sin el `<select>` de filtro por médico. En una clínica multi-doctor pasa lo
 * contrario y la cabecera se recoloca sola al llegar el contenido.
 *
 * Las 14 filas de hora y su alto salen de la página y de globals.css:
 * slotMinTime 07:00 → slotMaxTime 21:00 y `.fc-timegrid-slot { height: 2.16rem }`
 * a media hora, o sea 4.32rem por hora.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */

const DIAS = [0, 1, 2, 3, 4, 5, 6]
const HORAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/* En móvil el calendario arranca en vista Día: solo sobrevive la primera
   columna, igual que el `initialView` de la página. */
const soloEnEscritorio = (i: number) => (i === 0 ? '' : ' hidden md:block')

export default function AgendaLoading() {
  return (
    <div className="flex flex-col" role="status" aria-label="Cargando agenda">

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2">
          {/* Control segmentado de vistas — solo escritorio, como en la página */}
          <Skeleton className="hidden lg:block h-[35px] w-[240px] rounded-[10px]" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* ── Leyenda de estados ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="w-3 h-3 rounded-sm" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* ── Calendario ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Barra de herramientas: prev/next/hoy + título del rango */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-16 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-44" />
          {/* Hueco del bloque derecho de la toolbar (vacío en escritorio) */}
          <div className="w-[122px] flex-shrink-0" />
        </div>

        {/* Cabecera de días */}
        <div className="flex border-b border-slate-100">
          <div className="w-14 flex-shrink-0" />
          {DIAS.map(i => (
            <div key={i} className={`flex-1 flex justify-center py-2${soloEnEscritorio(i)}`}>
              <Skeleton className="h-8 w-9" />
            </div>
          ))}
        </div>

        {/* Rejilla horaria */}
        <div>
          {HORAS.map(h => (
            <div key={h} className="flex h-[4.32rem] border-b border-slate-100 last:border-b-0">
              <div className="w-14 flex-shrink-0 flex justify-end pr-2 pt-1">
                <Skeleton className="h-2.5 w-8" />
              </div>
              {DIAS.map(i => (
                <div
                  key={i}
                  className={`flex-1 border-l border-slate-100${soloEnEscritorio(i)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
