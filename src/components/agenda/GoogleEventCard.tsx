/**
 * src/components/agenda/GoogleEventCard.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import { GoogleGIcon } from './GoogleGIcon'

/* Tarjeta de evento del calendario de Google (no arrastrable). Solo
   presentación: la lógica de fetch/resta de Google no se toca.

   UNA SOLA COSA, y antes eran dos. La prop `busy` separaba estos eventos de
   los bloques anónimos de "Ocupado" que venían del calendario PERSONAL del
   médico vía freebusy. Ese carril se eliminó entero —scope incluido—, así que
   aquí ya no llega nada anónimo: todo lo que pinta esta tarjeta viene del
   calendario de Spinus, tiene título real y no tiene cita ligada. De ahí que
   la etiqueta haya dejado de ser condicional.

   NO SE VUELVE A METER EL CANDADO. Pintarlo aquí producía cosas como
   "🔒 Cita médica: Pedro Gonzalo Hernández Mendoza": el título completo debajo
   de un icono que promete privacidad. */
export const GoogleEventCard = memo(function GoogleEventCard({
  timeText, title,
}: { timeText: string; title: string }) {
  /* SIN UN SOLO ESTILO EN LÍNEA, y a propósito: aquí no hay ningún valor
     calculado en JS —ni estado, ni color elegido, ni paciente— así que la caja
     entera cabe en `globals.css` y la vista Día la vuelve horizontal desde allí,
     igual que a la tarjeta de cita. Si alguna vez hace falta un color derivado
     de datos, ése y sólo ése vuelve a línea. */
  return (
    <div className="ag-gcal">
      <div className="ag-gcal-cab">
        <GoogleGIcon size={12} />
        <span className="ag-gcal-hora">{timeText}</span>
        <span className="ag-gcal-badge">
          {/* "Evento", y antes decía "Sin cita". Aquel texto venía del modelo
              viejo, cuando la etiqueta servía para separar estos eventos de los
              bloques de "Ocupado" de freebusy. Eliminado freebusy (§12.6) sólo
              queda un tipo de evento, y lo único que hacía ese texto era
              sugerir que a la cita le falta algo. "Evento" lo distingue de una
              cita sin insinuar carencia.

              NADA DE "GCal" NI DE ABREVIATURAS TÉCNICAS: el médico no tiene por
              qué saber qué es, y el icono de Google que ya lleva la tarjeta
              identifica el origen de sobra. */}
          Evento
        </span>
      </div>
      <span className="ag-gcal-titulo">{title}</span>
    </div>
  )
})
