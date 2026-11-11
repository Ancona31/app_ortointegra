'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Medico } from '@/components/agenda/AppointmentModal'
import { FiltrosBandaMovil } from '@/components/agenda/FiltrosBandaMovil'

/* La tercera fila de la banda: navegación de periodo con los filtros en medio.

   ⚠️ LAS FLECHAS VAN AQUÍ Y PEGADAS A LOS BORDES, Y ES EL SITIO DEL MOCKUP —los
   tres lo dibujan igual, en su `.datenav`—. En el paso 8c subieron a la fila del
   título para ahorrar una fila entera, y ahí no se leen: junto a «Agenda»
   parecen navegación de la app y no del periodo. Flanqueando el filtro, con la
   fecha centrada justo debajo, dicen lo que hacen.

   ⚠️ QUIEN LAS EMPUJA A LOS EXTREMOS ES LA CAJA ELÁSTICA DEL MEDIO, no un
   `justify-content: space-between` en esta fila: con tres o cuatro hijos, aquél
   repartiría el hueco entre todos y el engrane se despegaría del filtro. El
   porqué entero está junto a `.ag-banda-movil-medio` en globals.css. */
export function NavegacionBandaMovil(
  { medicos, filtroMedico, onFiltroMedico, onHorario, onCompactar, compactado, onPrev, onNext,
    mesSinTodos }: {
    medicos: readonly Medico[]; filtroMedico: string
    onFiltroMedico: (id: string) => void; onHorario: (() => void) | null
    onCompactar: (() => void) | null; compactado: boolean
    onPrev: () => void; onNext: () => void
    mesSinTodos: boolean
  },
) {
  return (
    <div className="ag-banda-movil-filtros">
      <button type="button" className="ag-banda-movil-ctrl" onClick={onPrev} aria-label="Periodo anterior">
        <ChevronLeft size={20} />
      </button>
      <FiltrosBandaMovil
        medicos={medicos} filtroMedico={filtroMedico}
        onFiltroMedico={onFiltroMedico} onHorario={onHorario}
        onCompactar={onCompactar} compactado={compactado}
        mesSinTodos={mesSinTodos}
      />
      <button type="button" className="ag-banda-movil-ctrl" onClick={onNext} aria-label="Periodo siguiente">
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
