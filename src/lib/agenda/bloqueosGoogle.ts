/**
 * src/lib/agenda/bloqueosGoogle.ts
 *
 * K1 (punto 6) · De Spinus a Google: el bloqueo de horario se manda al
 * calendario de Spinus como un evento «Ocupado» (`transparency: 'opaque'`),
 * con el título «Bloqueado» y el motivo si lo hay. De Google a Spinus lo trae
 * la sincronización (`gcal_bloqueo_aplicar`, sólo mover o borrar: un evento
 * creado en Google NUNCA se convierte en bloqueo).
 *
 * ⚠️ SÓLO SERVIDOR: corre dentro del `after()` de las rutas de
 * `/api/agenda/bloqueos`, con el cliente admin (los tokens de la conexión sólo
 * se alcanzan por el puente). Toda escritura en la base lleva `clinica_id`.
 *
 * PRIVACIDAD: el motivo lo escribe el médico a propósito y Angel pidió que
 * viaje (es el mismo criterio que el título libre de un evento sin paciente).
 * No lleva descripción, ni invitados, ni recordatorios: no se avisa a nadie.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { calendar_v3 } from 'googleapis'
import { conCalendarioSpinus, registrarFalloGCal } from '@/lib/gcal'
import type { ConexionGoogle } from '@/lib/gcalConexion'
import { puntasParaGoogle } from '@/lib/appointments'
import { TZ_CLINICA } from '@/lib/dates'
import { diaEnZonaDelConsultorio } from '@/lib/agenda/fechasAgenda'

/** La fila tal como la necesita el empuje (con su vínculo a Google). */
export interface BloqueoParaGoogle {
  id: string
  clinica_id: string
  inicio: string
  fin: string
  todo_el_dia: boolean
  zona: string | null
  motivo: string | null
  google_event_id: string | null
  gcal_calendar_id: string | null
}

export interface ContextoEmpuje {
  conexion: ConexionGoogle
  admin: SupabaseClient
  puedeReparar: boolean
  actorId: string
}

/** El título del evento: «Bloqueado», o «Bloqueado — motivo». */
export function tituloGoogleBloqueo(motivo: string | null): string {
  const m = motivo?.trim()
  return m ? `Bloqueado — ${m}` : 'Bloqueado'
}

/** El cuerpo del evento de Google de un bloqueo. La marca privada lo liga a la fila. */
export function eventoDeBloqueo(b: BloqueoParaGoogle, limpiar: boolean): calendar_v3.Schema$Event {
  const zona = b.zona ?? TZ_CLINICA
  const puntas = b.todo_el_dia
    ? puntasParaGoogle({ todoElDia: true, inicio: diaEnZonaDelConsultorio(b.inicio, zona), fin: diaEnZonaDelConsultorio(b.fin, zona), timezone: zona }, { limpiarLaOtraForma: limpiar })
    : puntasParaGoogle({ todoElDia: false, inicio: b.inicio, fin: b.fin, timezone: zona }, { limpiarLaOtraForma: limpiar })
  return {
    summary: tituloGoogleBloqueo(b.motivo),
    transparency: 'opaque',
    reminders: { useDefault: false, overrides: [] },
    ...puntas,
    extendedProperties: { private: { spinus_bloqueo: b.id, spinus_v: '2' } },
  }
}

/** El vínculo VIGENTE de la fila (el `after()` de un alta puede haberlo escrito
 *  después de que esta petición leyera la suya). `null` = la fila ya no está. */
async function vinculoActual(b: BloqueoParaGoogle, ctx: ContextoEmpuje): Promise<Pick<BloqueoParaGoogle, 'google_event_id' | 'gcal_calendar_id'> | null> {
  const { data } = await ctx.admin.from('agenda_bloqueos').select('google_event_id, gcal_calendar_id')
    .eq('id', b.id).eq('clinica_id', b.clinica_id).maybeSingle<Pick<BloqueoParaGoogle, 'google_event_id' | 'gcal_calendar_id'>>()
  return data ?? null
}

/** Alta o cambio en Google; guarda el vínculo (`google_event_id`, calendario, etag). */
export async function empujarBloqueo(b: BloqueoParaGoogle, ctx: ContextoEmpuje): Promise<void> {
  let calendarIdUsado: string | null = null
  try {
    const vinculo = await vinculoActual(b, ctx)
    if (!vinculo) return
    const r = await conCalendarioSpinus(ctx.conexion, ctx.admin, (calendar, calendarId) => {
      calendarIdUsado = calendarId
      const mismo = vinculo.google_event_id && vinculo.gcal_calendar_id === calendarId
      return mismo
        ? calendar.events.patch({ calendarId, eventId: vinculo.google_event_id ?? '', sendUpdates: 'none', requestBody: eventoDeBloqueo(b, true) })
        : calendar.events.insert({ calendarId, sendUpdates: 'none', requestBody: eventoDeBloqueo(b, false) })
    }, { puedeReparar: ctx.puedeReparar, actorId: ctx.actorId })
    if (!r?.data.id) return
    const { data, error } = await ctx.admin.from('agenda_bloqueos')
      .update({ google_event_id: r.data.id, gcal_calendar_id: calendarIdUsado, gcal_etag: r.data.etag ?? null })
      .eq('id', b.id).eq('clinica_id', b.clinica_id).select('id')
    if (error) registrarFalloGCal({ operacion: 'agenda_bloqueos.update(vínculo)', userId: ctx.actorId, conexionId: ctx.conexion.id, calendarId: calendarIdUsado }, error)
    /* Lo quitaron mientras Google contestaba: no se deja un «Ocupado» huérfano. */
    else if (!data?.length) await borrarBloqueoEnGoogle({ google_event_id: r.data.id, gcal_calendar_id: calendarIdUsado }, ctx)
  } catch (err) {
    registrarFalloGCal({ operacion: 'events.insert/patch (bloqueo)', userId: ctx.actorId, conexionId: ctx.conexion.id, calendarId: calendarIdUsado }, err)
  }
}

/** Baja en Google (la fila ya se borró). Un 404/410 es que ya no estaba: nada que hacer. */
export async function borrarBloqueoEnGoogle(
  v: { google_event_id: string | null; gcal_calendar_id: string | null }, ctx: ContextoEmpuje,
): Promise<void> {
  if (!v.google_event_id) return
  try {
    await conCalendarioSpinus(ctx.conexion, ctx.admin, async (calendar, calendarId) => {
      if (v.gcal_calendar_id && v.gcal_calendar_id !== calendarId) return null
      try {
        return await calendar.events.delete({ calendarId, eventId: v.google_event_id ?? '', sendUpdates: 'none' })
      } catch (err: unknown) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : null
        if (code === 404 || code === 410) return null
        throw err
      }
    }, { puedeReparar: false, actorId: ctx.actorId })
  } catch (err) {
    registrarFalloGCal({ operacion: 'events.delete (bloqueo)', userId: ctx.actorId, conexionId: ctx.conexion.id, calendarId: v.gcal_calendar_id }, err)
  }
}
