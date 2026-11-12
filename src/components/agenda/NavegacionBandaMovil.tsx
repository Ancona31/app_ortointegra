'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

/* La navegación de periodo de la banda: ‹ · Hoy · ›, en la primera fila y
   pegada a la fecha (F1.15).

   ⚠️ YA NO LLEVA LOS FILTROS EN MEDIO. Hasta F1.15 era la tercera fila, con las
   flechas en los extremos y el filtro entre ellas; ahora el filtro va en la
   segunda fila, junto al conmutador, y esto sólo navega.

   F1.10 · «HOY» ES NUEVO EN EL TELÉFONO, y sale sin interruptor (decisión 16).
   Con el rango que ya contiene hoy se queda `aria-disabled` —enfocable y con su
   nombre, pero sin hacer nada—, igual que el «Hoy» de FullCalendar en
   escritorio, que se deshabilita en el mismo caso. */
export function NavegacionBandaMovil(
  { onPrev, onNext, onHoy, hoyDeshabilitado }: {
    onPrev: () => void; onNext: () => void; onHoy: () => void; hoyDeshabilitado: boolean
  },
) {
  return (
    <span className="ag-banda-movil-nav">
      <button type="button" className="ag-banda-movil-ctrl" onClick={onPrev} aria-label="Periodo anterior">
        <ChevronLeft size={20} />
      </button>
      <button type="button" className="ag-banda-movil-ctrl ag-banda-movil-hoy"
        aria-disabled={hoyDeshabilitado} onClick={hoyDeshabilitado ? undefined : onHoy}>
        Hoy
      </button>
      <button type="button" className="ag-banda-movil-ctrl" onClick={onNext} aria-label="Periodo siguiente">
        <ChevronRight size={20} />
      </button>
    </span>
  )
}
