import BuscadorPaciente, { ALTO_CONTROL } from '@/components/dashboard/BuscadorPaciente'
import { TARJETA } from '@/components/dashboard/PiezasCita'
import { TarjetaHoyCargando } from '@/components/dashboard/TarjetaHoy'

/* La tarjeta de los esqueletos de lista: la misma superficie, borde y filetes
   que la lista real todavía sin migrar, pero con tokens del kit, para que en
   oscuro no quede una caja blanca. */
const TARJETA_LISTA = 'bg-sup border border-borde divide-y divide-linea overflow-hidden'

/** Hueso genérico. Pulso de opacidad (`.skeleton` en `globals.css`), quieto con
 *  movimiento reducido. Oculto para lectores: quien lo contiene declara
 *  `aria-busy`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton${className ? ' ' + className : ''}`} />
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
    <div aria-busy="true" className={`${TARJETA_LISTA} rounded-[var(--r-tarjeta)]`}>
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
 * REPETIDO EN HUESO, y tiene que seguir siéndolo. Réplica de la retícula de B5
 * (`src/app/(app)/dashboard/page.tsx`, maqueta `dashboard-final`): cabecera con
 * identidad y «Hoy», pieza principal, acciones, lista y la primera tarjeta de
 * la columna derecha, en el orden de cada formato. Si allí cambian el ancho máximo, la
 * retícula o el ritmo, cámbialos aquí: lo que se ve al terminar la carga es un
 * salto, y el salto no avisa.
 *
 * ⚠️ LA BÚSQUEDA VA DE VERDAD, NO EN HUESO. No depende del perfil, así que no
 * hay motivo para inutilizarla justo cuando la pantalla está tardando. Por eso
 * este componente recibe su manejador en vez de fabricarlo: el disparo del
 * Ctrl+K sintético vive en un solo sitio, en la página, y aquí sólo se enchufa.
 *
 * ⚠️ Y LOS BOTONES SÍ VAN EN HUESO, A PROPÓSITO. Cuál se pinta depende del
 * rol, y durante la carga el rol se desconoce: `useProfile` mantiene
 * `profile === null` hasta que resuelve, sin estado intermedio. Pintarlos aquí
 * sería enseñarle a una secretaria la cabecera del médico durante un fotograma,
 * que es justo lo que el guarda de rol de la página existe para impedir.
 * No los «rellenes» porque parezcan vacíos.
 *
 * Sin barra móvil propia (hamburguesa, «Dashboard» y avatar): desde B4 la
 * cabecera de `tel`/`iv` es el encabezado fundido de `Sidebar.tsx`, también
 * mientras carga, como en la página real.
 */
export function DashboardSkeleton({ onBuscar }: {
  onBuscar: () => void
}) {
  /* La retícula y los huecos son COPIA de `RETICULA`/`HUECO` de
     `app/(app)/dashboard/page.tsx` (rediseño B5): si cambian allí, cambian aquí,
     o la página salta al resolver el perfil. Sin un solo rótulo: el rol aún no
     se sabe (ver arriba). Los botones de acción, con la geometría del médico
     (cuatro; tres en ext), que es el caso más frecuente. */
  return (
    <div className="mx-auto flex max-w-[1044px] flex-col gap-5 pb-6 pt-2 esc:gap-6" aria-busy="true">
      <div className="flex flex-col gap-4 esc:flex-row esc:flex-wrap esc:items-end esc:justify-between esc:gap-x-8 esc:gap-y-4">
        <div className="min-w-0">
          <Skeleton className="h-3.5 w-44 max-w-full" />
          <Skeleton className="mt-1 h-8 w-72 max-w-full" />
        </div>
        <TarjetaHoyCargando />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 iv:grid-cols-2 esc:grid-cols-[minmax(0,1fr)_minmax(300px,384px)] esc:gap-5">
        <div className={`${TARJETA} order-1 iv:col-span-2 esc:col-start-1 esc:row-start-1`} aria-hidden="true">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[50px] w-[52px] shrink-0 rounded-[12px]" />
            <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div>
          </div>
          <Skeleton className="mt-4 h-11 rounded-[12px]" />
        </div>
        <div className="order-2 flex flex-col gap-3 iv:col-span-2 esc:col-start-2 esc:row-start-1">
          <BuscadorPaciente onAbrir={onBuscar} />
          <div className="grid grid-cols-2 gap-2 ext:grid-cols-3 ih:grid-cols-4 iv:grid-cols-4" aria-hidden="true">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className={`${ALTO_CONTROL} rounded-[12px] ${i === 1 ? 'ext:hidden' : ''}`} />)}
          </div>
        </div>
        <div className={`${TARJETA} order-3 esc:col-start-1 esc:row-start-2 esc:row-span-2`} aria-hidden="true">
          <Skeleton className="mb-3 h-4 w-28" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex min-h-[64px] items-center gap-3 border-t border-linea py-3 first:border-t-0">
              <Skeleton className="h-[50px] w-[52px] shrink-0 rounded-[12px]" />
              <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-[55%]" /><Skeleton className="h-3 w-[35%]" /></div>
            </div>
          ))}
        </div>
        <div className={`${TARJETA} order-4 esc:col-start-2 esc:row-start-2`} aria-hidden="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-[60px] rounded-[12px]" />
        </div>
      </div>
    </div>
  )
}

/** Formulario de perfil */
export function PerfilSkeleton() {
  /* Calca la forma real de Mi perfil tras el rediseño: contenedor de 960 px,
     ceja y título, barra de pestañas, y las DOS columnas —la fija de 310 px y
     el cuerpo—. La versión anterior era de una sola columna a 512 px, así que
     la pantalla daba un salto de ancho al terminar de cargar. */
  return (
    <div aria-busy="true" className="max-w-[960px] mx-auto">
      <div className="mb-[var(--sp-gap-block)] space-y-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="flex gap-[var(--sp-4)] pb-[var(--sp-3)]">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="mt-[var(--sp-gap-band)] grid grid-cols-1 items-start gap-[var(--sp-5-5)] lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className="space-y-[var(--sp-gap-block)]">
          <Skeleton className="h-64 rounded-[var(--sp-r-card)]" />
          <Skeleton className="h-24 rounded-[var(--sp-r-card)]" />
        </div>
        <div className="min-w-0 space-y-[var(--sp-gap-block)]">
          {[1, 2].map(i => (
            <div key={i} className="bg-sup rounded-2xl border border-borde p-5 space-y-3">
              <Skeleton className="h-2.5 w-36" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Stats de billing */
export function BillingSkeleton() {
  return (
    <div aria-busy="true" className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="bg-sup rounded-2xl border border-borde p-5 space-y-4">
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
    <div aria-busy="true" className="max-w-2xl mx-auto space-y-4">
      {header && (
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      )}
      <div className={`${TARJETA_LISTA} rounded-2xl`}>
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
