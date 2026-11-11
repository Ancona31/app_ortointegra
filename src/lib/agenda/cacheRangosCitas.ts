/**
 * src/lib/agenda/cacheRangosCitas.ts
 *
 * Caché de rangos de CITAS (A1.5a, versión mínima). Volver a una semana ya
 * vista, o a la agenda desde otra pantalla, se pinta de aquí sin petición
 * cuando no hubo cambios. Vecino de `cacheEventosGoogle.ts`, con la misma
 * clave y el mismo vaciado al cerrar sesión, y deliberadamente más tosco:
 *
 *   · Clave EXACTA (usuario, filtro, rango ya normalizado por `rangoQuePedir`).
 *     Un rango contenido en otro NO se sirve del ancho: eso ya lo hace
 *     FullCalendar dentro de la vista, y fuera de ella no hace falta.
 *   · Vigencia de 2 min, la misma que `UMBRAL_REFETCH_FOCO_MS` de la agenda: lo
 *     que ese refresco da por fresco, esto también, y nada más.
 *   · INVALIDACIÓN TOTAL. Cualquier escritura propia y CUALQUIER evento del canal
 *     de tiempo real vacían el mapa entero. Sin parches finos: un parche fino es
 *     una segunda copia de `aplicarCambioRealtime` que se desincroniza.
 *   · Una respuesta `incompleta` no se guarda: el camino del recorte siempre
 *     vuelve a preguntar.
 *
 * ⚠️ VACIAR NO TRAE NADA. Sólo cambia lo que encontrará la PRÓXIMA traída que
 * FullCalendar decida hacer; así no hay forma de que invalidar choque con el
 * candado de gesto ni con el eco propio.
 *
 * ⚠️ SE VACÍA AL CERRAR SESIÓN (`Sidebar.tsx`, junto a `vaciarCacheGoogle`), por
 * lo mismo que la de Google: es memoria de la pestaña.
 */
import type { EventInput } from '@fullcalendar/core'

export const VIGENCIA_CITAS_MS = 120_000

/** `filas`: ya traducidas a lo que pinta FullCalendar, que no las muta. */
interface Entrada { filas: EventInput[]; en: number }

const entradas = new Map<string, Entrada>()
/* Sube en cada vaciado: una traída que salió ANTES de una escritura o de un
   evento de tiempo real trae datos de antes, y no puede guardarlos al volver. */
let generacion = 0

export function claveCitas(usuario: string, filtro: string, desde: string, hasta: string): string {
  return [usuario, filtro, desde, hasta].join('|')
}

/** Lo vigente para esa clave, o `null` = hay que preguntar. */
export function leerCitas(clave: string, ahora: number = Date.now()): EventInput[] | null {
  const e = entradas.get(clave)
  if (!e || ahora - e.en >= VIGENCIA_CITAS_MS) return null
  return e.filas
}

/** La marca que hay que devolver a `guardarCitas`: tómala al SALIR la petición. */
export function generacionCitas(): number {
  return generacion
}

/** `en` es cuándo salió la petición, no cuándo volvió: la vigencia cuenta
 *  desde lo más viejo que puede ser el dato. Fuera lo vencido al escribir, para
 *  que una pestaña abierta todo el día no crezca sin fin. */
export function guardarCitas(clave: string, filas: EventInput[], incompleta: boolean, en: number, gen: number): void {
  if (incompleta || gen !== generacion) return
  for (const [k, e] of entradas) if (en - e.en >= VIGENCIA_CITAS_MS) entradas.delete(k)
  entradas.set(clave, { filas, en })
}

/** Escritura propia, evento de tiempo real, traída forzada o cierre de sesión. */
export function vaciarCacheCitas(): void {
  generacion += 1
  entradas.clear()
}
