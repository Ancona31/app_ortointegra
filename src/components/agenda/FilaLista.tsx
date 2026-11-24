/**
 * src/components/agenda/FilaLista.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { IconoEvento } from '@/lib/appointments'
import { GoogleGIcon } from './GoogleGIcon'
import { MarcaOrigenGoogle } from './MarcaOrigenGoogle'
import { MarcasCita } from './MarcasCita'
import { IconoDelEvento } from './IconoDelEvento'
import { useSinAvisoFlotante } from './MemoizedEventContent'
import IconoEstadoCita from '@/components/ui/IconoEstadoCita'
import type { Status } from '@/lib/agenda/tiposAgenda'

/** B13 · AG3 · Lo que la fila de la Semana del teléfono enseña con la v2 (maqueta `ag-semana`). */
export interface DetalleFilaV2 {
  /** «08:00», o `null` en un evento de todo el día. */
  inicio: string | null
  fin: string | null
  duracion: string | null
  motivo: string | null
  status?: Status
  esEvento: boolean
}

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
  { citaId, nombre, esDeGoogle, origenGoogle = false, deEnlace = false, sinExpediente = false, icono, tinta, cancelada, detalle }: {
    /** F1.4 · `data-cita-id`, el contrato del movimiento (bloque F §2). */
    citaId: string
    nombre: string; esDeGoogle: boolean; icono: IconoEvento | null
    tinta: string | null; cancelada: boolean
    /** Tanda J, punto 11 · fila de Spinus nacida en Google: su «G» (sólo con la v2). */
    origenGoogle?: boolean
    /** Tanda K, sección E · el eslabón (reservada por enlace) y el expediente tachado (sólo con la v2). */
    deEnlace?: boolean; sinExpediente?: boolean
    /** B13 · AG3 · Con la v2, la fila de la maqueta: hora apilada, barra, dos renglones y el estado. */
    detalle?: DetalleFilaV2
  },
) {
  const v2 = useSinAvisoFlotante()
  if (v2 && detalle) {
    return (
      <FilaListaV2 citaId={citaId} nombre={nombre} esDeGoogle={esDeGoogle} origenGoogle={origenGoogle}
        deEnlace={deEnlace} sinExpediente={sinExpediente} icono={icono} tinta={tinta} cancelada={cancelada} detalle={detalle} />
    )
  }
  return (
    <span className="ag-listafila" data-cita-id={citaId}>
      {esDeGoogle && <GoogleGIcon size={11} />}
      {!esDeGoogle && origenGoogle && <MarcaOrigenGoogle size={11} />}
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
      {!esDeGoogle && <MarcasCita enlace={deEnlace} sinExpediente={sinExpediente} size={12} soloV2 />}
    </span>
  )
})

/* B13 · AG3 · LA FILA DE LA SEMANA DEL TELÉFONO CON LA V2 (versión A, PIEZAS §6).
   Hora 13/600 con el fin debajo · barra de 3 px del estado (la pinta la hoja con
   `--ag-ev-marca`, la variable de siempre) · nombre 15/600 y debajo
   «duración · motivo» en 13 · el estado en círculo de 26 · chevrón. La celda de
   hora y la del punto del plugin se ocultan con la v2 (globals.css, bloque de
   VISTAS): la hora va aquí porque la del plugin es una sola cadena y no se apila.
   Mismos `data-cita-id`, clase raíz y nombre que la compacta. */
function FilaListaV2({ citaId, nombre, esDeGoogle, origenGoogle, deEnlace, sinExpediente, icono, tinta, cancelada, detalle }: {
  citaId: string; nombre: string; esDeGoogle: boolean; origenGoogle: boolean; deEnlace: boolean; sinExpediente: boolean
  icono: IconoEvento | null; tinta: string | null; cancelada: boolean; detalle: DetalleFilaV2
}) {
  const { inicio, fin, duracion, motivo, status, esEvento } = detalle
  return (
    <span className="ag-listafila ag-listafila--v2" data-cita-id={citaId}>
      <span className="ag-listafila-hora">
        {inicio ? <><b>{inicio}</b>{fin && <span>{fin}</span>}</> : <span>todo el día</span>}
      </span>
      <span className="ag-listafila-barra" aria-hidden="true" />
      <span className="ag-listafila-cuerpo">
        <span className={cancelada ? 'ag-listafila-nombre ag-listafila-nombre--cancelada' : 'ag-listafila-nombre'}>
          {esDeGoogle && <GoogleGIcon size={12} />}
          {!esDeGoogle && origenGoogle && <MarcaOrigenGoogle size={12} />}
          {icono && <IconoDelEvento nombre={icono} size={13} color={tinta ?? undefined} />}
          {nombre}
          {!esDeGoogle && <MarcasCita enlace={deEnlace} sinExpediente={sinExpediente} size={12} soloV2 />}
        </span>
        {(duracion || motivo) && (
          <span className="ag-listafila-linea2">
            {duracion}{duracion && motivo && <span aria-hidden="true"> · </span>}{motivo}
          </span>
        )}
      </span>
      {status && !esEvento && !esDeGoogle && <IconoEstadoCita estado={status} texto="nunca" />}
      <svg className="ag-listafila-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </span>
  )
}
