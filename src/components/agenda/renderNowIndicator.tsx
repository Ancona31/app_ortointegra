/**
 * src/components/agenda/renderNowIndicator.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import type { ReactElement } from 'react'
import type { NowIndicatorContentArg } from '@fullcalendar/core'

/* ─── Indicador de hora actual ──────────────────────────
   FullCalendar monta DOS elementos por tic: la línea, dentro de la columna del
   día (`isAxis: false`), y un marcador dentro del <td> del gutter
   (`isAxis: true`, timegrid/internal.js:885). Las dos posiciones son NATIVAS y
   `nowIndicatorContent` NO cambia dónde se monta nada: sólo decide qué va
   dentro de cada uno. Por eso la hora se escribe en la rama de la LÍNEA —que es
   la que está sobre el día de hoy— y la del gutter se queda vacía; el marcador
   del eje se apaga aparte, en globals.css.
   La hora la refresca el propio temporizador de FullCalendar (`NowTimer`, a
   'minute' cuando nowIndicator está encendido): NO montar un setInterval. */

/* A nivel de módulo por las dos razones de siempre: identidad estable —si
   cambiara en cada render, FullCalendar remontaría el indicador cada vez— y un
   Intl que no se reconstruye en cada minuto.
   `hourCycle: 'h23'` y no `hour12: false`: el segundo deja pasar «24:00» en
   algunas locales, y la rejilla de al lado escribe «00:00». */
const FORMATO_HORA_AHORA = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function renderNowIndicator(arg: NowIndicatorContentArg): ReactElement | null {
  /* El marcador del gutter ya no dice nada: lo dice la columna. El elemento
     sigue montándose (esto sólo vacía su contenido), y quien lo esconde es la
     regla de `.fc-timegrid-now-indicator-arrow` en globals.css. */
  if (arg.isAxis) return null
  /* ⚠️ NO USES `arg.date` AQUÍ. NO ES LA HORA ACTUAL EN ESTA RAMA, y el fallo
     es mudo: sale un `00:00` perfectamente formateado.
     Las dos ramas reciben cosas distintas. En el eje, FullCalendar construye el
     contenedor con la hora de su temporizador (`date: nowDate`,
     timegrid/internal.js:885). En la línea lo construye con
     `date: this.props.date` de la TimeCol (timegrid/internal.js:783 y :793),
     que es la fecha de la COLUMNA que se está pintando — o sea medianoche de
     ese día. El instante del indicador sí existe ahí (`seg.start`), pero no se
     le pasa al contenedor, así que desde el hook no hay forma de leerlo.
     Tampoco sirve pedírselo al calendario: el `nowDate` vive en el estado
     interno del `NowTimer` (core, NowTimerState.nowDate), no en `CalendarData`,
     y lo más cercano —`getCurrentData().nowManager.getDateMarker()`— cuelga de
     `CalendarImpl`, que la interfaz pública `CalendarApi` no declara; llegar
     ahí desde `arg.view.calendar` pediría API interna o un `as`.
     Así que se toma el reloj del sistema EN CADA EVALUACIÓN del hook. Quien
     provoca esas evaluaciones es el temporizador de FullCalendar, que con
     `nowIndicator` corre a 'minute' (timegrid/internal.js:1053) y reposiciona
     la línea: por eso la hora se refresca sola y NO hace falta un intervalo
     propio. Es la misma hora que la de la línea mientras el calendario vaya con
     el reloj del sistema, que es el caso: no hay opción `now` ni `timeZone` en
     el <FullCalendar> de abajo. Si alguien añade cualquiera de las dos, esta
     línea deja de estar sincronizada y hay que revisarla.

     `aria-hidden` NO es decorativo, aunque lo parezca. Un lector de pantalla
     leería un número suelto en mitad de la columna, sin nada que diga qué es, y
     la hora ya la da el sistema por otras vías. Ahora además importa MÁS que
     cuando esto vivía en el gutter: el <td> del eje venía con aria-hidden de
     fábrica en una de las dos variantes de layout, y la columna del día no
     viene con ninguno.
     La clase la estiliza globals.css: este <span> es el que lleva la píldora,
     no el elemento de la línea que lo contiene. */
  return (
    <span className="ag-hora-ahora" aria-hidden>
      {FORMATO_HORA_AHORA.format(new Date())}
    </span>
  )
}
