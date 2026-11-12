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
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, esCredencialInvalida, type GCalCliente } from '@/lib/gcal'
import type { ConexionGoogle } from '@/lib/gcalConexion'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  decidirEvento, marcaSpinus, type ContextoDecision, type Decision, type EventoGoogle, type FilaEspejo,
} from '@/lib/gcalSincronizacionDecidir'
import {
  aplicarEvento, avanzarPagina, citasDeEventos, clinicaHabilitada, confirmarPorRsvp, importarEvento, reiniciarToken,
  soltarCandado, SincronizacionNoDisponible, tomarCandado, type Candado,
} from '@/lib/gcalSincronizacionBase'
import { restablecerEnGoogle, type PorRestablecer } from '@/lib/gcalSincronizacionRestablecer'
import { aceptaronDe, rsvpGoogleEncendido } from '@/lib/gcalRsvp'

/** C-b: la primera sincronización completa empieza hace 30 días, sin límite hacia adelante. */
export const DIAS_VENTANA_COMPLETA = 30
const LOTE = 5
const POR_PAGINA = 250

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
}

interface Pasada {
  conexion: ConexionGoogle
  candado: Candado
  op: OpcionesSincronizacion
  ahora: () => number
  limite: number
  r: ResultadoSincronizacion
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
    const pasada: Pasada = { conexion, candado, op, ahora, limite: ahora() + op.presupuestoMs, r }
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
    logger.error('GCalSync', `pasada fallida ${JSON.stringify({ clinica: conexion.clinicaId, codigo: codigoDeError(err) })}`)
    if (candado) await soltarCandado(conexion.clinicaId, candado.candado, codigoDeError(err)).catch(() => false)
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
    })
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
  const token = candado.fase === 'incremental' ? candado.syncToken : null
  const c: Cursor = {
    token, pagina: candado.pageToken, reintento410: false, reintentoPagina: false,
    ventana: token ? candado.ventanaDesde : candado.ventanaDesde ?? ventanaNueva(pasada.ahora()),
  }
  for (;;) {
    if (pasada.ahora() > pasada.limite) {
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
  items: EventoGoogle[],
  pagina: { calendarId: string; ventana: string | null; zona: string | null },
): Promise<void> {
  const { conexion } = pasada
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
  const pendientes: PorRestablecer[] = []
  for (let i = 0; i < tareas.length; i += LOTE) {
    const lote = tareas.slice(i, i + LOTE)
    const hechos = await Promise.allSettled(lote.map((t) => ejecutar(pasada, pagina.calendarId, t.decision)))
    hechos.forEach((h, j) => {
      const { evento, decision } = lote[j]
      if (h.status === 'rejected') {
        pasada.r.errores += 1
        logger.warn('GCalSync', `evento sin aplicar ${JSON.stringify({ clinica: conexion.clinicaId, evento: evento.id ?? null })}`)
      } else if (h.value && evento.id && (decision.tipo === 'rechazar' || decision.tipo === 'aplicar')) {
        pendientes.push({ citaId: decision.citaId, eventId: evento.id, etag: evento.etag ?? null })
      }
    })
  }
  // C5: lo rechazado vuelve a Google con el estado de Spinus, ANTES de avanzar
  // el token (si esto no llegara a correr, la página no avanza y se repite).
  const { errores } = await restablecerEnGoogle(conexion.clinicaId, calendar, pagina.calendarId, pendientes)
  pasada.r.errores += errores
  if (rsvpGoogleEncendido()) await confirmarPorRsvps(pasada, pagina.calendarId, tareas)
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
 * Ejecuta UNA decisión. Lanza si la base falla (lo cuenta `procesarPagina`).
 * `true` = hay que volver a escribir en Google el estado de Spinus (C5).
 */
async function ejecutar(pasada: Pasada, calendarId: string, d: Decision): Promise<boolean> {
  const { conexion, r } = pasada
  switch (d.tipo) {
    case 'ignorar':
      if (d.motivo === 'recurrente_ligado') logger.warn('GCalSync', `cita convertida en serie en Google: se ignora ${conexion.clinicaId}`)
      return false
    case 'importar':
      if (await importarEvento(conexion.clinicaId, calendarId, d.datos)) r.cambios += 1
      return false
    case 'rechazar':
      r.restablecer.push(d.citaId)
      await auditar(conexion, d.citaId, d.motivo === 'gana_spinus' ? 'gcal_conflicto_cita' : 'gcal_cambio_rechazado',
        { gana: 'spinus', motivo: d.motivo, campos: d.campos })
      return true
    case 'aplicar': {
      const n = await aplicarEvento(conexion.clinicaId, calendarId, d)
      if (n > 0 && d.campos.length > 0) r.cambios += 1
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
