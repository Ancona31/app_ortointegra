'use client'

import { memo, type CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import { IconoGoogleCalendar } from '@/components/ui/MarcaOrigen'
import { MarcaOrigenGoogle } from '@/components/agenda/MarcaOrigenGoogle'
import { MarcasCita } from '@/components/agenda/MarcasCita'
import { useSinAvisoFlotante } from '@/components/agenda/MemoizedEventContent'
import IconoEstadoCita from '@/components/ui/IconoEstadoCita'
import { type FilaDelDia } from '@/lib/agenda/conteoAgenda'

/* Una fila. Botón y no enlace: no navega, abre el modal de la cita — el mismo
   `setModal` al que llega `handleEventClick` desde la rejilla.

   Misma regla de forma que en las listas y en la celda del mes: REDONDO es cita,
   CUADRADO es evento, y la G de Google gana a las dos. La forma es lo que
   sobrevive a la ceguera al color.

   B13 · remate (AG-DT-280, PIEZAS-MES §3): con la v2, la fila de la Semana del teléfono (`FilaLista`
   v2): hora con el fin debajo, barra del estado, nombre y «duración · motivo», estado en círculo y
   chevrón. Mismas clases de la Semana (`ag-listafila-*`), SIN `data-cita-id` (ése es el contrato de la
   tarjeta pintada, y esta fila no lo es). Apagada, la fila de siempre. */
export const FilaDelPanel = memo(function FilaDelPanel(
  { fila, onAbrir }: { fila: FilaDelDia; onAbrir: (id: string) => void },
) {
  const v2 = useSinAvisoFlotante()
  if (v2) return <FilaDelPanelV2 fila={fila} onAbrir={onAbrir} />
  return (
    <button type="button" className="ag-mespanel-fila" onClick={() => onAbrir(fila.id)}>
      <span className={`ag-mespanel-hora${fila.todoElDia ? ' ag-mespanel-hora--todo' : ''}`}>
        {fila.hora}
      </span>
      {fila.esDeGoogle
        ? <IconoGoogleCalendar size={11} />
        : <span
            className={`ag-mespanel-punto${fila.esEvento ? ' ag-mespanel-punto--cuadro' : ''}`}
            style={{ background: fila.tinta }}
          />}
      {fila.origenGoogle && <MarcaOrigenGoogle size={11} />}
      <span className={`ag-mespanel-nombre${fila.cancelada ? ' ag-mespanel-nombre--cancelada' : ''}`}>
        {fila.nombre}
      </span>
      {!fila.esDeGoogle && <MarcasCita enlace={fila.deEnlace} sinExpediente={fila.sinExpediente} size={12} soloV2 />}
      <ChevronRight size={15} className="ag-mespanel-chev" aria-hidden />
    </button>
  )
})

function FilaDelPanelV2({ fila, onAbrir }: { fila: FilaDelDia; onAbrir: (id: string) => void }) {
  const marca = { '--ag-ev-marca': fila.tinta } as CSSProperties
  return (
    <button type="button" className="ag-mespanel-fila ag-mespanel-fila--v2" onClick={() => onAbrir(fila.id)}>
      <span className="ag-listafila ag-listafila--v2" style={marca}>
        <span className="ag-listafila-hora">
          {fila.todoElDia ? <span>todo el día</span> : <><b>{fila.hora}</b>{fila.fin && <span>{fila.fin}</span>}</>}
        </span>
        <span className="ag-listafila-barra" aria-hidden="true" />
        <span className="ag-listafila-cuerpo">
          <span className={fila.cancelada ? 'ag-listafila-nombre ag-listafila-nombre--cancelada' : 'ag-listafila-nombre'}>
            {fila.esDeGoogle && <IconoGoogleCalendar size={12} />}
            {fila.origenGoogle && <MarcaOrigenGoogle size={12} />}
            {fila.nombre}
            {!fila.esDeGoogle && <MarcasCita enlace={fila.deEnlace} sinExpediente={fila.sinExpediente} size={12} soloV2 />}
          </span>
          {(fila.duracion || fila.motivo) && (
            <span className="ag-listafila-linea2">
              {fila.duracion}{fila.duracion && fila.motivo && <span aria-hidden="true"> · </span>}{fila.motivo}
            </span>
          )}
        </span>
        {fila.status && !fila.esEvento && !fila.esDeGoogle && <IconoEstadoCita estado={fila.status} texto="nunca" />}
        <ChevronRight size={16} className="ag-listafila-chevron" aria-hidden />
      </span>
    </button>
  )
}
