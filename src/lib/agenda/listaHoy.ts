/**
 * src/lib/agenda/listaHoy.ts
 *
 * F1.12 · La lista de Semana del teléfono abre en HOY y no en el lunes. Ayuda de
 * DOM: pone el `scrollTop` del desplazador de la lista en la cabecera del día de
 * hoy. Si hoy no tiene filas (la lista sólo pinta los días con citas), en la del
 * primer día posterior; si no hay ninguno (el domingo, con la semana ya pasada),
 * al FONDO, que es lo más cerca de hoy. Sin ninguna cabecera todavía, no mueve
 * nada y queda pendiente.
 *
 * H5 (AG-DT-69) · antes, «sin día de hoy o posterior» tampoco movía nada: el
 * domingo la lista abría en el lunes, que es justo lo que F1.12 quitó.
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

/** A dónde llegó: a la cabecera de hoy (o posterior), al fondo, o a ningún sitio (`false`). */
export type DestinoLista = 'hoy' | 'fondo' | false

/**
 * Desplaza la lista de Semana a hoy, o al fondo si no hay día de hoy en adelante
 * y `alFondo` lo permite. Sin permiso (falta una fuente por llegar, p. ej. Google,
 * que puede traer la cabecera de hoy), NO toca nada y devuelve `false`: así el
 * fondo se escribe una sola vez, cuando ya es definitivo, y nunca tironea de
 * quien se haya desplazado mientras tanto.
 */
export function desplazarListaAHoy(raiz: RaizLista, hoyISO: string, alFondo = true): DestinoLista {
  const desplazador = raiz.querySelector('.fc-listWeek-view .fc-scroller')
  if (!desplazador) return false
  const cabeceras = Array.from(raiz.querySelectorAll('.fc-listWeek-view tr.fc-list-day[data-date]'))
  if (!cabeceras.length) return false
  const destino = cabeceras.find(c => (c.getAttribute('data-date') ?? '') >= hoyISO)
  if (!destino) {
    if (!alFondo) return false
    desplazador.scrollTop = desplazador.scrollHeight
    return 'fondo'
  }
  desplazador.scrollTop += destino.getBoundingClientRect().top - desplazador.getBoundingClientRect().top
  return 'hoy'
}

/** Cuadros como máximo que se repite el desplazamiento (≈ 160 ms). */
const MAX_CUADROS = 10

/**
 * Desplaza a hoy y lo REPITE cuadro a cuadro mientras la lista cambie de alto
 * (como mucho `MAX_CUADROS`). Al acabar llama a `alTerminar` con a dónde llegó;
 * si no hay a dónde (aún sin filas), con `false`: sigue pendiente. Al fondo
 * (ningún día de hoy en adelante) también repite: el fondo crece igual. Quien
 * llama dice con `alFondo` si el fondo ya vale (todas las fuentes llegaron).
 *
 * Por qué (medido el 2026-11-14 en el teléfono): en el primer cuadro las
 * cabeceras de día miden 17 px y en el siguiente 38, y el navegador recorta el
 * `scrollTop` al alto de ESE momento. Con hoy cerca del final de la lista
 * (viernes por la tarde, sábado, domingo) se quedaba a medio camino.
 */
export function desplazarListaAHoyEstable(
  raiz: RaizLista, hoyISO: string, alTerminar: (llego: DestinoLista) => void,
  siguienteCuadro: (f: () => void) => void = f => { requestAnimationFrame(f) },
  alFondo = true,
): void {
  let cuadros = 0
  let altoAntes = -1
  const paso = (): void => {
    const destino = desplazarListaAHoy(raiz, hoyISO, alFondo)
    if (!destino) { alTerminar(false); return }
    const alto = raiz.querySelector('.fc-listWeek-view .fc-scroller')?.scrollHeight ?? -1
    cuadros += 1
    if (alto === altoAntes || cuadros >= MAX_CUADROS) { alTerminar(destino); return }
    altoAntes = alto
    siguienteCuadro(paso)
  }
  paso()
}
