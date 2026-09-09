import { Menu } from 'lucide-react'
import BuscadorPaciente, { ALTO_CONTROL } from '@/components/dashboard/BuscadorPaciente'
import { ProximasCitasCargando } from '@/components/dashboard/ProximasCitas'
import { TarjetaHoyCargando } from '@/components/dashboard/TarjetaHoy'
import { AtendidosCargando } from '@/components/dashboard/AtendidosRecientemente'
import { DocumentosCargando } from '@/components/dashboard/DocumentosRecientes'

/** Bloque shimmer genérico */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton${className ? ' ' + className : ''}`} />
}

/** Fila de lista de pacientes */
export function PatientRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  )
}

/** Lista completa de pacientes */
export function PatientListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <PatientRowSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * El dashboard mientras `useProfile` resuelve.
 *
 * ⚠️ ESTO NO ES «UNA CAJA GRIS CUALQUIERA»: ES EL LAYOUT DE `/dashboard`
 * REPETIDO EN HUESO, y tiene que seguir siéndolo. Réplica de los bloques 1 y 2
 * del rediseño (`src/app/(app)/dashboard/page.tsx`): cabecera de dos filas con
 * su filete de cierre, banda 1 de dos columnas, filete a todo el ancho y banda 2
 * de dos columnas con su filete vertical. Si allí cambian el ancho máximo, la
 * retícula o el ritmo, cámbialos aquí: lo que se ve al terminar la carga es un
 * salto, y el salto no avisa.
 *
 * ⚠️ LA BÚSQUEDA Y EL HAMBURGUESA VAN DE VERDAD, NO EN HUESO. Ninguno de los dos
 * depende del perfil, así que no hay motivo para inutilizarlos justo cuando la
 * pantalla está tardando. Por eso este componente recibe los dos manejadores en
 * vez de fabricarlos: el disparo del Ctrl+K sintético vive en un solo sitio, en
 * la página, y aquí sólo se enchufa.
 *
 * ⚠️ Y LOS TRES BOTONES SÍ VAN EN HUESO, A PROPÓSITO. Cuál se pinta depende del
 * rol, y durante la carga el rol se desconoce: `useProfile` mantiene
 * `profile === null` hasta que resuelve, sin estado intermedio. Pintarlos aquí
 * sería enseñarle a una secretaria la cabecera del médico durante un fotograma,
 * que es justo lo que el guarda de rol de la página existe para impedir.
 * No los «rellenes» porque parezcan vacíos.
 *
 * ⚠️ `dash-barra-movil` TIENE QUE ESTAR TAMBIÉN AQUÍ. Es el asidero de las dos
 * reglas de `globals.css` que esconden el hamburguesa flotante del `Sidebar` y
 * recortan el relleno superior que el layout reserva para él. Sin la clase en
 * este esqueleto, durante la carga reaparecen los dos —el flotante y el de la
 * barra— y el contenido baja 48 px de golpe al terminar.
 */
export function DashboardSkeleton({ onBuscar, onAbrirMenu }: {
  onBuscar: () => void
  onAbrirMenu: () => void
}) {
  return (
    <div className="max-w-[1044px] mx-auto pt-2 pb-6">

      {/* ── Región 1 · Cabecera ─────────────────────────────── */}
      <div className="pb-[var(--sp-5-5)] border-b border-[color:var(--sp-line-card)]">

        <div className="dash-barra-movil lg:hidden flex items-center gap-[var(--sp-3)] mb-[var(--sp-gap-block)]">
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menú"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-surface-muted)] text-[var(--sp-ink-700)]"
          >
            <Menu size={20} />
          </button>
          <p className="flex-1 min-w-0 truncate text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
            Dashboard
          </p>
          {/* El avatar sale de las iniciales del perfil: en hueso. */}
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        </div>

        {/* Fila 1 · identidad. Consultorio activo y saludo salen los dos del
            perfil, así que los dos esperan. */}
        <Skeleton className="h-3.5 w-44 max-w-full" />
        <Skeleton className="mt-[var(--sp-gap-title-sub)] h-8 w-72 max-w-full" />

        {/* Fila 2 · acción. Misma retícula que la real para que nada se mueva
            al resolver: búsqueda flexible y, a su derecha, el grupo que no
            encoge. */}
        <div className="mt-[var(--sp-gap-block)] flex flex-col gap-[var(--sp-gap-item)] lg:flex-row lg:flex-wrap lg:items-center">

          <BuscadorPaciente onAbrir={onBuscar} />

          {/* Los anchos son los de los tres botones reales medidos a 15 px, y
              el orden es el suyo: en móvil el primario cruza las dos columnas y
              debajo van los otros dos; en `lg`, fila. */}
          <div className="order-2 grid grid-cols-2 gap-[var(--sp-gap-item)] lg:flex lg:shrink-0 lg:items-center">
            <Skeleton className={`${ALTO_CONTROL} col-span-2 order-1 lg:order-3 lg:w-[208px] rounded-[var(--sp-r-btn)]`} />
            <Skeleton className={`${ALTO_CONTROL} order-2 lg:order-2 lg:w-[197px] rounded-[var(--sp-r-btn)]`} />
            <Skeleton className={`${ALTO_CONTROL} order-3 lg:order-1 lg:w-[169px] rounded-[var(--sp-r-btn)]`} />
          </div>
        </div>
      </div>

      {/* ── Banda 1 · flexible + fija ───────────────────────── */}
      <div className="mt-[var(--sp-gap-band)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-5)]">
        {/* La misma card de carga que pinta la región cuando ya está montada:
            los cuatro renglones en hueso miden lo que van a medir de verdad. */}
        <ProximasCitasCargando />
        <TarjetaHoyCargando />
      </div>

      {/* Filete a todo el ancho del área de contenido. */}
      <div className="mt-[var(--sp-gap-band)] border-t border-[color:var(--sp-line-card)]" />

      {/* ── Banda 2 · flexible + fija, con el filete vertical ─ */}
      <div className="mt-[var(--sp-gap-band)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-gap-band)] lg:gap-0">

        <div className="lg:pr-[var(--sp-pad-rule)]">
          <AtendidosCargando />
        </div>

        <div className="border-t border-[color:var(--sp-line-card)] pt-[var(--sp-3-5)] lg:border-t-0 lg:pt-0 lg:border-l lg:pl-[var(--sp-pad-rule)]">
          <DocumentosCargando />
        </div>
      </div>
    </div>
  )
}

/** Formulario de perfil */
export function PerfilSkeleton() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-7 w-28" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton className="h-2.5 w-36" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-12 rounded-2xl" />
    </div>
  )
}

/** Stats de billing */
export function BillingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

/** Lista de laboratorios / estadísticas */
export function ListSkeleton({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {header && (
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
