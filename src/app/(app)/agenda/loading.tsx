import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto de la Agenda (/agenda).
 *
 * ⚠️ QUÉ CUBRE ESTO Y QUÉ NO, porque es lo que más se malinterpreta: `page.tsx`
 * es `'use client'` y pide las citas DESDE EL NAVEGADOR, así que este archivo
 * sólo se ve mientras baja el chunk de la página. La espera de los datos NO pasa
 * por aquí — la cubren la barra de 2 px y la atenuación de la rejilla del
 * bloque 9, que viven dentro de `page.tsx`.
 *
 * ── PUESTO AL DÍA EN EL BLOQUE 9 ────────────────────────────────────────────
 * Calcaba una agenda que ya no existe y saltaba al llegar el contenido. Los tres
 * desfases, por si vuelven:
 *
 *   · **El alto de hora.** Documentaba `.fc-timegrid-slot { height: 2.16rem }` y
 *     dibujaba `4.32rem` por hora. Desde el 2026-08-25 la franja sale de
 *     `--ag-slot-h` —36, 42 o 48 px según el ALTO de ventana—, o sea 72, 84 o
 *     96 px por hora. Ahora se lee el token en vez de copiar su valor: así este
 *     archivo ya no puede volver a quedarse atrás.
 *   · **El móvil.** Dibujaba el toolbar de escritorio en todos los anchos. Por
 *     debajo de `lg` no hay toolbar: `headerToolbar` va en `false` y lo sustituye
 *     la banda azul, y las vistas de Semana y Día son LISTAS, no rejilla.
 *   · **La leyenda.** Iba encima de la tarjeta; desde el bloque 8 va DENTRO, en
 *     fila propia entre el toolbar y la rejilla.
 *
 * ⚠️ EL UMBRAL ES `lg` (1024 px) Y NO ES ARBITRARIO: es el `ANCHO_MOVIL` de
 * `page.tsx`. Aquí va por media query porque un esqueleto no tiene JS que medir;
 * allí va por `useState` porque además decide la VISTA. Si uno se mueve, el otro
 * también.
 *
 * ⚠️ LO QUE SIGUE SIN CALCAR, a sabiendas: en móvil la página real va a sangre
 * —lo hace `main > div:has(.agenda-fc)` en globals.css, y el gancho es la clase
 * `.agenda-fc`, que aquí no se puede poner porque arrastra el `display: grid` y
 * sus cuatro áreas—, así que este esqueleto queda con los 16 px de relleno del
 * layout. Son 16 px durante un instante; replicar aquel `:has()` a mano es el
 * truco de márgenes negativos que el bloque 6 ya retiró una vez.
 *
 * El padding exterior lo pone (app)/layout.tsx — no lo repitas aquí.
 */

const DIAS = [0, 1, 2, 3, 4, 5, 6]
const HORAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
/* Las filas de la lista del teléfono. Seis es lo que cabe en una pantalla de
   390 × 844 con la banda arriba y la barra de «Agendar» abajo. */
const FILAS_LISTA = [0, 1, 2, 3, 4, 5]

export default function AgendaLoading() {
  return (
    <div className="flex flex-col" role="status" aria-label="Cargando agenda">

      {/* ── Banda azul del móvil (por debajo de lg) ──────────────────────
          El navy sale del token, igual que la banda real; los controles van en
          blancos translúcidos sobre él, que es lo mismo que hace `.ag-banda-movil`
          y por lo mismo: no son colores de la paleta, son opacidades. */}
      <div
        className="lg:hidden flex flex-col gap-2 px-3.5 pt-2 pb-2.5 -mx-4 -mt-2 mb-3"
        style={{ background: 'var(--ag-navy)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-xl bg-white/15" />
          <div className="h-4 w-32 rounded bg-white/20 ml-1" />
          <div className="w-11 h-11 rounded-xl bg-white/15 ml-auto" />
          <div className="w-11 h-11 rounded-xl bg-white/15" />
        </div>
        {/* El conmutador de vistas: tres pestañas, la activa en blanco sólido. */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/10">
          <div className="flex-1 h-8 rounded-lg bg-white/90" />
          <div className="flex-1 h-8 rounded-lg bg-white/15" />
          <div className="flex-1 h-8 rounded-lg bg-white/15" />
        </div>
      </div>

      {/* ── Cabecera de escritorio (desde lg) ─────────────────────────────
          En móvil no existe: la sustituye la banda de arriba. */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2">
          {/* Control segmentado de vistas */}
          <Skeleton className="h-[35px] w-[240px] rounded-[10px]" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* ── Tarjeta del calendario ───────────────────────────────────────
          Se dibuja el caso single-doctor —el habitual—: sin el `<select>` de
          filtro por médico. En una clínica multi-doctor la cabecera se recoloca
          sola al llegar el contenido. */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar: prev/next/hoy + fecha. Sólo escritorio, como en la página. */}
        <div className="hidden lg:flex items-center justify-between gap-3 px-[18px] py-3 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="h-5 w-44" />
          </div>
        </div>

        {/* Leyenda de estados. DENTRO de la tarjeta y en fila propia, y sólo en
            escritorio: en móvil la página real únicamente la pinta en la vista
            Día, que no es la de arranque. Los 18 px de relleno son los del
            toolbar, igual que en `.agenda-fc .ag-leyenda`. */}
        <div className="hidden lg:flex flex-wrap items-center gap-3 px-[18px] py-3.5 border-b border-slate-100">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* ── Rejilla semanal (desde lg) ──────────────────────────────── */}
        <div className="hidden lg:block">
          {/* Cabecera de días */}
          <div className="flex border-b border-slate-100">
            <div className="w-14 flex-shrink-0" />
            {DIAS.map(i => (
              <div key={i} className="flex-1 flex justify-center py-2">
                <Skeleton className="h-8 w-9" />
              </div>
            ))}
          </div>
          {/* Horas. El alto sale de `--ag-slot-h`, que es media hora: por eso el
              ×2. Leerlo en vez de copiarlo es lo que impide que este bloque
              vuelva a desfasarse cuando el token cambie de valor o de tramo. */}
          <div>
            {HORAS.map(h => (
              <div
                key={h}
                className="flex border-b border-slate-100 last:border-b-0 h-[calc(var(--ag-slot-h,36px)*2)]"
              >
                <div className="w-14 flex-shrink-0 flex justify-end pr-2 pt-1">
                  <Skeleton className="h-2.5 w-8" />
                </div>
                {DIAS.map(i => (
                  <div key={i} className="flex-1 border-l border-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Lista (por debajo de lg) ────────────────────────────────────
            En el teléfono Semana y Día SON listas, así que aquí no hay rejilla
            que dibujar. Cada fila calca a `.ag-listafila`: marcador de estado,
            hora, nombre. */}
        <div className="lg:hidden">
          {FILAS_LISTA.map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-b-0">
              <Skeleton className="w-1 h-9 rounded-full flex-shrink-0" />
              <Skeleton className="h-3.5 w-11 flex-shrink-0" />
              <Skeleton className="h-3.5 flex-1 max-w-[160px]" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Barra inferior del móvil ─────────────────────────────────────
          Los 56 px son los de `.ag-barra-movil-cta`, que es el mínimo táctil
          reforzado de §12 para la acción principal del teléfono. */}
      <div className="lg:hidden pt-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
}
