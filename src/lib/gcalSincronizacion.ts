/**
 * src/lib/gcalSincronizacion.ts
 *
 * Una pasada de la sincronización de vuelta (Google → Spinus, bloque C de
 * `mejora_agendaV2.md`) para UNA clínica: toma el candado, lee los cambios del
 * calendario Spinus con `events.list` + `syncToken` (o la sincronización
 * completa con `timeMin`), decide evento por evento con
 * `gcalSincronizacionDecidir.ts` y aplica por las RPC de
 * `gcalSincronizacionBase.ts`. La llamarán la ruta de sondeo al abrir la agenda
 * (C6) y la tarea programada (C7); hoy no la llama nadie.
 *
 * ── LO QUE NO HACE, A PROPÓSITO ─────────────────────────────────────────────
 * · Sólo escribe en Google para RESTABLECER: lo que se rechaza o no se acepta
 *   (C-d, C-e, gana Spinus) se vuelve a escribir con el estado de Spinus, por
 *   página y antes de avanzar el token (C5, `gcalSincronizacionRestablecer.ts`).
 *   También sale en `restablecer`.
 * · No crea calendarios ni desvincula citas: `puedeReparar: false` siempre.
 * · No consulta tablas directamente: todo va por RPC
 *   (cerrojoGcalSincronizacion.test.ts).
 * · No toca la vista de solo lectura (`/api/google/events`), que sigue
 *   pintando lo que no se importa (recurrentes, tipos especiales, fuera de
 *   ventana, clínicas sin acceso).
 *
 * ── REGLAS DE GOOGLE (verificadas en la guía de sincronización, §8) ─────────
 * · `syncToken` NUNCA va con `timeMin` (400). La completa manda el MISMO
 *   `timeMin` en cada página.
 * · `nextSyncToken` sólo llega en la última página.
 * · 410 = el token murió: completa otra vez, una sola vez por pasada.
 *
 * ── TOLERANCIA ──────────────────────────────────────────────────────────────
 * Interruptor apagado → `gcal_sync_tomar` no devuelve candado → `omitida`.
 * Migraciones ausentes → `SincronizacionNoDisponible` → `no_disponible`. En
 * ninguno de los dos casos se llama a Google ni se lanza.
 */
import { aplicarBloqueosDePagina, tieneMarcaBloqueo } from '@/lib/gcalSincronizacionBloqueos'
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, esCredencialInvalida, type GCalCliente } from '@/lib/gcal'
import type { ConexionGoogle } from '@/lib/gcalConexion'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  decidirEvento, marcaSpinus, type ContextoDecision, type Decision, type EventoGoogle, type FilaEspejo,
} from '@/lib/gcalSincronizacionDecidir'
import {
  aplicarEvento, quitarCanceladaDeGoogle, avanzarPagina, citasDeEventos, clinicaHabilitada, confirmarPorRsvp, importarEvento, procesarEmpalmesPendientes, registrarEmpalmesReserva,
  reiniciarToken, soltarCandado, SincronizacionNoDisponible, tomarCandado, CambioRechazadoPorLaBase, registrarMovimientoRechazado, type Candado,
  esFalloPasajeroDeLaBase,
} from '@/lib/gcalSincronizacionBase'
import { restablecerEnGoogle, RestablecimientoPendiente, type PorRestablecer } from '@/lib/gcalSincronizacionRestablecer'
import { aceptaronDe, rsvpGoogleEncendido } from '@/lib/gcalRsvp'
import { rechazarPorRsvps } from '@/lib/gcalRsvpRechazo'

/** C-b: la primera sincronización completa empieza hace 30 días, sin límite hacia adelante. */
export const DIAS_VENTANA_COMPLETA = 30
const LOTE = 5
const POR_PAGINA = 250
/** W · reintentos del registro de empalmes y la pausa entre ellos (dentro del presupuesto). */
const REINTENTOS_EMPALMES = 2
const PAUSA_EMPALMES_MS = 200

/**
 * Oleada 3, arreglo 3: algún cambio de Google no se aplicó por un fallo
 * PASAJERO de la base. Como `RestablecimientoPendiente`: se lanza al final de
 * la página y antes de avanzar el token, para que la pasada siguiente (la del
 * cron o la siguiente petición, con la espera creciente de C1) la repita.
 */
class AplicacionPendiente extends Error {
  constructor() {
    super('cambio de Google sin aplicar por un fallo pasajero de la base: se repite la página')
    this.name = 'AplicacionPendiente'
  }
}

export type EstadoSincronizacion = 'ok' | 'parcial' | 'omitida' | 'sin_acceso' | 'no_disponible' | 'error'

export interface ResultadoSincronizacion {
  estado: EstadoSincronizacion
  /** Filas de Spinus que cambiaron o se importaron. */
  cambios: number
  paginas: number
  /** Eventos que fallaron sin tumbar la página. */
  errores: number
  /** Citas cuyo estado de Spinus se volvió a escribir (o se intentó) en Google (C5). */
  restablecer: string[]
}

export interface OpcionesSincronizacion {
  /** Quién dispara, sólo para logs (ver `ContextoGCal.userId`). */
  actorId: string
  presupuestoMs: number
  leaseSeg: number
  minIntervaloSeg: number
  /** Reloj inyectable para las pruebas. */
  ahora?: () => number
  /**
   * D11 · corta de verdad las llamadas a Google (`events.list`, `patch` del
   * restablecimiento) cuando la ruta pública de reserva agota su tope. Sin
   * ella (sondeo, tarea programada), todo como antes.
   */
  senal?: AbortSignal
}

interface Pasada {
  conexion: ConexionGoogle
  candado: Candado
  op: OpcionesSincronizacion
  ahora: () => number
  limite: number
  r: ResultadoSincronizacion
  /** D11: citas importadas o movidas desde Google en la página en curso. Con la cola de M5 sólo se usa si la cola no existe. */
  movidas: string[]
  /** AG-DT-264: `true` = esta base no tiene la cola de M5 (`gcal_empalmes_pendientes`); se usa la lista en memoria, como antes. */
  sinCola: boolean
}

/** El estado HTTP de un error de googleapis (gaxios), si lo trae. */
function statusDe(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  if ('code' in err && typeof err.code === 'number') return err.code
  if ('status' in err && typeof err.status === 'number') return err.status
  if ('response' in err && typeof err.response === 'object' && err.response !== null
      && 'status' in err.response && typeof err.response.status === 'number') return err.response.status
  return null
}

/** Código corto y FIJO para `ultimo_error`: nunca texto que venga de Google. */
function codigoDeError(err: unknown): string {
  if (esCredencialInvalida(err)) return 'credencial'
  if (err instanceof RestablecimientoPendiente) return 'google_restablecer'
  if (err instanceof AplicacionPendiente) return 'base_pendiente'
  const s = statusDe(err)
  if (s === 410) return 'google_410'
  if (s !== null && s >= 500) return 'google_5xx'
  if (s !== null && s >= 400) return 'google_4xx'
  return 'desconocido'
}

/**
 * Una pasada para la clínica de `conexion`. Nunca lanza: todo fallo acaba en
 * el resultado y, si había candado, en `ultimo_error`.
 */
export async function sincronizarClinica(
  conexion: ConexionGoogle,
  op: OpcionesSincronizacion,
): Promise<ResultadoSincronizacion> {
  const r: ResultadoSincronizacion = { estado: 'omitida', cambios: 0, paginas: 0, errores: 0, restablecer: [] }
  const ahora = op.ahora ?? Date.now
  if (conexion.rol !== 'clinica' || conexion.estado !== 'activa' || !conexion.calendarId) return r
  let candado: Candado | null = null
  try {
    candado = await tomarCandado(conexion.clinicaId, {
      conexionId: conexion.id, calendarId: conexion.calendarId, leaseSeg: op.leaseSeg, minIntervaloSeg: op.minIntervaloSeg,
    })
    if (!candado) return r
    if (!(await clinicaHabilitada(conexion.clinicaId))) {
      await soltarCandado(conexion.clinicaId, candado.candado, 'sin_acceso')
      return { ...r, estado: 'sin_acceso' }
    }
    // Sonda de C2 ANTES de Google: con C1 aplicada y C2 no, se sale aquí
    // (no_disponible, candado suelto) sin haber llamado a events.list.
    await citasDeEventos(conexion.clinicaId, [], [])
    const pasada: Pasada = { conexion, candado, op, ahora, limite: ahora() + op.presupuestoMs, r, movidas: [], sinCola: false }
    const hecho = await conCalendarioSpinus(conexion, createAdminClient(),
      (calendar, calendarId) => recorrer(pasada, calendar, calendarId),
      { puedeReparar: false, actorId: op.actorId })
    if (hecho === null) {
      await soltarCandado(conexion.clinicaId, candado.candado, 'sin_calendario')
      return { ...r, estado: 'error' }
    }
    return r
  } catch (err) {
    if (err instanceof SincronizacionNoDisponible) {
      if (candado) await soltarCandado(conexion.clinicaId, candado.candado, null).catch(() => false)
      return { ...r, estado: 'no_disponible' }
    }
    // D11: un corte por el tope de la reserva pública cuenta como fallo de
    // Google (espera creciente incluida), con su propio código.
    const codigo = op.senal?.aborted ? 'google_tiempo' : codigoDeError(err)
    logger.error('GCalSync', `pasada fallida ${JSON.stringify({ clinica: conexion.clinicaId, codigo })}`)
    if (candado) await soltarCandado(conexion.clinicaId, candado.candado, codigo).catch(() => false)
    return { ...r, estado: 'error' }
  }
}

/** Dónde va la lectura: token (incremental) o ventana (completa), y la página. */
interface Cursor {
  token: string | null
  pagina: string | null
  ventana: string | null
  reintento410: boolean
  reintentoPagina: boolean
}

type DatosLista = { items?: EventoGoogle[]; nextPageToken?: string | null; nextSyncToken?: string | null; timeZone?: string | null }

/**
 * Pide UNA página. `'otra_vez'` = el cursor cambió por un 410 o una página
 * caducada y hay que repetir; `'perdido'` = el candado ya no es nuestro.
 */
async function pedirPagina(
  pasada: Pasada, calendar: GCalCliente, calendarId: string, c: Cursor,
): Promise<DatosLista | 'otra_vez' | 'perdido'> {
  try {
    const { data } = await calendar.events.list({
      calendarId, maxResults: POR_PAGINA, showDeleted: true, singleEvents: false,
      // ⚠️ syncToken y timeMin NUNCA juntos: Google responde 400.
      ...(c.token ? { syncToken: c.token } : { timeMin: c.ventana ?? undefined }),
      ...(c.pagina ? { pageToken: c.pagina } : {}),
    }, pasada.op.senal ? { signal: pasada.op.senal } : {})
    return data
  } catch (err) {
    const s = statusDe(err)
    if (s === 410 && !c.reintento410) {
      c.reintento410 = true
      if (!(await reiniciarToken(pasada.conexion.clinicaId, pasada.candado.candado))) return 'perdido'
      c.token = null
      c.pagina = null
      c.ventana = ventanaNueva(pasada.ahora())
      return 'otra_vez'
    }
    // Una página guardada que Google ya no reconoce: se vuelve a empezar desde
    // el token (o la ventana) guardado, una vez. Repetir páginas es idempotente.
    if (s === 400 && c.pagina && !c.reintentoPagina) {
      c.reintentoPagina = true
      c.pagina = null
      return 'otra_vez'
    }
    throw err
  }
}

/**
 * El bucle de páginas. Lo corre `conCalendarioSpinus`, que ya resolvió el
 * calendario sin repararlo. Deja el estado en `pasada.r`.
 */
async function recorrer(pasada: Pasada, calendar: GCalCliente, calendarId: string): Promise<true> {
  const { conexion, candado, op, r } = pasada
  if (calendarId !== conexion.calendarId) {
    await soltarCandado(conexion.clinicaId, candado.candado, 'calendario_cambio')
    r.estado = 'error'
    return true
  }
  // AG-DT-264: lo que una pasada anterior dejó apuntado y no llegó a registrar, antes de leer nada nuevo.
  await procesarColaAlEmpezar(pasada)
  const token = candado.fase === 'incremental' ? candado.syncToken : null
  const c: Cursor = {
    token, pagina: candado.pageToken, reintento410: false, reintentoPagina: false,
    ventana: token ? candado.ventanaDesde : candado.ventanaDesde ?? ventanaNueva(pasada.ahora()),
  }
  for (;;) {
    if (pasada.ahora() > pasada.limite || op.senal?.aborted) {
      // Presupuesto agotado: se suelta SIN error y la página queda guardada.
      await soltarCandado(conexion.clinicaId, candado.candado, null)
      r.estado = 'parcial'
      return true
    }
    const datos = await pedirPagina(pasada, calendar, calendarId, c)
    if (datos === 'perdido') return perdido(r)
    if (datos === 'otra_vez') continue
    r.paginas += 1
    await procesarPagina(pasada, calendar, datos.items ?? [], { calendarId, ventana: c.ventana, zona: datos.timeZone ?? null })
    const siguiente = datos.nextPageToken ? { pageToken: datos.nextPageToken }
      : datos.nextSyncToken ? { syncToken: datos.nextSyncToken } : null
    if (!siguiente) throw new Error('events.list sin nextPageToken ni nextSyncToken')
    if (!(await avanzarPagina(conexion.clinicaId, { candado: candado.candado, siguiente, ventanaDesde: c.ventana, leaseSeg: op.leaseSeg }))) {
      return perdido(r)
    }
    if ('syncToken' in siguiente) {
      r.estado = 'ok'
      return true
    }
    c.pagina = siguiente.pageToken
  }
}

function ventanaNueva(ahora: number): string {
  return new Date(ahora - DIAS_VENTANA_COMPLETA * 86_400_000).toISOString()
}

/** El candado caducó a media pasada: otra pasada lo tiene. No se escribe más. */
function perdido(r: ResultadoSincronizacion): true {
  r.estado = 'parcial'
  return true
}

/** Una página: una sola lectura del espejo, una decisión por evento, escrituras de cinco en cinco. */
async function procesarPagina(
  pasada: Pasada,
  calendar: GCalCliente,
  todos: EventoGoogle[],
  pagina: { calendarId: string; ventana: string | null; zona: string | null },
): Promise<void> {
  const { conexion } = pasada
  /* K1 · lo de los bloqueos de horario va aparte (`gcalSincronizacionBloqueos.ts`):
     nunca pasa por `decidirEvento`, que lo importaría como un evento nuevo. */
  const deBloqueo = todos.filter(tieneMarcaBloqueo)
  const items = todos.filter((e) => !tieneMarcaBloqueo(e))
  const ids = items.map((e) => e.id).filter((id): id is string => typeof id === 'string')
  const marcas = items.map(marcaSpinus).filter((m): m is string => m !== null)
  const filas = ids.length > 0 || marcas.length > 0 ? await citasDeEventos(conexion.clinicaId, ids, marcas) : []
  const porEvento = new Map(filas.filter((f) => f.googleEventId).map((f) => [f.googleEventId, f]))
  const porId = new Map(filas.map((f) => [f.id, f]))
  const ctx: ContextoDecision = {
    calendarId: pagina.calendarId, ventanaDesde: pagina.ventana, zonaCalendario: pagina.zona,
    medicoId: conexion.userId, ahora: pasada.ahora(),
  }
  const tareas = items.map((evento) => {
    const marca = marcaSpinus(evento)
    const fila: FilaEspejo | null = (evento.id ? porEvento.get(evento.id) : undefined) ?? (marca ? porId.get(marca) : undefined) ?? null
    return { evento, fila, decision: decidirEvento(evento, fila, ctx) }
  })
  /* Un borrado llega SIN marca: el que no es de ninguna cita puede ser de un bloqueo. */
  const borradosSinFila = tareas.filter((t) => t.evento.status === 'cancelled' && !t.fila).map((t) => t.evento)
  const bloqueos = await aplicarBloqueosDePagina(conexion.clinicaId, pagina.calendarId, deBloqueo, borradosSinFila)
  pasada.r.errores += bloqueos.errores
  const pendientes: PorRestablecer[] = []
  // AG-DT-264 (C): un bloqueo que la base no pudo aplicar por algo pasajero tampoco deja avanzar la página.
  let sinAplicarPasajeros = bloqueos.pasajeros
  for (let i = 0; i < tareas.length; i += LOTE) {
    const lote = tareas.slice(i, i + LOTE)
    const hechos = await Promise.allSettled(lote.map((t) => ejecutar(pasada, pagina.calendarId, t.decision)))
    hechos.forEach((h, j) => {
      const { evento, decision } = lote[j]
      if (h.status === 'rejected') {
        pasada.r.errores += 1
        if (esFalloPasajeroDeLaBase(h.reason)) sinAplicarPasajeros += 1
        logger.warn('GCalSync', `evento sin aplicar ${JSON.stringify({ clinica: conexion.clinicaId, evento: evento.id ?? null })}`)
      } else if (h.value && evento.id && (decision.tipo === 'rechazar' || decision.tipo === 'aplicar')) {
        pendientes.push({ citaId: decision.citaId, eventId: evento.id, etag: evento.etag ?? null })
      }
    })
  }
  // C5: lo rechazado vuelve a Google con el estado de Spinus, ANTES de avanzar
  // el token (si esto no llegara a correr, la página no avanza y se repite).
  const restablecido = await restablecerEnGoogle(conexion.clinicaId, calendar, pagina.calendarId, pendientes, pasada.op.senal)
  pasada.r.errores += restablecido.errores
  await avisarEmpalmes(pasada)
  if (rsvpGoogleEncendido()) {
    await confirmarPorRsvps(pasada, pagina.calendarId, tareas)
    // Avisos globales: el «No» del paciente (cancela con más de 1 h; en la última hora sólo avisa).
    const no = await rechazarPorRsvps(conexion.clinicaId, pagina.calendarId, tareas)
    pasada.r.cambios += no.cambios
    pasada.r.errores += no.errores
  }
  // Tanda J, punto 9: si Google no respondió al restablecer, la página NO
  // avanza (la siguiente pasada la repite y vuelve a restablecer). Al final, y
  // no antes: lo importado y lo movido ya registró sus empalmes, que repetir
  // la página no volvería a detectar.
  if (restablecido.pendientes > 0) throw new RestablecimientoPendiente()
  // Oleada 3, arreglo 3: lo mismo si la BASE falló por algo pasajero al
  // aplicar un cambio de Google (un definitivo cuenta en `errores` y la página
  // avanza, como antes). Repetirla es idempotente (ver `pedirPagina`).
  if (sinAplicarPasajeros > 0) throw new AplicacionPendiente()
}

/**
 * E9 · `accepted` del paciente → confirmada. DESPUÉS de las decisiones de C3,
 * que no cambian: sólo citas agendadas, con paciente o por ligar, ligadas a un
 * evento vivo. La base compara el correo y decide; un fallo cuenta en
 * `errores` y no tumba la página. Sólo con `AGENDA_RSVP_GOOGLE=encendido`.
 */
async function confirmarPorRsvps(
  pasada: Pasada, calendarId: string, tareas: Array<{ evento: EventoGoogle; fila: FilaEspejo | null }>,
): Promise<void> {
  const { conexion } = pasada
  for (const { evento, fila } of tareas) {
    if (!fila || !evento.id || evento.status === 'cancelled' || fila.status !== 'scheduled' || !fila.conPaciente) continue
    const aceptaron = aceptaronDe(evento)
    if (aceptaron.length === 0) continue
    try {
      if (await confirmarPorRsvp(conexion.clinicaId, calendarId, fila.id, evento.id, aceptaron)) pasada.r.cambios += 1
    } catch {
      pasada.r.errores += 1
      logger.warn('GCalSync', `RSVP sin aplicar ${JSON.stringify({ clinica: conexion.clinicaId, evento: evento.id })}`)
    }
  }
}

/**
 * D11 · lo importado o movido en esta página que se empalma con una cita
 * reservada por enlace: la base lo registra una sola vez por par y lo audita
 * (el aviso lo lee el panel «Por confirmar» de la agenda, canal de E8). Sólo
 * lo que de verdad cambió (`importar` con fila nueva, `aplicar` con puntas
 * que prendió): repetir una página o resincronizar no vuelve a avisar. Un
 * fallo no tumba la página; sin la migración de D11, no hace nada.
 *
 * AG-DT-264 (M5) · CON LA COLA (`gcal_empalmes_pendientes`): la cita quedó
 * apuntada en la base en la misma transacción que la escribió, así que aquí
 * sólo se le pide a la base que procese sus apuntes. Si falla, cuenta en
 * `errores` y los apuntes SIGUEN ahí: los toma la pasada siguiente, al empezar
 * (`procesarColaAlEmpezar`). Nada se pierde y no hace falta reintentar.
 *
 * SIN LA COLA (base sin M5): el camino de antes, con la lista en memoria (W):
 * un fallo se reintenta `REINTENTOS_EMPALMES` veces con una pausa corta, sólo
 * si queda presupuesto y la señal no se abortó; si aun así falla, `errores`,
 * el registro (con los ids) y Sentry.
 */
async function avisarEmpalmes(pasada: Pasada): Promise<void> {
  const ids = pasada.movidas.splice(0)
  const clinica = pasada.conexion.clinicaId
  if (!pasada.sinCola) {
    try {
      await procesarEmpalmesPendientes(clinica)
      return
    } catch (err) {
      if (!(err instanceof SincronizacionNoDisponible)) {
        pasada.r.errores += 1
        logger.warn('GCalSync', `empalmes con reservas sin procesar (siguen en la cola) ${JSON.stringify({ clinica })}`)
        return
      }
      pasada.sinCola = true
    }
  }
  if (ids.length === 0) return
  for (let intento = 0; ; intento += 1) {
    try {
      await registrarEmpalmesReserva(clinica, ids)
      return
    } catch (err) {
      if (err instanceof SincronizacionNoDisponible) return
      const quedaTiempo = pasada.ahora() + PAUSA_EMPALMES_MS <= pasada.limite && !pasada.op.senal?.aborted
      if (intento >= REINTENTOS_EMPALMES || !quedaTiempo) break
    }
    await new Promise((ok) => setTimeout(ok, PAUSA_EMPALMES_MS))
  }
  pasada.r.errores += 1
  logger.warn('GCalSync', `empalmes con reservas sin registrar ${JSON.stringify({ clinica, citas: ids })}`)
  await avisarSentryEmpalmes(clinica, ids)
}

/**
 * AG-DT-264 (M5) · al empezar la pasada: los apuntes que quedaron de una
 * anterior (su registro falló, o la función se cortó). Hasta `VUELTAS_COLA`
 * lotes de 500. Sin la migración, se anota y se sigue con la lista en memoria.
 * ⚠️ UN FALLO AQUÍ SÍ TUMBA LA PASADA, a propósito: es la señal. La pasada
 * cuenta como fallida (`errores_seguidos`), y a la tercera seguida la clínica
 * recibe el aviso «Google no sincroniza» de M1. Un consumidor que fallara en
 * silencio dejaría empalmes sin avisar sin que nadie se enterara.
 */
const VUELTAS_COLA = 4
async function procesarColaAlEmpezar(pasada: Pasada): Promise<void> {
  try {
    for (let i = 0; i < VUELTAS_COLA; i += 1) {
      const { quedan } = await procesarEmpalmesPendientes(pasada.conexion.clinicaId)
      if (!quedan) return
    }
  } catch (err) {
    if (!(err instanceof SincronizacionNoDisponible)) throw err
    pasada.sinCola = true
  }
}

/**
 * W · el aviso perdido, a Sentry: la clínica y las citas, nada más. El SDK se
 * carga sólo aquí y con `import()`, como en `global-error.tsx`: un import
 * estático metería `@sentry/node` en el arranque de cada función. OJO: hoy no
 * hay Sentry de servidor (sin `instrumentation.ts`, ver
 * `sentry.server.config.ts`), así que esto no envía nada hasta que se
 * encienda; y su `beforeSend` (`sentryPiiFilter`) redacta los uuid.
 */
async function avisarSentryEmpalmes(clinica: string, citas: string[]): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureMessage('GCalSync: empalmes con reservas sin registrar', { level: 'error', extra: { clinica, citas } })
  } catch {
    // Sin el SDK no hay más que hacer: ya quedó en el registro.
  }
}

/**
 * Ejecuta UNA decisión. Lanza si la base falla (lo cuenta `procesarPagina`).
 * `true` = hay que volver a escribir en Google el estado de Spinus (C5).
 */
async function ejecutar(pasada: Pasada, calendarId: string, d: Decision): Promise<boolean> {
  const { conexion, r } = pasada
  switch (d.tipo) {
    case 'ignorar':
      if (d.motivo === 'recurrente_ligado') logger.warn('GCalSync', `cita convertida en serie en Google: se ignora ${conexion.clinicaId}`)
      return false
    case 'importar': {
      const nueva = await importarEvento(conexion.clinicaId, calendarId, d.datos)
      if (nueva) {
        r.cambios += 1
        pasada.movidas.push(nueva)
      }
      return false
    }
    case 'quitar':
      await quitarCancelada(pasada, calendarId, d)
      return false
    case 'rechazar':
      r.restablecer.push(d.citaId)
      await auditar(conexion, d.citaId, d.motivo === 'gana_spinus' ? 'gcal_conflicto_cita' : 'gcal_cambio_rechazado',
        { gana: 'spinus', motivo: d.motivo, campos: d.campos })
      return true
    case 'aplicar': {
      const n = await aplicarORechazar(pasada, calendarId, d)
      if (n === 'rechazado') return true
      if (n > 0 && d.campos.length > 0) r.cambios += 1
      if (n > 0 && d.cambios.puntas) pasada.movidas.push(d.citaId)
      // n = 0: Spinus escribió entre la lectura y el aplicar; es el más
      // reciente y la pasada siguiente relee. Nada que auditar ni restablecer.
      if (n > 0 && d.restablecer.length > 0) {
        r.restablecer.push(d.citaId)
        await auditar(conexion, d.citaId, 'gcal_cambio_rechazado', { gana: 'spinus', motivo: 'no_aceptado', campos: d.restablecer })
      }
      if (n > 0 && d.conflicto === 'gana_google') {
        await auditar(conexion, d.citaId, 'gcal_conflicto_cita', { gana: 'google', motivo: 'mas_reciente', campos: d.campos })
      }
      return n > 0 && d.restablecer.length > 0
    }
  }
}

/**
 * Decisión de Angel (2026-11-27) · En Google se borró el evento de una cita ya CANCELADA: Spinus la quita de la
 * agenda (la CIERRA, como «Eliminar cita»: queda en el historial) y la desvincula, para que el evento no se
 * vuelva a crear ni la pasada siguiente la encuentre. Nada se restablece en Google.
 * BASE-2 (B1): cerrar y desvincular son UNA sentencia de la base (`gcal_cita_quitar_cancelada`), no dos pasos:
 * o las dos o ninguna. Si falla por algo pasajero se lanza, la página no avanza y la pasada siguiente lo repite.
 * Se audita sólo si ESTA pasada la cerró (una que ya estaba cerrada sólo se desvincula).
 */
async function quitarCancelada(pasada: Pasada, calendarId: string, d: Extract<Decision, { tipo: 'quitar' }>): Promise<void> {
  const { conexion, r } = pasada
  const q = await quitarCanceladaDeGoogle(conexion.clinicaId, calendarId, d.citaId, d.eventoId)
  if (q.cerrada || q.desvinculada) r.cambios += 1
  if (!q.cerrada) return
  await logAudit({
    userId: conexion.userId, accion: 'cita_quitada_de_agenda', tabla: 'appointments', registroId: d.citaId,
    descripcion: JSON.stringify({ clinica: conexion.clinicaId, campos: ['cerrada_en'], motivo: 'borrado_en_google', via: 'sondeo', origen: 'sistema' }),
  })
}

/**
 * Tanda I, punto 9: si la BASE rechaza lo que Google cambió (el candado de una
 * cita reservada por enlace: consultorio, día y hora sólo con «Reagendar»), es
 * un cambio rechazado como los de C-e: se audita y Spinus vuelve a escribir lo
 * suyo en Google (C5). La transacción de `gcal_aplicar_evento` se deshizo
 * entera (ni el etag nuevo): el restablecimiento usa el etag del evento.
 */
async function aplicarORechazar(pasada: Pasada, calendarId: string, d: Extract<Decision, { tipo: 'aplicar' }>): Promise<number | 'rechazado'> {
  try {
    return await aplicarEvento(pasada.conexion.clinicaId, calendarId, d)
  } catch (err) {
    if (!(err instanceof CambioRechazadoPorLaBase)) throw err
    // AG-DT-264 (C): el aviso va ANTES de auditar y de anotar el restablecimiento: si la base falla por
    // algo pasajero lanza, la página no avanza (arreglo 3 de la oleada 3) y al repetirla no hay nada duplicado.
    await avisarMovimientoRechazado(pasada, d.citaId, d.actualizado)
    pasada.r.restablecer.push(d.citaId)
    await auditar(pasada.conexion, d.citaId, 'gcal_cambio_rechazado', { gana: 'spinus', motivo: 'eleccion_paciente', campos: d.campos })
    return 'rechazado'
  }
}

/**
 * Tanda J, punto 10 · el aviso de la campana («Desde Google no se pueden
 * mover…»). Un aviso por INTENTO: la base deduplica por (cita, `updated` del
 * evento), así que repetir la página no avisa otra vez. Sin `updated` no hay
 * con qué distinguir intentos y no se avisa. Un fallo DEFINITIVO cuenta en
 * `errores` y no tumba la página (el rechazo y el restablecimiento siguen); uno
 * PASAJERO de la base se lanza: la página no avanza y la pasada siguiente lo
 * repite (AG-DT-264, C: antes el aviso se perdía). Sin la migración de J4, no
 * hace nada.
 */
async function avisarMovimientoRechazado(pasada: Pasada, citaId: string, actualizado: string | null): Promise<void> {
  if (!actualizado) return
  try {
    await registrarMovimientoRechazado(pasada.conexion.clinicaId, citaId, actualizado)
  } catch (err) {
    if (err instanceof SincronizacionNoDisponible) return
    if (esFalloPasajeroDeLaBase(err)) throw err
    pasada.r.errores += 1
    logger.warn('GCalSync', `aviso de movimiento rechazado sin registrar ${JSON.stringify({ clinica: pasada.conexion.clinicaId })}`)
  }
}

/** Auditoría de lo que el disparador de citas no ve. Nombres de campo, nunca valores. */
async function auditar(
  conexion: ConexionGoogle,
  citaId: string,
  accion: 'gcal_conflicto_cita' | 'gcal_cambio_rechazado',
  detalle: { gana: 'google' | 'spinus'; motivo: string; campos: readonly string[] },
): Promise<void> {
  await logAudit({
    userId: conexion.userId,
    accion,
    tabla: 'appointments',
    registroId: citaId,
    descripcion: JSON.stringify({ clinica: conexion.clinicaId, ...detalle, via: 'sondeo', origen: 'sistema' }),
  })
}
