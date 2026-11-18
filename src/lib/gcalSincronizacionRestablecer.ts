/**
 * src/lib/gcalSincronizacionRestablecer.ts
 *
 * La otra mitad de C-d y C-e (mejora_agendaV2.md §6-bis), paso C5: lo que la
 * sincronización de vuelta RECHAZÓ se vuelve a escribir en Google con el estado
 * que tiene Spinus. `sincronizarClinica` (gcalSincronizacion.ts) lo llama por
 * página, con el mismo cliente de Calendar, después de aplicar la página y
 * antes de avanzar el token.
 *
 * ── QUÉ SE ESCRIBE ──────────────────────────────────────────────────────────
 * · El título que Spinus compone (`resumenEsperado`: con paciente,
 *   «Cita médica…»; cancelada, con «CANCELADA — »).
 * · Las dos puntas de la fila.
 * · `status: 'confirmed'`: deshace un borrado hecho en Google. La API lo
 *   documenta: en el calendario del organizador un evento cancelado conserva
 *   sus datos «so that they can be restored (undeleted)»
 *   (developers.google.com/workspace/calendar/api/v3/reference/events, campo
 *   `status`). Sobre un evento vivo no cambia nada.
 * · El color del estado y la marca privada.
 * · NO la descripción: la de una cita con paciente editada en Google ni se
 *   importa ni se restablece (decisión de C0-C4); nunca observaciones (S1).
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 * La fila se RELEE (gcal_citas_por_evento, por id) después de aplicar: así se
 * escribe lo vigente y se tiene el `updated_at` para guardar el `etag` nuevo
 * con comparar-y-cambiar (gcal_aplicar_evento sin cambios: sólo columnas
 * técnicas). El `patch` va con `If-Match` = el `etag` que trajo la página: si
 * alguien volvió a tocar el evento, 412 y se deja; la pasada siguiente lo ve y
 * decide otra vez. `sendUpdates: 'none'`: es devolver el evento a como estaba.
 *
 * ── SI GOOGLE NO RESPONDE (tanda J, punto 9) ───────────────────────────────
 * Un fallo PASAJERO de Google al escribir (la red: conexión cortada, sin
 * respuesta, corte por tiempo; 429; 5xx; 403 por cuota) se cuenta en
 * `pendientes`, y la pasada NO avanza el token (`RestablecimientoPendiente`):
 * la siguiente vuelve a leer la misma página y restablece otra vez. Antes la
 * página avanzaba igual y Google se quedaba con lo que alguien le puso hasta
 * que alguien volviera a tocar el evento.
 * TODO LO DEMÁS NO SE REPITE —otro 4xx, un fallo de la base al releer o al
 * guardar el etag, una excepción nuestra—: repetir la página no lo arregla y
 * dejaría a TODA la clínica sin sincronizar (una vez por hora, para siempre);
 * se cuenta en `errores` y la página avanza, como antes.
 *
 * Ninguna consulta directa a una tabla: todo por las RPC de `gcalSincronizacionBase.ts`
 * (cerrojoGcalSincronizacion.test.ts).
 */
import type { GCalCliente } from '@/lib/gcal'
import { propiedadesSpinus, puntasParaGoogle } from '@/lib/appointments'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { logger } from '@/lib/logger'
import { esPrecondicionFallida } from '@/lib/gcalEscritura'
import { resumenEsperado, type EventoGoogle, type FilaEspejo } from '@/lib/gcalSincronizacionDecidir'
import { aplicarEvento, citasDeEventos } from '@/lib/gcalSincronizacionBase'

/**
 * Tanda J, punto 9: algún restablecimiento falló por algo pasajero. La pasada
 * lo lanza DESPUÉS de terminar la página y ANTES de avanzar el token, para que
 * la siguiente repita la página (con la espera creciente de C1).
 */
export class RestablecimientoPendiente extends Error {
  constructor() {
    super('restablecimiento en Google pendiente: se repite la página')
    this.name = 'RestablecimientoPendiente'
  }
}

/** El estado HTTP de un error de googleapis (gaxios), si lo trae. Copia de `statusDe` (gcalSincronizacion.ts). */
function estadoHttp(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  if ('code' in err && typeof err.code === 'number') return err.code
  if ('status' in err && typeof err.status === 'number') return err.status
  if ('response' in err && typeof err.response === 'object' && err.response !== null
      && 'status' in err.response && typeof err.response.status === 'number') return err.response.status
  return null
}

/** Los códigos de Node/undici de una conexión que no llegó o se cortó. */
const CODIGOS_DE_RED = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'ABORT_ERR',
])

/** ¿La red, y no un error con forma? Sin estado HTTP y con código o nombre de conexión/corte. */
function esDeRed(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ('name' in err && (err.name === 'AbortError' || err.name === 'TimeoutError')) return true
  return 'code' in err && typeof err.code === 'string' && CODIGOS_DE_RED.has(err.code)
}

/** 403 de cuota de Google (`rateLimitExceeded`, `userRateLimitExceeded`): es un «espera», no un «no». */
function esCuota(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('errors' in err) || !Array.isArray(err.errors)) return false
  return err.errors.some((e: unknown) => typeof e === 'object' && e !== null && 'reason' in e
    && (e.reason === 'rateLimitExceeded' || e.reason === 'userRateLimitExceeded'))
}

/** La red, 429, 5xx o 403 de cuota: repetirlo puede salir. Lo demás, no (ver la cabecera). */
export function esFalloPasajero(err: unknown): boolean {
  const s = estadoHttp(err)
  if (s === null) return esDeRed(err)
  return s === 429 || s >= 500 || (s === 403 && esCuota(err))
}

/** Lo que la página trajo de un evento rechazado. */
export interface PorRestablecer {
  citaId: string
  eventId: string
  /** El `etag` del evento tal como llegó en la página (para `If-Match`). */
  etag: string | null
}

/** El color de Google por estado. Copia del `STATUS_COLOR` del PUT de citas (`scheduled` no lleva). */
const COLOR_ESTADO: Partial<Record<FilaEspejo['status'], string>> = {
  confirmed: '2', cancelled: '11', no_show: '11', attended: '8',
}

/** El cuerpo del `patch`: el estado de Spinus, sin descripción. */
export function cuerpoRestablecido(fila: FilaEspejo): EventoGoogle {
  const zona = fila.zona ?? TZ_CLINICA
  const puntas = fila.todoElDia
    ? puntasParaGoogle({ todoElDia: true, inicio: renderEnTZ(fila.inicio, 'yyyy-MM-dd', zona), fin: renderEnTZ(fila.fin, 'yyyy-MM-dd', zona), timezone: zona }, { limpiarLaOtraForma: true })
    : puntasParaGoogle({ todoElDia: false, inicio: fila.inicio, fin: fila.fin, timezone: zona }, { limpiarLaOtraForma: true })
  const resumen = resumenEsperado(fila)
  const color = COLOR_ESTADO[fila.status]
  return {
    ...(resumen ? { summary: resumen } : {}),
    ...puntas,
    status: 'confirmed',
    ...(color ? { colorId: color } : {}),
    extendedProperties: propiedadesSpinus(fila.id),
  }
}

/** Uno. `true` = escrito; `false` = no tocaba (412 o sin fila). Lanza el resto. */
async function restablecerUno(
  clinicaId: string, calendar: GCalCliente, calendarId: string, p: PorRestablecer, fila: FilaEspejo, senal?: AbortSignal,
): Promise<boolean> {
  const eventId = fila.googleEventId ?? p.eventId
  if (fila.googleEventId && fila.googleEventId !== p.eventId) return false
  let etag: string | null
  try {
    const { data } = await calendar.events.patch(
      { calendarId, eventId, sendUpdates: 'none', requestBody: cuerpoRestablecido(fila) },
      { ...(p.etag ? { headers: { 'If-Match': p.etag } } : {}), ...(senal ? { signal: senal } : {}) },
    )
    etag = data.etag ?? null
  } catch (err) {
    if (esPrecondicionFallida(err)) return false
    throw err
  }
  if (etag) {
    await aplicarEvento(clinicaId, calendarId, {
      citaId: fila.id, esperadoUpdatedAt: fila.updatedAt, etag, actualizado: null,
      vincular: fila.googleEventId ? null : eventId, desvincular: false, cambios: {},
    })
  }
  return true
}

/**
 * Restablece en Google las citas de la lista (sin repetidas). Devuelve cuántas
 * se escribieron, cuántas fallaron y cuántas de ésas por algo pasajero
 * (`pendientes`, ver la cabecera); un fallo no tumba a las demás. Nunca lanza.
 */
export async function restablecerEnGoogle(
  clinicaId: string, calendar: GCalCliente, calendarId: string, lista: readonly PorRestablecer[], senal?: AbortSignal,
): Promise<{ escritas: number; errores: number; pendientes: number }> {
  const unicas = [...new Map(lista.map((p) => [p.citaId, p])).values()]
  if (unicas.length === 0) return { escritas: 0, errores: 0, pendientes: 0 }
  let filas: FilaEspejo[]
  try {
    filas = await citasDeEventos(clinicaId, [], unicas.map((p) => p.citaId))
  } catch {
    logger.warn('GCalSync', `restablecer: no se pudieron releer las citas ${JSON.stringify({ clinica: clinicaId })}`)
    return { escritas: 0, errores: unicas.length, pendientes: 0 }
  }
  const porId = new Map(filas.map((f) => [f.id, f]))
  let escritas = 0
  let errores = 0
  let pendientes = 0
  for (const p of unicas) {
    const fila = porId.get(p.citaId)
    if (!fila) continue
    try {
      if (await restablecerUno(clinicaId, calendar, calendarId, p, fila, senal)) escritas += 1
    } catch (err) {
      errores += 1
      if (esFalloPasajero(err)) pendientes += 1
      logger.warn('GCalSync', `restablecer: evento sin escribir ${JSON.stringify({ clinica: clinicaId, evento: p.eventId })}`)
    }
  }
  return { escritas, errores, pendientes }
}
