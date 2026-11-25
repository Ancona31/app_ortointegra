/**
 * src/components/agenda/MonthChip.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo, type CSSProperties } from 'react'
import { nombreCortoPaciente } from '@/lib/agenda/nombresTarjeta'
import type { EventContentArg } from '@fullcalendar/core'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG, esEventoGenerico, marcaPorLigar, marcasDeCita, tintasDelChipDeMes } from '@/lib/agenda/tarjetasAgenda'
import { GoogleGIcon } from './GoogleGIcon'
import { MarcaOrigenGoogle } from './MarcaOrigenGoogle'
import { MarcasCita } from './MarcasCita'
import { IconoDelEvento } from './IconoDelEvento'
import { etiquetaV2, useSinAvisoFlotante } from './MemoizedEventContent'

/* Chip de una línea para la Vista Mes (dayGridMonth). Branch DEDICADO: NO
   comparte caja con `MemoizedEventContent` (Semana/Día). Una sola fila:
   marcador · hora · icono · nombre, y la píldora «Evento» si viene de Google.

   ⚠️ SU FONDO VA EN ESTE `<div>` Y NUNCA EN EL `<a>` RAÍZ, que es el harness
   transparente de `globals.css` (`.fc .fc-event`, con `!important`). Este chip
   es el más expuesto de los tres: no tiene borde ni sombra, así que la píldora
   de aquí es la única superficie que se ve. */
/* G3 (punto 16) · `sinAvisoFlotante`: con la agenda v2, ningún `title` en la
   cita (el de la marca «Por ligar» incluido); lo dice la etiqueta accesible
   de la caja, como en `MemoizedEventContent` (y por el mismo camino,
   `useSinAvisoFlotante`, para no cambiar `eventContent` de FullCalendar). */
export const MonthChip = memo(function MonthChip({ arg }: { arg: EventContentArg }) {
  const sinAvisoFlotante = useSinAvisoFlotante()
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
  // D6: «Por ligar» con la misma píldora que «Evento» de Google; `null` en el resto.
  const marca = ext ? marcaPorLigar(ext) : null
  /* Tanda J, punto 11 · una fila de Spinus nacida en Google: su «G» detrás del punto (sólo con la v2). */
  const origenGoogle = !isGcal && ext?.origen === 'google'
  /* Tanda K, sección E · con la v2, el eslabón y el expediente tachado en vez de la píldora. */
  const procedencia = marcasDeCita(ext ?? {})

  return (
    <div
      data-cita-id={arg.event.id}
      {...(sinAvisoFlotante && ext?.status && !isGcal
        ? { role: 'group', 'aria-label': etiquetaV2(pac ? `${pac.nombre} ${pac.apellidos}` : arg.event.title, STATUS_CONFIG[ext.status].label,
            { sinExpediente: procedencia.sinExpediente, deEnlace: procedencia.enlace, origenGoogle, historial: procedencia.historial }) }
        : {})}
      className={`ag-mes${isGcal ? ' ag-mes--gcal' : ''}${esEvento ? ' ag-mes--evento' : ''}${
        ext?.status === 'cancelled' ? ' ag-mes--cancelada' : ''}`}
      /* B13 · AG4 · `--ag-mes-tinta`: la barra de 3 px del chip de la v2 (globals.css, bloque de VISTAS). */
      style={{ background: fondo, '--ag-mes-tinta': tinta } as CSSProperties}
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
      {origenGoogle && <MarcaOrigenGoogle size={10} decorativa />}
      {arg.timeText && <span className="ag-mes-hora" style={{ color: hora }}>{arg.timeText}</span>}
      {ext?.icono && (
        <span className="ag-mes-icono">
          <IconoDelEvento nombre={ext.icono} size="var(--ag-mes-icono-px)" color={tinta} />
        </span>
      )}
      {/* B13 · AG4 · Con la v2, el nombre corto de la rejilla («Paciente P.», PIEZAS-MES §1); el entero va
          en la etiqueta accesible de la caja. Un evento conserva su título. */}
      <span className="ag-mes-nombre">{pac
        ? (sinAvisoFlotante ? nombreCortoPaciente(pac.nombre, pac.apellidos) : `${pac.nombre} ${pac.apellidos}`)
        : arg.event.title}</span>
      {sinAvisoFlotante
        ? <MarcasCita enlace={procedencia.enlace} sinExpediente={procedencia.sinExpediente} size={11} decorativa />
        : marca && <span className="ag-mes-badge" title={marca.titulo}>{marca.texto}</span>}
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
