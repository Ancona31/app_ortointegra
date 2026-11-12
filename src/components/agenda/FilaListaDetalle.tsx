/**
 * src/components/agenda/FilaListaDetalle.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { IconoEvento } from '@/lib/appointments'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import { GoogleGIcon } from './GoogleGIcon'
import { IconoDelEvento } from './IconoDelEvento'

/* El glifo de cada estado en la píldora de `listDay`. Sale del mockup, que dibuja
   cuatro de los cinco; el de «cancelada» —la ✕— no lo dibuja porque su fila de
   ejemplo no aparece, así que lo elige esta línea y es lo único de la píldora
   que no viene de allí.
   ⚠️ VAN CON `aria-hidden`: son adorno, y quien nombra el estado es la etiqueta
   de al lado. Un lector de pantalla que leyera «punto Agendada» diría de más.
   ⚠️ F1.8 (decisión 9 corregida): AGENDADA ES `○` Y CONFIRMADA `●`. Compartían
   `●`, y desde que la tarjeta de Semana dejó de escribir el estado el glifo es
   lo único que lo dice sin color: hueco = «aún sin confirmar», lleno =
   confirmada. La tarjeta de la rejilla lo importa de aquí, así que la píldora
   de `listDay` y la hora de Semana no pueden divergir. */
export const GLIFO_PILDORA: Record<Status, string> = {
  scheduled: '○', confirmed: '●', attended: '✓', no_show: '—', cancelled: '✕',
}

/* La fila ANCHA, sólo de `listDay`. DOS renglones desde F1.14 (eran cuatro y
   cada cita ocupaba 110–130 px a 390): el nombre, y debajo «duración · motivo»
   con la píldora a la derecha. La marca, a la izquierda.

   ⚠️ ES UN COMPONENTE APARTE Y NO UNA RAMA DE `FilaLista`, a propósito. Son dos
   ÁRBOLES distintos —éste tiene envoltorio de cuerpo y tres hijos que el
   compacto no monta—, no dos hojas de estilo del mismo markup. Y separarlos es
   lo que garantiza que `listWeek` no se entere de este paso: su componente no se
   ha tocado. Si algún día se fusionan, el que hay que volver a mirar es el
   compacto.

   ⚠️ LA DURACIÓN VA EN EL SEGUNDO RENGLÓN Y NO BAJO LA HORA, que es donde la
   pone el mockup: la columna de la hora la compone el plugin y para un evento
   CON HORA no pasa por ningún generador de contenido
   (`@fullcalendar/list/internal.js:103`), así que ahí no se puede inyectar
   nada. Tampoco en el renglón del nombre: un nombre largo se la comería.

   ⚠️ EL MOTIVO SON LAS NOTAS Y NADA MÁS. Sin notas no hay renglón. El mockup
   escribe «Google Calendar · solo lectura» en esa línea para los de Google; aquí
   NO se compone: sería un respaldo inventado, y es el mismo respaldo que se
   revocó en la tarjeta de la rejilla (ver el aviso de `descriptor` en
   `MemoizedEventContent`). No lo repongas. */
export const FilaListaDetalle = memo(function FilaListaDetalle(
  { citaId, nombre, esDeGoogle, icono, cancelada, duracion, motivo, status, esEvento }: {
    /** F1.4 · `data-cita-id`, el contrato del movimiento (bloque F §2). */
    citaId: string
    nombre: string; esDeGoogle: boolean; icono: IconoEvento | null
    cancelada: boolean; duracion: string | null; motivo: string | null
    status: Status | undefined; esEvento: boolean
  },
) {
  /* ⚠️ EL COLOR NO SE CALCULA AQUÍ Y NO ES UN OLVIDO: sale de `--ag-ev-marca`,
     la variable que `clasesDelEvento` ya declara en el `<tr>` de la fila y que
     baja por herencia hasta aquí. Es la MISMA que pinta el punto del compacto,
     así que las dos variantes no pueden divergir de color. */
  const marca = esDeGoogle
    ? <span className="ag-listadia-slot"><GoogleGIcon size={19} /></span>
    : icono
      ? <span className="ag-listadia-slot"><IconoDelEvento nombre={icono} size={21} color="var(--ag-ev-marca)" /></span>
      : <span className="ag-listadia-punto" />
  /* La píldora de ESTADO es de las citas. Un evento genérico sí tiene estado en
     este producto —`ESTADOS_EVENTO`, dos de los cinco— pero aquí no se pinta, y
     eso NO reabre el bug de la píldora de la rejilla (ver su aviso en
     globals.css): allí el problema era la misma información en dos formas en la
     misma columna; aquí no hay texto de estado en ninguna fila, y la única que
     importa de un vistazo —cancelada— sigue diciéndose con el tachado. La de
     Google dice lo mismo que el badge de `MonthChip` y el de `GoogleEventCard`. */
  const pildora = status && !esEvento && !esDeGoogle
    ? <span className="ag-listadia-pildora"><span aria-hidden="true">{GLIFO_PILDORA[status]}</span>{STATUS_CONFIG[status].label}</span>
    : esDeGoogle ? <span className="ag-listadia-pildora ag-listadia-pildora--gcal">Evento</span> : null
  /* ⚠️ LA PÍLDORA VA EN LA SEGUNDA LÍNEA, A LA DERECHA, y no junto al nombre:
     a 390 px el nombre comparte la celda con la hora y la marca, y con la
     píldora al lado «Paciente Prueba 01» ya bajaba a dos líneas (medido: la
     fila pasaba de 72 px). Así el nombre tiene la línea entera. */
  return (
    <span className="ag-listadia" data-cita-id={citaId}>
      {marca}
      <span className="ag-listadia-cuerpo">
        <span className={cancelada ? 'ag-listadia-nombre ag-listadia-nombre--cancelada' : 'ag-listadia-nombre'}>
          {nombre}
        </span>
        {(duracion || motivo || pildora) && (
          <span className="ag-listadia-linea2">
            <span className="ag-listadia-detalle">
              {duracion && <span className="ag-listadia-dur">{duracion}</span>}
              {duracion && motivo && <span aria-hidden="true"> · </span>}
              {motivo && <span className="ag-listadia-meta">{motivo}</span>}
            </span>
            {pildora}
          </span>
        )}
      </span>
    </span>
  )
})
