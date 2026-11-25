'use client'

import { differenceInCalendarDays } from 'date-fns'
import { type FilaDelDia, frasearConteoBreve, contarFilas } from '@/lib/agenda/conteoAgenda'
import { FilaDelPanel } from '@/components/agenda/FilaDelPanel'

/* ═══ PANEL DEL DÍA SELECCIONADO (bloque 6 · paso 9) ════════════════════════
   Va DEBAJO de la cuadrícula del mes y NO lo pinta FullCalendar: es un
   componente propio alimentado por `getEvents()`.

   ⚠️ EXISTE PORQUE LA CELDA DEL MES NO ES UNA RUTA TÁCTIL. A 390 px cada celda
   mide ~51 px de ancho y ~52 de alto, y dentro caben tres PUNTOS de 5 px. Un
   punto de 5 px no es un objetivo pulsable —el mínimo son 44— y tampoco dice
   qué hay: contesta «cuánto», no «qué». El «qué» y el dedo viven aquí.

   ⚠️ Y POR ESO LA CUADRÍCULA PASÓ A MODO PUNTO. Antes cada celda intentaba
   pintar el chip de escritorio —marcador, hora y nombre— dentro de esos 51 px:
   la hora salía cortada a media palabra y el nombre no salía. El chip no se
   retiró del código, se APAGA por hoja en móvil (ver `.ag-mes` en globals.css);
   así Mes sigue teniendo UN solo renderizador de evento y no dos que puedan
   divergir. */

/* «mié, 19 ago». A nivel de módulo: un `Intl.DateTimeFormat` nuevo por render
   es caro y aquí no depende de nada que cambie. La mayúscula inicial la pone un
   `::first-letter` en la hoja, igual que en el resto de la agenda. */
const FMT_DIA_PANEL = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })

/* La cabecera del panel: fecha, conteo del día y la salida a la vista Día.
   Va PEGAJOSA (`position: sticky` en la hoja) porque el panel scrollea y sin
   ella una lista larga deja de decir de qué día es. */
export function PanelDelDia(
  { dia, filas, onAbrir, onVerDia }: {
    dia: Date; filas: readonly FilaDelDia[]
    onAbrir: (id: string) => void; onVerDia: () => void
  },
) {
  const esHoy = differenceInCalendarDays(dia, new Date()) === 0
  /* La forma BREVE: este panel es de móvil y su cabecera comparte fila con la
     fecha y con el enlace de salida. Mismo criterio que el subtítulo de la
     banda. */
  const conteo = frasearConteoBreve(contarFilas(filas))
  return (
    <section className="ag-mespanel" aria-label="Citas del día seleccionado">
      <div className="ag-mespanel-cab">
        <h2>{FMT_DIA_PANEL.format(dia)}{esHoy ? ' · hoy' : ''}</h2>
        <span className="ag-mespanel-conteo">{conteo || 'sin citas'}</span>
        <button type="button" className="ag-mespanel-verdia" onClick={onVerDia}>Ver día ›</button>
      </div>
      {filas.map(f => <FilaDelPanel key={f.id} fila={f} onAbrir={onAbrir} />)}
      {filas.length === 0 && <p className="ag-mespanel-vacio">Sin citas este día</p>}
    </section>
  )
}
