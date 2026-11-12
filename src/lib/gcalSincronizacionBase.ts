/**
 * src/lib/gcalSincronizacionBase.ts
 *
 * La ÚNICA puerta de la sincronización de vuelta (bloque C) a la base. Llama a
 * las RPC de `20261113120000_agenda_c1_gcal_sync_estado.sql` y
 * `20261113130000_agenda_c2_gcal_aplicar.sql` con el cliente de servicio, y a
 * nada más: ninguna consulta directa a una tabla (lo vigila
 * `cerrojoGcalSincronizacion.test.ts`).
 *
 * ── AISLAMIENTO ENTRE CLÍNICAS (pendiente prioritario de CLAUDE.md) ─────────
 * `createAdminClient()` esquiva la RLS. Por eso cada función recibe
 * `clinicaId` como PRIMER parámetro, lo valida como uuid (lanza si no lo es) y
 * lo manda como `p_clinica_id`; la RPC filtra por él en cada sentencia. El
 * `clinicaId` sale siempre del descriptor de la conexión resuelto en el
 * servidor, nunca de una petición.
 *
 * ── TOLERANCIA (mejora_agendaV2.md §6) ──────────────────────────────────────
 * En producción las migraciones pueden no estar todavía. Una RPC que no existe
 * (PGRST202, 42883) o una tabla que falta (42P01) lanza `SincronizacionNoDisponible`,
 * que el orquestador traduce a «no sincroniza, sin error». Cualquier otro
 * fallo lanza `Error` sin el cuerpo de la fila.
 */
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CambiosAceptados, DatosImportar, FilaEspejo } from '@/lib/gcalSincronizacionDecidir'

const UUID = z.guid()

/** Las migraciones de C todavía no están en esta base. No es un fallo. */
export class SincronizacionNoDisponible extends Error {
  constructor(rpc: string) {
    super(`sincronización con Google no disponible: falta ${rpc}`)
    this.name = 'SincronizacionNoDisponible'
  }
}

const CODIGOS_AUSENTE = new Set(['PGRST202', '42883', '42P01'])

interface ErrorRpc { code?: string; message: string }

function comprobarClinica(clinicaId: string): string {
  const r = UUID.safeParse(clinicaId)
  if (!r.success) throw new Error('gcalSincronizacionBase: clinicaId no es un uuid')
  return r.data
}

/** Llama a la RPC con `p_clinica_id` puesto y devuelve `data` o lanza. */
async function llamar(rpc: string, clinicaId: string, args: Record<string, unknown>): Promise<unknown> {
  const p_clinica_id = comprobarClinica(clinicaId)
  const { data, error } = await createAdminClient().rpc(rpc, { p_clinica_id, ...args })
  if (error) {
    const e: ErrorRpc = error
    if (e.code && CODIGOS_AUSENTE.has(e.code)) throw new SincronizacionNoDisponible(rpc)
    throw new Error(`${rpc}: ${e.code ?? 'sin código'} ${e.message.slice(0, 200)}`)
  }
  return data
}

/* ── C1: puerta, candado y token ───────────────────────────────────────── */

/** S3: `clinica_no_suspendida()` y `clinica_tiene_acceso()` para esta clínica. */
export async function clinicaHabilitada(clinicaId: string): Promise<boolean> {
  return z.boolean().parse(await llamar('gcal_sync_clinica_habilitada', clinicaId, {})) === true
}

const CandadoSchema = z.object({
  r_candado: z.guid(),
  r_fase: z.enum(['completa', 'incremental']),
  r_sync_token: z.string().nullable(),
  r_page_token: z.string().nullable(),
  r_ventana_desde: z.string().nullable(),
})

export interface Candado {
  candado: string
  fase: 'completa' | 'incremental'
  syncToken: string | null
  pageToken: string | null
  ventanaDesde: string | null
}

/** El candado de la clínica, o null si no toca (apagada, ocupada, reciente o en espera). */
export async function tomarCandado(
  clinicaId: string,
  args: { conexionId: string; calendarId: string; leaseSeg: number; minIntervaloSeg: number },
): Promise<Candado | null> {
  const data = await llamar('gcal_sync_tomar', clinicaId, {
    p_conexion_id: args.conexionId, p_calendar_id: args.calendarId,
    p_lease_seg: args.leaseSeg, p_min_intervalo_seg: args.minIntervaloSeg,
  })
  const filas = z.array(CandadoSchema).parse(data ?? [])
  const f = filas[0]
  return f
    ? { candado: f.r_candado, fase: f.r_fase, syncToken: f.r_sync_token, pageToken: f.r_page_token, ventanaDesde: f.r_ventana_desde }
    : null
}

/** Guarda la página siguiente o el token final (exactamente uno). false = el candado ya no es nuestro. */
export async function avanzarPagina(
  clinicaId: string,
  args: { candado: string; siguiente: { pageToken: string } | { syncToken: string }; ventanaDesde: string | null; leaseSeg: number },
): Promise<boolean> {
  const pageToken = 'pageToken' in args.siguiente ? args.siguiente.pageToken : null
  const syncToken = 'syncToken' in args.siguiente ? args.siguiente.syncToken : null
  return z.boolean().parse(await llamar('gcal_sync_avanzar', clinicaId, {
    p_candado: args.candado, p_page_token: pageToken, p_sync_token: syncToken,
    p_ventana_desde: args.ventanaDesde, p_lease_seg: args.leaseSeg,
  }))
}

/** 410: vuelve a sincronización completa sin soltar el candado. */
export async function reiniciarToken(clinicaId: string, candado: string): Promise<boolean> {
  return z.boolean().parse(await llamar('gcal_sync_reiniciar', clinicaId, { p_candado: candado }))
}

/** Suelta el candado. `error` = código corto fijo (nunca texto de Google); null = presupuesto agotado. */
export async function soltarCandado(clinicaId: string, candado: string, error: string | null): Promise<boolean> {
  return z.boolean().parse(await llamar('gcal_sync_soltar', clinicaId, { p_candado: candado, p_error: error }))
}

/* ── C2: espejo, aplicar e importar ────────────────────────────────────── */

const EspejoSchema = z.object({
  r_id: z.guid(),
  r_google_event_id: z.string().nullable(),
  r_gcal_calendar_id: z.string().nullable(),
  r_gcal_etag: z.string().nullable(),
  r_gcal_sync_status: z.enum(['synced', 'pending', 'failed', 'unbound']),
  r_origen: z.enum(['spinus', 'google']),
  r_status: z.enum(['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended']),
  r_start_time: z.string(),
  r_end_time: z.string(),
  r_all_day: z.boolean(),
  r_consultorio_timezone: z.string().nullable(),
  r_updated_at: z.string().nullable(),
  r_con_paciente: z.boolean(),
  r_titulo_sin_paciente: z.string().nullable(),
  r_notas_de_google: z.string().nullable(),
  r_paciente_nombre: z.string().nullable(),
  r_paciente_apellidos: z.string().nullable(),
})

function aFilaEspejo(r: z.infer<typeof EspejoSchema>): FilaEspejo {
  return {
    id: r.r_id, googleEventId: r.r_google_event_id, gcalCalendarId: r.r_gcal_calendar_id, gcalEtag: r.r_gcal_etag,
    gcalSyncStatus: r.r_gcal_sync_status, origen: r.r_origen, status: r.r_status,
    inicio: r.r_start_time, fin: r.r_end_time, todoElDia: r.r_all_day, zona: r.r_consultorio_timezone,
    // ⚠️ Tal cual, sin pasar por Date: el comparar-y-cambiar compara microsegundos.
    updatedAt: r.r_updated_at,
    conPaciente: r.r_con_paciente, tituloSinPaciente: r.r_titulo_sin_paciente, notasDeGoogle: r.r_notas_de_google,
    paciente: r.r_con_paciente && r.r_paciente_nombre !== null && r.r_paciente_apellidos !== null
      ? { nombre: r.r_paciente_nombre, apellidos: r.r_paciente_apellidos }
      : null,
  }
}

/** Las citas de ESTA clínica ligadas a esos eventos o con esos ids (marca de Spinus). */
export async function citasDeEventos(clinicaId: string, eventIds: string[], citaIds: string[]): Promise<FilaEspejo[]> {
  const data = await llamar('gcal_citas_por_evento', clinicaId, { p_eventos: eventIds, p_citas: citaIds })
  return z.array(EspejoSchema).parse(data ?? []).map(aFilaEspejo)
}

export interface Aplicacion {
  citaId: string
  esperadoUpdatedAt: string | null
  etag: string | null
  actualizado: string | null
  vincular: string | null
  desvincular: boolean
  cambios: CambiosAceptados
}

/** Aplica lo aceptado de Google a UNA cita. Devuelve las filas tocadas (0 = no prendió). */
export async function aplicarEvento(clinicaId: string, calendarId: string, a: Aplicacion): Promise<number> {
  const { cambios } = a
  return z.number().int().parse(await llamar('gcal_aplicar_evento', clinicaId, {
    p_cita_id: a.citaId, p_esperado_updated_at: a.esperadoUpdatedAt, p_calendar_id: calendarId,
    p_etag: a.etag, p_google_updated: a.actualizado, p_vincular_evento: a.vincular, p_desvincular: a.desvincular,
    p_start: cambios.puntas?.inicio ?? null, p_end: cambios.puntas?.fin ?? null, p_all_day: cambios.puntas?.todoElDia ?? null,
    p_title: cambios.titulo ?? null, p_tocar_notas: 'notas' in cambios, p_notas: cambios.notas ?? null,
    p_cancelar: cambios.cancelar === true,
  }))
}

/** Importa un evento creado en Google. Devuelve el id nuevo o null (ya existía / no procede). */
export async function importarEvento(clinicaId: string, calendarId: string, d: DatosImportar): Promise<string | null> {
  return z.guid().nullable().parse(await llamar('gcal_importar_evento', clinicaId, {
    p_calendar_id: calendarId, p_google_event_id: d.googleEventId, p_etag: d.etag, p_google_updated: d.actualizado,
    p_title: d.titulo, p_start: d.puntas.inicio, p_end: d.puntas.fin, p_all_day: d.puntas.todoElDia,
    p_timezone: d.zona, p_notas: d.notas, p_medico_id: d.medicoId,
  }))
}

/* ── E9: RSVP de Google ────────────────────────────────────────────────── */

/**
 * `accepted` del paciente → la cita pasa de agendada a confirmada
 * (`20261115160000_agenda_e9_rsvp_google.sql`). true = la confirmó; false =
 * sin cambio (no era scheduled, no casó el correo, apagada…).
 */
export async function confirmarPorRsvp(
  clinicaId: string, calendarId: string, citaId: string, eventId: string, aceptaron: string[],
): Promise<boolean> {
  const r = z.enum(['confirmada', 'sin_cambio']).parse(await llamar('cita_rsvp_google', clinicaId, {
    p_cita_id: citaId, p_calendar_id: calendarId, p_google_event_id: eventId, p_aceptaron: aceptaron,
  }))
  return r === 'confirmada'
}
