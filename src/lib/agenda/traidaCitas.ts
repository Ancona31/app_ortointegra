/**
 * src/lib/agenda/traidaCitas.ts
 *
 * Pedir un rango de citas a la red, cachearlo y deduplicar peticiones
 * concurrentes a la misma clave; y enganchar la semilla del servidor
 * (A1.4c) a esa misma caché. Movido tal cual desde `AgendaCliente.tsx`
 * (A2.5.1, movimiento puro), con sus comentarios; sólo cambiaron los
 * `import`/`export` que hacían falta.
 */

import type { EventInput } from '@fullcalendar/core'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { claveCitas, generacionCitas, guardarCitas } from '@/lib/agenda/cacheRangosCitas'
import { sembrarCacheCitas, type SemillaCitas } from '@/lib/agenda/semillaCitas'
import { citaAEvento } from '@/lib/agenda/eventosDeCita'
import { logger } from '@/lib/logger'

/** Lo que `traerYGuardarCitas` entrega tras pedir y cachear un rango. */
export interface TraidaCitas { eventos: EventInput[]; incompleta: boolean }

/**
 * Pide UN rango a `/api/appointments` y lo guarda en `cacheRangosCitas`
 * (A1.5a). La usan `appointmentSource` (la traída real) y la precarga de
 * semanas vecinas (A1.5b, `ejecutarPrecarga`): MISMA petición, MISMA
 * traducción (`citaAEvento`) y MISMO `guardarCitas` — sacarla de la fuente es
 * lo que evita tener dos copias que se desincronicen.
 *
 * `profileId` puede ser `null` (sin perfil no hay de quién es la caché, como
 * en `appointmentSource`): se pide igual, sólo que no se guarda nada.
 *
 * NO toca estado de React ni refs del componente — eso le toca a cada
 * llamador según lo que le corresponda (`errorCitas`, `ultimaTraidaRef`…).
 *
 * ⚠️⚠️ LAS DOS GUARDAS DE ABAJO (`res.ok` y el `Array.isArray`) NO SON
 * DEFENSIVAS, son el Bloque 9 entero: sin ellas un fallo del servidor se
 * pinta como una agenda VACÍA en vez de como un error — ver la nota larga que
 * llevaban en `appointmentSource` antes de este reparto. Las dos LANZAN, así
 * que sólo hay un camino de fallo: el `catch` de quien llame a esto.
 */
export async function traerYGuardarCitas(
  startStr: string, endStr: string, filtro: string, profileId: string | null,
): Promise<TraidaCitas> {
  const salio = Date.now()
  const gen = generacionCitas()
  let url = `/api/appointments?from=${startStr}&to=${endStr}`
  if (filtro) url += `&medico_id=${filtro}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  const data: { appointments?: Appointment[]; incompleta?: boolean } = await res.json()
  if (!Array.isArray(data.appointments)) throw new Error('Respuesta de citas ilegible')
  const eventos = data.appointments.map(citaAEvento)
  const incompleta = data.incompleta === true
  if (profileId) guardarCitas(claveCitas(profileId, filtro, startStr, endStr), eventos, incompleta, salio, gen)
  return { eventos, incompleta }
}

/**
 * Lo que vive en el mapa de citas en vuelo: la promesa Y LA GENERACIÓN con la
 * que salió. Sin la generación, reutilizar la promesa es el bug grave de la
 * revisión: `vaciarCacheCitas()` NO toca este mapa (es independiente de
 * `cacheRangosCitas`), así que una petición que salió ANTES de un vaciado
 * podía devolverse a quien pide DESPUÉS — datos de antes de la cita que
 * acaba de llegar por tiempo real, servidos como si fueran los de ahora.
 */
export interface TraidaEnVuelo { gen: number; promesa: Promise<TraidaCitas> }

/**
 * Evita que la traída real y la precarga pidan la MISMA clave a la vez: la
 * segunda que llegue reutiliza la promesa de la primera — PERO SÓLO SI salió
 * en la generación VIGENTE. Si hubo un vaciado de por medio, esa promesa es
 * de antes: se ignora (su propio `.finally` la retira sola cuando resuelva) y
 * se pide una nueva. `enVuelo` es `citasEnVueloRef.current`, compartido por
 * las dos — un `Map` de módulo sería memoria entre pestañas sin sentido, y
 * uno por componente ya es lo que hace falta para una sola agenda abierta.
 */
export function traerCitasDeduplicado(
  startStr: string, endStr: string, filtro: string, profileId: string | null,
  enVuelo: Map<string, TraidaEnVuelo>,
): Promise<TraidaCitas> {
  if (!profileId) return traerYGuardarCitas(startStr, endStr, filtro, profileId)
  const clave = claveCitas(profileId, filtro, startStr, endStr)
  const gen = generacionCitas()
  const existente = enVuelo.get(clave)
  if (existente && existente.gen === gen) return existente.promesa
  const promesa = traerYGuardarCitas(startStr, endStr, filtro, profileId).finally(() => {
    if (enVuelo.get(clave)?.promesa === promesa) enVuelo.delete(clave)
  })
  enVuelo.set(clave, { gen, promesa })
  return promesa
}

/**
 * Engancha la semilla del servidor a `cacheRangosCitas` (A1.4c). La generación
 * y la hora se toman AQUÍ, al recibir la promesa: un vaciado (escritura propia,
 * tiempo real) mientras viaja la descarta. Resuelve con la marca de la semilla
 * si entró (ver `sembrarCacheCitas`) o `null`. Nunca rechaza: si la semilla
 * falla, la fuente de citas va a la red como siempre, sin aviso.
 */
export function engancharSemilla(semilla: Promise<SemillaCitas<Appointment> | null> | undefined): Promise<number | null> | null {
  if (!semilla) return null
  const gen = generacionCitas()
  const recibida = Date.now()
  return Promise.resolve(semilla).then(
    (s) => (s ? sembrarCacheCitas(s, citaAEvento, gen, recibida) : null),
    (err: unknown) => {
      logger.warn('agenda', `semilla de citas perdida: ${err instanceof Error ? err.message : 'error'}`)
      return null
    },
  )
}
