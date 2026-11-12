/**
 * src/lib/gcalEscritura.ts
 *
 * La escritura SALIENTE a Google con la agenda v2 encendida (bloque C, paso C5
 * de `mejora_agendaV2.md`): lo que el `after()` de `PUT /api/appointments/[id]`
 * necesita para que «gana el último cambio» valga también en el sentido
 * Spinus → Google. Con el interruptor apagado no se llama nada de aquí y el
 * `after()` es el de siempre.
 *
 * ── EL CONFLICTO, EN UNA FRASE ──────────────────────────────────────────────
 * `events.get` antes del `patch`: si el `etag` del evento ya no es el que
 * Spinus guardó, Google cambió desde la última vez. Gana el más reciente
 * (`event.updated` contra `appointments.updated_at`; empate = Spinus, como en
 * `gcalSincronizacionDecidir.ts`). Si gana Google no se escribe: la
 * sincronización de vuelta lo aplica. Si gana Spinus, el `patch` lleva el
 * estado COMPLETO de la fila, no sólo lo que cambió, porque se guarda el `etag`
 * nuevo y lo que no se mandara quedaría distinto en Google sin que el sondeo
 * lo volviera a mirar. El `patch` va con `If-Match`; un 412 (alguien escribió
 * entre el `get` y el `patch`) repite el `get` y la decisión UNA vez.
 *
 * ⚠️ §8: que `patch` respete `If-Match` no está documentado (sí `update`). Si
 * Google lo ignorase, la protección se queda en la comparación de `etag` tras el
 * `get`, que cubre todo salvo una ventana de milisegundos.
 *
 * PRIVACIDAD (S1) — aquí no se compone texto: el cuerpo lo arma la ruta con
 * `eventoParaGoogle`. La auditoría lleva NOMBRES de campo, nunca valores.
 */
import type { calendar_v3 } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'
import { conCalendarioSpinus, registrarFalloGCal, type GCalCliente } from '@/lib/gcal'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { logAudit } from '@/lib/audit'

export type EventoGoogle = calendar_v3.Schema$Event
type Admin = ReturnType<typeof createAdminClient>

/** ¿El error de googleapis es un 412 (`If-Match` no coincidió)? */
export function esPrecondicionFallida(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ('code' in err && err.code === 412) return true
  if ('status' in err && err.status === 412) return true
  return 'response' in err && typeof err.response === 'object' && err.response !== null
    && 'status' in err.response && err.response.status === 412
}

/** ¿El cambio de Google es POSTERIOR al de Spinus? Empate o fecha ilegible: gana Spinus. */
export function googleEsMasReciente(actualizado: string | null | undefined, spinusUpdatedAt: string | null): boolean {
  const g = actualizado ? Date.parse(actualizado) : Number.NaN
  const s = spinusUpdatedAt ? Date.parse(spinusUpdatedAt) : Number.NaN
  if (Number.isNaN(g)) return false
  return Number.isNaN(s) || g > s
}

export interface PeticionParche {
  calendarId: string
  eventId: string
  /** El `etag` que Spinus guardó la última vez. `null` (citas de antes de v2): no se detecta conflicto. */
  etagGuardado: string | null
  /** `updated_at` de la fila YA escrita por esta edición. */
  spinusUpdatedAt: string | null
  /** El cuerpo del `patch` a partir del evento leído. `conflicto` = mandar el estado completo. */
  componer: (evento: EventoGoogle, conflicto: boolean) => { requestBody: EventoGoogle; sendUpdates: 'all' | 'none' }
}

export type ResultadoParche =
  | { tipo: 'parcheado'; etag: string | null; conflicto: boolean }
  | { tipo: 'gana_google' }

/**
 * `get` + decisión + `patch` con `If-Match`, con un solo reintento ante 412.
 * Lanza lo que no sea un 412 (o el segundo 412): el llamador lo registra y deja
 * la fila en `failed`, como hoy.
 */
export async function parchearConEtag(calendar: GCalCliente, p: PeticionParche): Promise<ResultadoParche> {
  for (let intento = 0; ; intento += 1) {
    const { data: evento } = await calendar.events.get({ calendarId: p.calendarId, eventId: p.eventId })
    const conflicto = p.etagGuardado !== null && typeof evento.etag === 'string' && evento.etag !== p.etagGuardado
    if (conflicto && googleEsMasReciente(evento.updated, p.spinusUpdatedAt)) return { tipo: 'gana_google' }
    const { requestBody, sendUpdates } = p.componer(evento, conflicto)
    try {
      const { data } = await calendar.events.patch(
        { calendarId: p.calendarId, eventId: p.eventId, sendUpdates, requestBody },
        evento.etag ? { headers: { 'If-Match': evento.etag } } : {},
      )
      return { tipo: 'parcheado', etag: data.etag ?? null, conflicto }
    } catch (err) {
      if (!esPrecondicionFallida(err) || intento >= 1) throw err
    }
  }
}

/**
 * El `updated_at` vigente de la cita, para saber si otro escritor más nuevo (el
 * sondeo u otra edición) pasó entre la escritura de la ruta y este `after()`.
 * `null` = no se pudo saber (la fila no está o la lectura falló): el llamador
 * sigue como hoy, porque sólo se omite el `patch` cuando consta que hay otro.
 *
 * Cliente de servicio: `clinica_id` explícito (pendiente prioritario de
 * CLAUDE.md), además del id.
 */
export async function releerUpdatedAt(admin: Admin, citaId: string, clinicaId: string): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('appointments')
      .select('updated_at')
      .eq('id', citaId)
      .eq('clinica_id', clinicaId)
      .maybeSingle<{ updated_at: string | null }>()
    if (error) return null
    return data?.updated_at ?? null
  } catch {
    return null
  }
}

/** Nombres de campo de una edición, para la auditoría del conflicto. NUNCA valores. */
export type CampoEdicion = 'hora' | 'todo_el_dia' | 'titulo' | 'notas' | 'estado' | 'paciente' | 'medico'

interface FilaComparable {
  start_time: string | null
  end_time: string | null
  all_day: boolean | null
  title?: string | null
  notes?: string | null
  status: string | null
  paciente_id: string | null
  medico_id: string | null
}

/** Qué cambió entre la fila de antes y la escrita. Las horas, por instante. */
export function camposEditados(antes: FilaComparable, despues: FilaComparable): CampoEdicion[] {
  const instante = (v: string | null): number => (v ? Date.parse(v) : Number.NaN)
  const campos: CampoEdicion[] = []
  if (instante(antes.start_time) !== instante(despues.start_time)
      || instante(antes.end_time) !== instante(despues.end_time)) campos.push('hora')
  if ((antes.all_day === true) !== (despues.all_day === true)) campos.push('todo_el_dia')
  if (antes.title !== undefined && (antes.title ?? null) !== (despues.title ?? null)) campos.push('titulo')
  if (antes.notes !== undefined && (antes.notes ?? null) !== (despues.notes ?? null)) campos.push('notas')
  if (antes.status !== despues.status) campos.push('estado')
  if (antes.paciente_id !== despues.paciente_id) campos.push('paciente')
  if (antes.medico_id !== despues.medico_id) campos.push('medico')
  return campos
}

/**
 * La descripción que Spinus manda a Google con v2 (S1).
 *   · Fila nacida en Google y SIN paciente: su descripción se sincroniza en los
 *     dos sentidos (`notes` es el texto que vino de Google). Sólo se manda si
 *     las notas cambiaron en Spinus (o hay que imponer el estado completo): así
 *     no se pisa con texto plano el HTML que Google tenga si nadie lo tocó.
 *     `undefined` = no se manda el campo.
 *   · Cualquier otra fila (nacida en Spinus, o ya ligada a un paciente): el
 *     formato fijo de `eventoParaGoogle`, sin observaciones. Como hoy.
 */
export function descripcionV2(
  fila: { origen?: string | null; paciente_id: string | null; notes?: string | null },
  fija: string,
  mandarNotas: boolean,
): string | undefined {
  if (fila.origen === 'google' && !fila.paciente_id) return mandarNotas ? (fila.notes ?? '') : undefined
  return fija
}

/** `gcal_conflicto_cita` de una edición en Spinus (el sondeo audita los suyos). */
export async function auditarConflictoEdicion(a: {
  userId: string
  clinicaId: string
  citaId: string
  gana: 'google' | 'spinus'
  campos: readonly CampoEdicion[]
}): Promise<void> {
  await logAudit({
    userId: a.userId,
    accion: 'gcal_conflicto_cita',
    tabla: 'appointments',
    registroId: a.citaId,
    descripcion: JSON.stringify({ clinica: a.clinicaId, gana: a.gana, motivo: 'mas_reciente', campos: a.campos, via: 'edicion' }),
  })
}

/** El `colorId` de Google de una cita atendida (grafito): el mismo del PUT. */
const COLOR_ATENDIDA = '8'

/**
 * C5 · `attended` llega a Google. `POST /api/consultas` marca la cita atendida
 * sin pasar por `PUT /api/appointments/[id]`, así que Google no se enteraba.
 * Con v2 encendido devuelve la tarea para `after()`: un `events.patch` SÓLO con
 * `colorId`, sin `get`, sin asistentes y sin reparar calendarios. Fuera del
 * camino crítico de guardar la nota.
 *
 * NO guarda el `etag` devuelto, a propósito: el `patch` no lleva `If-Match` y su
 * `etag` incluiría un cambio hecho en Google antes y aún sin leer (por ejemplo,
 * la cita movida allí). Guardarlo lo taparía como eco. Sin guardarlo, el sondeo
 * siguiente ve el `etag` distinto, compara el contenido y, si Google la movió,
 * la restablece (C-e); si no, sólo guarda el `etag`.
 *
 * `null` = nada que hacer (apagado, sin conexión o fallo al leer). Nunca lanza:
 * la nota ya está guardada.
 */
export async function prepararAtendidaEnGoogle(
  sesion: Awaited<ReturnType<typeof createClient>>,
  a: { clinicaId: string; eventId: string; userId: string },
): Promise<(() => Promise<void>) | null> {
  try {
    if (!(await agendaV2Encendida(sesion, a.clinicaId))) return null
    const conexion = await resolverConexionClinica(sesion, a.clinicaId)
    if (!conexion) return null
    return async () => {
      try {
        await conCalendarioSpinus(conexion, createAdminClient(), (calendar, calendarId) =>
          calendar.events.patch({ calendarId, eventId: a.eventId, sendUpdates: 'none', requestBody: { colorId: COLOR_ATENDIDA } }),
        { puedeReparar: false, actorId: a.userId })
      } catch (err) {
        registrarFalloGCal({ operacion: 'events.patch (cita atendida)', userId: a.userId, conexionId: conexion.id, eventId: a.eventId }, err)
      }
    }
  } catch {
    return null
  }
}
