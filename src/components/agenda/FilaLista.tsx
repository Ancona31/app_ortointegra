/**
 * src/components/agenda/FilaLista.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { IconoEvento } from '@/lib/appointments'
import { GoogleGIcon } from './GoogleGIcon'
import { IconoDelEvento } from './IconoDelEvento'

/* La fila de una vista de lista, variante COMPACTA (`listWeek`, y `listDay`
   hasta que el paso siguiente le dé su variante de detalle).

   ⚠️ AQUÍ NO VA LA HORA, Y NO ES UN OLVIDO. La pinta el plugin en una celda
   PROPIA (`<td class="fc-list-event-time">`) que queda fuera de `eventContent`,
   y para un evento con hora ni siquiera pasa por un generador de contenido
   (`@fullcalendar/list/internal.js:103`). Lo que llega aquí en `arg.timeText` es
   la cadena VACÍA —el `EventContainer` de la lista se construye con
   `timeText: ""`, `:56`—, así que leerla no daría nada. La columna existe; lo
   único que se hace con ella es darle forma, desde `globals.css`.

   ⚠️ Y TAMPOCO VA LA MARCA DE COLOR. Vive en la otra celda que el plugin
   construye a mano, y se pinta por hoja de estilos con los marcadores de
   `clasesDelEvento`. Ver su nota.

   LA «G» DE GOOGLE SÍ VIENE AQUÍ, y es la excepción de las tres marcas: es de
   cuatro colores por definición, así que ni una regla de color ni una máscara
   pueden producirla, y el nodo del plugin no admite hijos. Va en línea delante
   del nombre, exactamente en el sitio donde un evento genérico lleva su icono.
   El componente es el mismo que ya usan `MonthChip` y `GoogleEventCard`. */
export const FilaLista = memo(function FilaLista(
  { citaId, nombre, esDeGoogle, icono, tinta, cancelada }: {
    /** F1.4 · `data-cita-id`, el contrato del movimiento (bloque F §2). */
    citaId: string
    nombre: string; esDeGoogle: boolean; icono: IconoEvento | null
    tinta: string | null; cancelada: boolean
  },
) {
  return (
    <span className="ag-listafila" data-cita-id={citaId}>
      {esDeGoogle && <GoogleGIcon size={11} />}
      {/* 13 px es el `.ico--sm` del mockup, el tamaño del icono cuando acompaña
          al nombre en vez de ocupar su propio cuadro. El color es el del evento,
          igual que en la tarjeta de la rejilla y en el chip del mes. */}
      {icono && <IconoDelEvento nombre={icono} size={13} color={tinta ?? undefined} />}
      {/* ⚠️ TACHADO SÓLO EN CANCELADA. «No asistió» NO lo lleva, y la distinción
          es del mockup: la cita SÍ ocurrió en la agenda, el paciente no llegó.
          Son cosas distintas y se ven distintas. */}
      <span className={cancelada ? 'ag-listafila-nombre ag-listafila-nombre--cancelada' : 'ag-listafila-nombre'}>
        {nombre}
      </span>
    </span>
  )
})
