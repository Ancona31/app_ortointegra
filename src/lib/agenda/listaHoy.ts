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

/* Lo mínimo del DOM que se usa (un `ParentNode` real lo cumple): así la
   repetición se prueba en Vitest sin navegador. */
interface DesplazadorLista { scrollTop: number; readonly scrollHeight: number; getBoundingClientRect(): { top: number } }
interface CabeceraLista { getAttribute(nombre: string): string | null; getBoundingClientRect(): { top: number } }
export interface RaizLista {
  querySelector(selector: string): DesplazadorLista | null
  querySelectorAll(selector: string): ArrayLike<CabeceraLista>
}

/** Desplaza la lista de Semana a hoy. Devuelve `true` si encontró dónde. */
export function desplazarListaAHoy(raiz: RaizLista, hoyISO: string): boolean {
  const desplazador = raiz.querySelector('.fc-listWeek-view .fc-scroller')
  if (!desplazador) return false
  const cabeceras = Array.from(raiz.querySelectorAll('.fc-listWeek-view tr.fc-list-day[data-date]'))
  const destino = cabeceras.find(c => (c.getAttribute('data-date') ?? '') >= hoyISO)
  if (!destino) return false
  desplazador.scrollTop += destino.getBoundingClientRect().top - desplazador.getBoundingClientRect().top
  return true
}

/** Cuadros como máximo que se repite el desplazamiento (≈ 160 ms). */
const MAX_CUADROS = 10

/**
 * Desplaza a hoy y lo REPITE cuadro a cuadro mientras la lista cambie de alto
 * (como mucho `MAX_CUADROS`). Al acabar llama a `alTerminar(true)`; si no hay a
 * dónde (aún sin filas), a `alTerminar(false)`: sigue pendiente.
 *
 * Por qué (medido el 2026-11-14 en el teléfono): en el primer cuadro las
 * cabeceras de día miden 17 px y en el siguiente 38, y el navegador recorta el
 * `scrollTop` al alto de ESE momento. Con hoy cerca del final de la lista
 * (viernes por la tarde, sábado, domingo) se quedaba a medio camino.
 */
export function desplazarListaAHoyEstable(
  raiz: RaizLista, hoyISO: string, alTerminar: (llego: boolean) => void,
  siguienteCuadro: (f: () => void) => void = f => { requestAnimationFrame(f) },
): void {
  let cuadros = 0
  let altoAntes = -1
  const paso = (): void => {
    if (!desplazarListaAHoy(raiz, hoyISO)) { alTerminar(false); return }
    const alto = raiz.querySelector('.fc-listWeek-view .fc-scroller')?.scrollHeight ?? -1
    cuadros += 1
    if (alto === altoAntes || cuadros >= MAX_CUADROS) { alTerminar(true); return }
    altoAntes = alto
    siguienteCuadro(paso)
  }
  paso()
}
