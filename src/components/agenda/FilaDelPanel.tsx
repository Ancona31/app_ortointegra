'use client'

import { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'
import { type FilaDelDia } from '@/lib/agenda/conteoAgenda'

/* Una fila. Botón y no enlace: no navega, abre el modal de la cita — el mismo
   `setModal` al que llega `handleEventClick` desde la rejilla.

   Misma regla de forma que en las listas y en la celda del mes: REDONDO es cita,
   CUADRADO es evento, y la G de Google gana a las dos. La forma es lo que
   sobrevive a la ceguera al color. */
export const FilaDelPanel = memo(function FilaDelPanel(
  { fila, onAbrir }: { fila: FilaDelDia; onAbrir: (id: string) => void },
) {
  return (
    <button type="button" className="ag-mespanel-fila" onClick={() => onAbrir(fila.id)}>
      <span className={`ag-mespanel-hora${fila.todoElDia ? ' ag-mespanel-hora--todo' : ''}`}>
        {fila.hora}
      </span>
      {fila.esDeGoogle
        ? <GoogleGIcon size={11} />
        : <span
            className={`ag-mespanel-punto${fila.esEvento ? ' ag-mespanel-punto--cuadro' : ''}`}
            style={{ background: fila.tinta }}
          />}
      <span className={`ag-mespanel-nombre${fila.cancelada ? ' ag-mespanel-nombre--cancelada' : ''}`}>
        {fila.nombre}
      </span>
      <ChevronRight size={15} className="ag-mespanel-chev" aria-hidden />
    </button>
  )
})
