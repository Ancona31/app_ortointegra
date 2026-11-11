/**
 * src/components/agenda/MonthChip.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { EventContentArg } from '@fullcalendar/core'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { esEventoGenerico, tintasDelChipDeMes } from '@/lib/agenda/tarjetasAgenda'
import { GoogleGIcon } from './GoogleGIcon'
import { IconoDelEvento } from './IconoDelEvento'

/* Chip de una línea para la Vista Mes (dayGridMonth). Branch DEDICADO: NO
   comparte caja con `MemoizedEventContent` (Semana/Día). Una sola fila:
   marcador · hora · icono · nombre, y la píldora «Evento» si viene de Google.

   ⚠️ SU FONDO VA EN ESTE `<div>` Y NUNCA EN EL `<a>` RAÍZ, que es el harness
   transparente de `globals.css` (`.fc .fc-event`, con `!important`). Este chip
   es el más expuesto de los tres: no tiene borde ni sombra, así que la píldora
   de aquí es la única superficie que se ve. */
export const MonthChip = memo(function MonthChip({ arg }: { arg: EventContentArg }) {
  const ext = arg.event.extendedProps as Appointment & { isGcalBlock?: boolean }
  // Todo lo que llega marcado como bloque de Google es un evento del calendario
  // de Spinus sin cita ligada. La distinción con los bloques anónimos de
  // "Ocupado" murió con freebusy; mismo criterio que GoogleEventCard.
  const isGcal = !!ext?.isGcalBlock
  const esEvento = esEventoGenerico(ext)
  const { fondo, tinta, hora } = tintasDelChipDeMes(ext, isGcal, esEvento)
  // El MISMO nombre que enseña la semana. Antes era `arg.event.title` a secas,
  // así que una cita salía con el motivo escrito en el alta y no con el
  // paciente, que es lo que el médico busca al barrer el mes con la vista.
  const pac = ext?.pacientes

  return (
    <div
      className={`ag-mes${isGcal ? ' ag-mes--gcal' : ''}${esEvento ? ' ag-mes--evento' : ''}${
        ext?.status === 'cancelled' ? ' ag-mes--cancelada' : ''}`}
      style={{ background: fondo }}
    >
      {/* El hueco del marcador. La G de Google gana a todo: es una marca y va en
          sus cuatro colores. Lo demás es el punto, redondo en una cita y
          cuadrado en un evento — el icono ya NO lo sustituye, va detrás. */}
      {isGcal
        ? <GoogleGIcon size={10} />
        : <span
            className={esEvento ? 'ag-mes-punto ag-mes-punto--cuadro' : 'ag-mes-punto'}
            style={{ background: tinta }}
          />}
      {arg.timeText && <span className="ag-mes-hora" style={{ color: hora }}>{arg.timeText}</span>}
      {ext?.icono && (
        <span className="ag-mes-icono">
          <IconoDelEvento nombre={ext.icono} size="var(--ag-mes-icono-px)" color={tinta} />
        </span>
      )}
      <span className="ag-mes-nombre">{pac ? `${pac.nombre} ${pac.apellidos}` : arg.event.title}</span>
      {isGcal && (
        <span className="ag-mes-badge">
          {/* Mismo texto y mismo motivo que en GoogleEventCard, donde está
              razonado entero: "Sin cita" era del modelo viejo —separaba estos
              eventos de los bloques de "Ocupado" de freebusy, ya eliminado
              (§12.6)— e insinuaba que a la cita le falta algo. Los dos sitios
              cambian a la vez o la agenda dice dos cosas distintas del mismo
              evento según la vista. */}
          Evento
        </span>
      )}
    </div>
  )
})
