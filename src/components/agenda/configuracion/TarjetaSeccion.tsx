/**
 * La tarjeta de una sección de la configuración de la agenda (tanda T2,
 * punto 12): el mismo marco, el mismo relleno y el mismo encabezado para las
 * ocho secciones de la pantalla, con la retícula `--ag-*` del bloque F. Antes
 * cada sección repetía a mano su `rounded-2xl … p-5 space-y-4` y su título;
 * con esto la simetría no depende de copiar bien una clase.
 *
 * `id` va al título: la sección es una `region` con ese nombre (lo usan las
 * e2e y los lectores de pantalla) y el destino de los enlaces de «Para
 * empezar» (`#<id>`). `acciones`, a la derecha del título.
 */
import type { ReactNode } from 'react'

interface Props {
  id: string
  titulo: string
  ayuda?: ReactNode
  acciones?: ReactNode
  children: ReactNode
}

export default function TarjetaSeccion({ id, titulo, ayuda, acciones, children }: Props) {
  return (
    <section aria-labelledby={id}
      className="ag-config-tarjeta scroll-mt-[var(--ag-6)] rounded-[var(--ag-r-card)] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[var(--ag-5)] flex flex-col gap-[var(--ag-4)]">
      <div className="flex flex-col gap-[var(--ag-3)] sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-[var(--ag-1)]">
          <h3 id={id} className="text-base font-semibold text-[var(--ag-text)]">{titulo}</h3>
          {ayuda && <p className="text-sm text-[var(--ag-muted)]">{ayuda}</p>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap gap-[var(--ag-2)]">{acciones}</div>}
      </div>
      {children}
    </section>
  )
}
