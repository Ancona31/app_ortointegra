/**
 * src/lib/agenda/marcasMovimiento.ts
 *
 * Qué tarjeta entra animada y cuál sale animada (bloque F, F2.4/F2.5), sin una
 * segunda fuente de verdad: la única verdad sigue siendo el almacén de eventos
 * de FullCalendar. Este módulo sólo guarda MARCAS de vida corta y responde qué
 * clases añadir; quien las pinta es `clasesDelEvento` (`eventClassNames`, de
 * identidad estable). Archivo nuevo de F3; se enchufa después de integrar E.
 *
 * ── ENTRADA: `.ag-ev-nuevo` (y `.ag-ev-remoto`) ──────────────────────────
 * ⚠️ POR REGISTRO EXPLÍCITO, NO POR DIFERENCIA DE IDS EN `eventsSet`. El ejemplo
 * de CONTRASTE §2.2 no sirve tal cual: `eventsSet` llega DESPUÉS de pintar
 * (`componentDidUpdate`), así que la clase llegaría un render tarde; y al
 * navegar FullCalendar sustituye los eventos de la fuente, así que una
 * diferencia pura daría por «nuevas» todas las tarjetas de una semana no vista.
 * Se registra ANTES de `addEvent` en los dos únicos sitios donde algo nace: el
 * alta optimista de `handleSave` y la rama de alta de `aplicarCambioRealtime`
 * (con `remoto: true`). La diferencia de `eventsSet` sólo PODA (`podarMarcas`).
 *
 * La marca caduca en `VIDA_MARCA_MS` (base + lento + margen): volver a montar la
 * tarjeta tras un cambio de vista, pasado ese plazo, no repite la entrada.
 *
 * ── SALIDA: `.ag-ev-saliendo` ────────────────────────────────────────────
 * `salirConAnimacion` marca el evento (`extendedProps.saliendo`), lo deja sin
 * edición, espera `--ag-dur-micro` (0 con movimiento reducido) y lo quita sólo
 * si SIGUE marcado: si entretanto una traída lo sustituyó por otro objeto con el
 * mismo id, ése no lleva la marca y no se toca.
 * Durante esos 120 ms la cita sigue en `getEvents()`: el conteo, el panel y el
 * empalme la cuentan hasta que se quita. Aceptado y dicho (diseño F §2).
 * ⚠️ LA CANCELACIÓN NO ES UNA SALIDA: la tarjeta se queda y cambia de color de
 * golpe (spec §8). Esto es sólo para bajas de verdad.
 *
 * Mismo patrón de estado de módulo que `cacheRangosCitas.ts`.
 */
import { duracionMovimiento } from '@/lib/agenda/movimientoAgenda'

/** base (180) + lento (240) + margen: la entrada y el anillo caben dentro. */
export const VIDA_MARCA_MS = 600

interface Marca { expira: number; remoto: boolean }

const marcas = new Map<string, Marca>()

/** Antes de `addEvent`. `remoto`: llegó por tiempo real (lleva además el anillo). */
export function registrarNuevo(id: string, opciones: { remoto?: boolean; ahora?: number } = {}): void {
  const ahora = opciones.ahora ?? Date.now()
  marcas.set(id, { expira: ahora + VIDA_MARCA_MS, remoto: opciones.remoto === true })
}

/** Lo que `clasesDelEvento` lee de `extendedProps` para la salida. */
export interface PropsMovimiento { saliendo?: unknown }

/** Las clases de movimiento de un evento en este instante. Vacío en el caso normal. */
export function clasesDeMovimiento(id: string, props: PropsMovimiento, ahora: number = Date.now()): string[] {
  const clases: string[] = []
  const m = marcas.get(id)
  if (m && m.expira > ahora) {
    clases.push('ag-ev-nuevo')
    if (m.remoto) clases.push('ag-ev-remoto')
  }
  if (props.saliendo === true) clases.push('ag-ev-saliendo')
  return clases
}

/**
 * Desde `eventsSet` (`alCambiarEventos`). Quita las marcas caducadas y las de
 * ids que ya no están, y hace de CANDADO: una marca que apunta a un id que YA
 * estaba en el conjunto anterior es de una tarjeta vieja (una carrera con una
 * traída de reconexión, por ejemplo) y se descarta para que no anime.
 */
export function podarMarcas(idsActuales: ReadonlySet<string>, idsPrevios: ReadonlySet<string>, ahora: number = Date.now()): void {
  for (const [id, m] of marcas) {
    if (m.expira <= ahora || !idsActuales.has(id) || idsPrevios.has(id)) marcas.delete(id)
  }
}

/** Sólo para pruebas y para el cierre de sesión. */
export function vaciarMarcas(): void { marcas.clear() }

/** Lo mínimo de `EventApi` que hace falta (FullCalendar lo cumple). */
export interface EventoSalida {
  extendedProps: Record<string, unknown>
  setExtendedProp(nombre: string, valor: unknown): void
  setProp(nombre: string, valor: unknown): void
  remove(): void
}

/**
 * Lo mínimo del calendario que hace falta. Lo cumple `Calendar` de
 * `@fullcalendar/core`, NO el tipo `CalendarApi` que devuelve `getApi()`: ése
 * no declara `batchRendering`. El llamador estrecha con `instanceof Calendar`,
 * igual que `useTiempoRealAgenda` y `guardadoCitas` (sin `as`).
 */
export interface ApiSalida {
  batchRendering(fn: () => void): void
  getEventById(id: string): EventoSalida | null
}

/**
 * Baja con salida. Devuelve la espera en ms (0 con movimiento reducido): el
 * llamador no necesita nada más. Sin evento con ese id, no hace nada.
 */
export function salirConAnimacion(api: ApiSalida, id: string): number {
  const ev = api.getEventById(id)
  if (!ev) return 0
  api.batchRendering(() => {
    ev.setExtendedProp('saliendo', true)
    ev.setProp('editable', false)
  })
  const espera = duracionMovimiento('--ag-dur-micro')
  const quitar = (): void => {
    const actual = api.getEventById(id)
    if (actual?.extendedProps.saliendo === true) actual.remove()
  }
  if (espera === 0) quitar()
  else setTimeout(quitar, espera)
  return espera
}
