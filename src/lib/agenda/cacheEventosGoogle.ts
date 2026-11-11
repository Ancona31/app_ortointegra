/**
 * src/lib/agenda/cacheEventosGoogle.ts
 *
 * Saca a Google del camino crítico de la agenda (A1.3). La fuente `gcal` de
 * FullCalendar contesta AL INSTANTE con lo que haya aquí, trae en segundo plano
 * y, cuando llega, la agenda vuelve a pedirle a esa fuente sola, que esta vez
 * se sirve de aquí.
 *
 * ── POR QUÉ HACE FALTA, Y NO BASTABA CON QUE FUERAN DOS FUENTES ──────────────
 * FullCalendar NO pinta los eventos de ninguna fuente mientras quede UNA
 * trayendo: con `progressiveEventRendering` en su valor por omisión (false),
 * sirve el `renderableEventStore` anterior mientras `isEventsLoading` sea
 * verdadero (`@fullcalendar/core/index.js:1396-1399`, versión 6.1.20), y ese
 * `isEventsLoading` es el agregado de todas las fuentes (`:549-556`). Medido
 * contra `next start` con `/api/google/events` retrasado 8 s: `/api/appointments`
 * contestaba a los 220 ms y la rejilla seguía con CERO `.fc-event` hasta los
 * 8,2 s. No era la cola de conexiones del navegador: las dos peticiones salían
 * a la vez y la de citas volvía enseguida.
 *
 * ── QUÉ SE GUARDA ───────────────────────────────────────────────────────────
 * La respuesta de la ruta por clave (usuario, filtro, rango), cinco minutos.
 * `error_google` y la caída de red NO se sirven como vigentes: se entregan UNA
 * vez —la del `refetch` que avisa de que llegaron— y la siguiente traída
 * vuelve a preguntar, que es lo que hacía la agenda antes de esto.
 *
 * ⚠️ SE VACÍA AL CERRAR SESIÓN (`Sidebar.tsx`, junto a `clearProfileCache`).
 * La clave lleva el usuario, pero es memoria de la pestaña: sin el vaciado,
 * quien entrara después en la misma pestaña heredaría el calendario de la
 * clínica anterior durante cinco minutos.
 */
import type { EventInput } from '@fullcalendar/core'
import { logger } from '@/lib/logger'

/* Lo que contesta `/api/google/events` en su campo `estado` (bloque 9).
   ESPEJA `EstadoGoogle` de `src/lib/gcal.ts:62` y NO se importa de ahí a
   propósito: ese módulo carga `googleapis`, y aunque un `import type` se borre
   al compilar, dejaría escrita en un archivo de CLIENTE una ruta a un módulo de
   servidor — el día que alguien le quite la palabra `type` se arrastra la
   librería entera al navegador y nadie se entera hasta medir el bundle. Tres
   literales copiados cuestan menos que ese riesgo.
   Si el tipo de allá crece, esto no se rompe: quien lo consume compara contra
   `'error_google'` y cualquier valor nuevo cae del lado silencioso. */
export type EstadoGoogleAgenda = 'conectado' | 'sin_token' | 'error_google'

/** Espeja la lista blanca del servidor (`EventoAgenda` en /api/google/events).
 *  Las dos llaves de `start` y `end` son necesarias: un evento de día completo
 *  trae `date` y no `dateTime`. */
export interface EventoGoogle {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

export interface RespuestaGoogle { estado: EstadoGoogleAgenda; events: EventoGoogle[] }

/** Lo que llegó: una respuesta de la ruta, o una caída de red / cuerpo ilegible. */
export type ResultadoGoogle =
  | { tipo: 'respuesta'; datos: RespuestaGoogle }
  | { tipo: 'caida'; error: Error }

export const TTL_GOOGLE_MS = 5 * 60_000

interface Entrada { en: number; resultado: ResultadoGoogle; porEntregar: boolean }

const entradas = new Map<string, Entrada>()
const enVuelo = new Set<string>()
/* Sube en cada vaciado: una traída que salió ANTES de cerrar sesión no puede
   escribir al volver, porque su clave es la del usuario que ya se fue. */
let generacion = 0

export function claveGoogle(usuario: string, filtro: string, desde: string, hasta: string): string {
  return [usuario, filtro, desde, hasta].join('|')
}

function vigente(e: Entrada, ahora: number): boolean {
  return e.resultado.tipo === 'respuesta' &&
    e.resultado.datos.estado !== 'error_google' &&
    ahora - e.en < TTL_GOOGLE_MS
}

/** Lo que se puede servir sin red: la entrega pendiente (una sola vez) o una
 *  entrada vigente. `null` = hay que preguntar. */
export function leerGoogle(clave: string, ahora: number = Date.now()): ResultadoGoogle | null {
  const e = entradas.get(clave)
  if (!e) return null
  /* ⚠️ LA ENTREGA PENDIENTE TAMBIÉN CADUCA. Si al llegar la traída el usuario
     ya estaba en otra semana o en otro filtro, el `refetch` del aviso salió con
     OTRA clave y ésta se quedó por entregar; sin el límite de edad, volver aquí
     horas después la servía sin red —y si era un fallo, resucitaba la banda—. */
  if (e.porEntregar) {
    e.porEntregar = false
    return ahora - e.en < TTL_GOOGLE_MS ? e.resultado : null
  }
  return vigente(e, ahora) ? e.resultado : null
}

/** Los eventos que se pintan MIENTRAS se pregunta: los últimos conocidos para
 *  esa clave aunque hayan caducado, o ninguno. */
export function eventosProvisionales(clave: string): EventoGoogle[] {
  const r = entradas.get(clave)?.resultado
  return r?.tipo === 'respuesta' && r.datos.estado === 'conectado' ? r.datos.events : []
}

/** Lo mínimo para que el mapa no crezca sin fin en una pestaña abierta todo
 *  el día: al escribir, fuera lo vencido que ni vuela ni espera entrega. Sin
 *  LRU. Lo vencido deja de servir de provisional, que es un adorno. */
function purgarVencidas(ahora: number): void {
  for (const [clave, e] of entradas) {
    if (!e.porEntregar && !enVuelo.has(clave) && ahora - e.en >= TTL_GOOGLE_MS) entradas.delete(clave)
  }
}

/** Trae en segundo plano y avisa con `alLlegar` cuando la respuesta ya está
 *  aquí. Una sola traída por clave a la vez; una petición repetida mientras
 *  vuela no sale y la cubre el aviso de la que ya vuela. */
export function traerGoogle(clave: string, pedir: () => Promise<RespuestaGoogle>, alLlegar: () => void): void {
  if (enVuelo.has(clave)) return
  enVuelo.add(clave)
  const gen = generacion
  pedir()
    .then(
      (datos): ResultadoGoogle => ({ tipo: 'respuesta', datos }),
      (err: unknown): ResultadoGoogle => ({ tipo: 'caida', error: err instanceof Error ? err : new Error('Error cargando eventos') }),
    )
    .then(resultado => {
      if (gen !== generacion) return
      enVuelo.delete(clave)
      const ahora = Date.now()
      purgarVencidas(ahora)
      entradas.set(clave, { en: ahora, resultado, porEntregar: true })
      alLlegar()
    })
    .catch((err: unknown) => {
      logger.warn('agenda', `aviso de Google fallido: ${err instanceof Error ? err.message : 'desconocido'}`)
    })
}

/** Al cerrar sesión. Ver la cabecera. */
export function vaciarCacheGoogle(): void {
  generacion += 1
  entradas.clear()
  enVuelo.clear()
}

/** Pregunta a la ruta. Un `res.ok` falso NO es caída: se anota como fallo de
 *  Google, igual que antes (la ruta contesta 200 en todos sus fallos de Google;
 *  aquí sólo caen el 401 y el 400 del `medico_id` mal formado). Lanza sólo por
 *  red o por un cuerpo ilegible. */
export async function pedirEventosGoogle(desde: string, hasta: string, filtro: string): Promise<RespuestaGoogle> {
  let url = `/api/google/events?from=${desde}&to=${hasta}`
  // Cadena vacía = «todos los médicos»: no se manda nada.
  if (filtro) url += `&medico_id=${filtro}`
  const res = await fetch(url)
  if (!res.ok) return { estado: 'error_google', events: [] }
  const data: { estado?: EstadoGoogleAgenda; events?: EventoGoogle[] } = await res.json()
  return { estado: data.estado ?? 'error_google', events: data.events ?? [] }
}

/** De la lista blanca del servidor a lo que pinta FullCalendar. */
export function aEventosDeCalendario(eventos: EventoGoogle[]): EventInput[] {
  return eventos.map((e) => ({
    id:              `gcal-${e.id}`,
    // Sin 🔒: esto viene del calendario de Spinus, tiene título real y no es
    // privado.
    title:           e.summary || 'Evento sin título',
    start:           e.start?.dateTime ?? e.start?.date ?? '',
    end:             e.end?.dateTime ?? e.end?.date ?? undefined,
    allDay:          !e.start?.dateTime,
    // Harness transparente: la GoogleEventCard pinta su propio fondo/borde.
    // Sin `textColor`: `GoogleEventCard` fija `color: var(--ag-gcal-text)` en
    // su <div> raíz, y de ahí lo heredan la hora, el título y el borde de la
    // etiqueta. Un hex aquí se quedaba clavado en tema oscuro.
    backgroundColor: 'transparent',
    borderColor:     'transparent',
    editable:        false,
    extendedProps:   { isGcalBlock: true },
  }))
}
