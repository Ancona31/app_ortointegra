/**
 * sincronizarReserva.ts — la sincronización con Google ANTES de reservar por
 * enlace (decisión de Angel, mejora_agendaV2.md §6-bis «Bloque D —
 * sincronización con Google antes de reservar»). SÓLO SERVIDOR.
 *
 * Por qué: la ocupación de la reserva sale de la base (`reserva_ocupacion`),
 * que sólo conoce lo que hay en Google cuando alguien sincroniza (el sondeo
 * al abrir la agenda o la tarea programada). Sin esto, un evento recién
 * creado en Google no ocupa el turno hasta la siguiente pasada.
 *
 *   · `turnos` (GET): la pasada incremental de siempre (`sincronizarClinica`)
 *     con 60 s mínimos: los impone `gcal_sync_tomar` (si la última buena es
 *     más reciente, no toma el candado y no llama a Google).
 *   · `reservar` (POST): SIEMPRE, sin el mínimo (`minIntervaloSeg: 0`). Si
 *     otra pasada tiene el candado (el sondeo, la tarea u otra reserva de la
 *     misma clínica), se espera a que lo suelte y se hace la propia: nunca dos
 *     pasadas a la vez sobre el mismo `syncToken` (el candado con testigo de
 *     C1 lo garantiza; aquí sólo se reintenta).
 *   · Tope: `TIEMPO_GOOGLE_MS` para todo lo anterior. Al agotarse se aborta
 *     la señal que llevan `events.list` y el `patch` del restablecimiento (se
 *     cancelan de verdad) y, por si algo que no la lleva tarda (el refresco
 *     del token, la base), una carrera con el reloj deja de esperar.
 *   · Si la pasada no terminó `ok`: se reserva sólo si la última buena tiene
 *     menos de `VENTANA_TOLERADA_MS`; si no, «no se puede reservar por ahora».
 *
 * Sin conexión de Google, o sin las migraciones de C/D11: `seguir`, como hoy.
 * Clínica sin acceso (S3): `seguir`; la RPC la rechaza con el 404 uniforme.
 * Resto conocido: un reenvío del mismo `client_id` con Google caído y la
 * última buena ya vieja recibe el 503 en vez de `repetida` (la idempotencia
 * vive en la RPC, que no se llama); la cita y su comprobante ya existen.
 * El `clinicaId` sale de `reserva_contexto` (el hash del código), nunca de la
 * petición, y todo lo que toca la base filtra por él (`resolverConexionClinica`
 * con `.eq('clinica_id')`; las RPC con `p_clinica_id`).
 * Nunca lanza.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { sincronizarClinica, type ResultadoSincronizacion } from '@/lib/gcalSincronizacion'
import { frescuraSincronizacion, SincronizacionNoDisponible } from '@/lib/gcalSincronizacionBase'
import { logger } from '@/lib/logger'

/** Tope para todo lo de Google en una petición pública (ver §6-bis D11). */
export const TIEMPO_GOOGLE_MS = 4_000
/** GET de turnos: no se sincroniza si la última buena tiene menos de esto. */
export const MIN_INTERVALO_TURNOS_SEG = 60
/** Si Google falla, se reserva sólo con una sincronización buena más reciente que esto. */
export const VENTANA_TOLERADA_MS = 30 * 60_000
/** Entre dos intentos de tomar el candado cuando otra pasada lo tiene. */
const ESPERA_CANDADO_MS = 250
/** El candado dura más que el tope (como el sondeo: 30 s). */
const LEASE_SEG = 30

export type ModoReserva = 'turnos' | 'reservar'
export type Veredicto = 'seguir' | 'no_por_ahora'

interface Reloj { ahora: () => number; dormir: (ms: number) => Promise<void> }

const RELOJ: Reloj = { ahora: Date.now, dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)) }

/** `fn` con su señal, o `'tiempo'` si no termina en `ms` (y entonces la señal se aborta). */
async function conTope<T>(ms: number, fn: (senal: AbortSignal) => Promise<T>): Promise<T | 'tiempo'> {
  const control = new AbortController()
  let reloj: ReturnType<typeof setTimeout> | undefined
  const tope = new Promise<'tiempo'>((ok) => {
    // Razón propia (no TimeoutError): gaxios no reintenta una petición abortada así.
    reloj = setTimeout(() => { control.abort(new Error('tope de la reserva')); ok('tiempo') }, Math.max(0, ms))
  })
  try {
    return await Promise.race([fn(control.signal), tope])
  } finally {
    clearTimeout(reloj)
  }
}

/** Una pasada dentro del tope. `sin_conexion` = la clínica no tiene Google (o sin calendario): nada que sincronizar. */
async function pasadaDentroDelTope(
  clinicaId: string, modo: ModoReserva, restanteMs: number,
): Promise<ResultadoSincronizacion['estado'] | 'tiempo' | 'sin_conexion'> {
  return conTope(restanteMs, async (senal) => {
    const conexion = await resolverConexionClinica(createAdminClient(), clinicaId)
    if (!conexion || conexion.clinicaId !== clinicaId || !conexion.calendarId) return 'sin_conexion' as const
    const s = await sincronizarClinica(conexion, {
      actorId: 'reserva', presupuestoMs: restanteMs, leaseSeg: LEASE_SEG, senal,
      minIntervaloSeg: modo === 'turnos' ? MIN_INTERVALO_TURNOS_SEG : 0,
    })
    return s.estado
  })
}

/**
 * Intenta la pasada; en `reservar`, mientras otra pasada tenga el candado y
 * quede tiempo, espera y vuelve a intentar. Devuelve el último estado.
 */
async function intentar(clinicaId: string, modo: ModoReserva, reloj: Reloj): Promise<string> {
  const limite = reloj.ahora() + TIEMPO_GOOGLE_MS
  for (;;) {
    const estado = await pasadaDentroDelTope(clinicaId, modo, limite - reloj.ahora())
    if (estado !== 'omitida' || modo !== 'reservar') return estado
    const f = await frescuraSincronizacion(clinicaId)
    if (!f.ocupada || limite - reloj.ahora() <= ESPERA_CANDADO_MS) return estado
    await reloj.dormir(ESPERA_CANDADO_MS)
  }
}

/** Sin una pasada `ok`: ¿la última buena es lo bastante reciente? */
async function dentroDeLaVentana(clinicaId: string, reloj: Reloj): Promise<Veredicto> {
  const { ultimaOk } = await frescuraSincronizacion(clinicaId)
  const t = ultimaOk ? Date.parse(ultimaOk) : Number.NaN
  return Number.isFinite(t) && reloj.ahora() - t < VENTANA_TOLERADA_MS ? 'seguir' : 'no_por_ahora'
}

/** La sincronización previa de la reserva pública. Nunca lanza. */
export async function sincronizarAntesDeReservar(
  clinicaId: string, modo: ModoReserva, reloj: Reloj = RELOJ,
): Promise<Veredicto> {
  try {
    const estado = await intentar(clinicaId, modo, reloj)
    // `sin_acceso` (suspendida o sin acceso, S3): decide la puerta S3 de la
    // RPC, con el 404 uniforme de D5; un 503 aquí la distinguiría.
    if (estado === 'ok' || estado === 'sin_conexion' || estado === 'no_disponible' || estado === 'sin_acceso') return 'seguir'
    const v = await dentroDeLaVentana(clinicaId, reloj)
    if (v === 'no_por_ahora') logger.warn('reserva', `sin sincronización reciente con Google ${JSON.stringify({ clinica: clinicaId, modo, estado })}`)
    return v
  } catch (err) {
    // Sin la migración de D11 (frescura ausente): como hoy.
    if (err instanceof SincronizacionNoDisponible) return 'seguir'
    logger.error('reserva', `sincronización previa fallida ${JSON.stringify({ clinica: clinicaId, modo })}`)
    return dentroDeLaVentana(clinicaId, reloj).catch(() => 'no_por_ahora' as const)
  }
}
