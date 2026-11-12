/**
 * src/lib/agenda/listaHoy.ts
 *
 * F1.12 · La lista de Semana del teléfono abre en HOY y no en el lunes. Ayuda de
 * DOM: pone el `scrollTop` del desplazador de la lista en la cabecera del día de
 * hoy. Si hoy no tiene filas (la lista sólo pinta los días con citas), en la del
 * primer día posterior; si no hay ninguno, no mueve nada.
 *
 * ⚠️ SE MIDE CON `getBoundingClientRect` Y NO CON `offsetTop`: la cabecera de día
 * es pegajosa (`.fc-list-sticky`) y su `offsetTop` cuelga de la tabla, no del
 * desplazador. El `<tr>` conserva su posición de flujo aunque sus `<th>` estén
 * pegados, así que la resta de rectángulos es la distancia real.
 */

/** «AAAA-MM-DD» del día LOCAL de `d`, el mismo formato que `data-date` de FullCalendar. */
export function diaLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Desplaza la lista de Semana a hoy. Devuelve `true` si encontró dónde. */
export function desplazarListaAHoy(raiz: ParentNode, hoyISO: string): boolean {
  const desplazador = raiz.querySelector<HTMLElement>('.fc-listWeek-view .fc-scroller')
  if (!desplazador) return false
  const cabeceras = Array.from(raiz.querySelectorAll<HTMLElement>('.fc-listWeek-view tr.fc-list-day[data-date]'))
  const destino = cabeceras.find(c => (c.dataset.date ?? '') >= hoyISO)
  if (!destino) return false
  desplazador.scrollTop += destino.getBoundingClientRect().top - desplazador.getBoundingClientRect().top
  return true
}
