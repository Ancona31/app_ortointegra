/**
 * src/lib/gcalSincronizacionBloqueos.ts
 *
 * K1 (punto 6) · De Google a Spinus, para los BLOQUEOS DE HORARIO: si el
 * evento «Ocupado» de un bloqueo se mueve o se borra en Google, se refleja en
 * Spinus igual que un evento sin paciente. Un evento creado en Google NUNCA se
 * convierte en bloqueo: `gcal_bloqueo_aplicar` sólo toca filas que ya existen.
 *
 * Va APARTE de `decidirEvento` a propósito: un bloqueo no es una fila de
 * `appointments`, y sin esta separación su evento entraría por `decidirSinFila`
 * como un evento nuevo de Google y se IMPORTARÍA como cita.
 */
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { llamarBloqueo, SincronizacionNoDisponible } from '@/lib/gcalSincronizacionBase'
import type { EventoGoogle } from '@/lib/gcalSincronizacionDecidir'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** ¿Lleva la clave `spinus_bloqueo`, valga lo que valga? Un evento así NUNCA entra
 *  por `decidirEvento` (aunque su marca esté rota no se importa como cita). */
export function tieneMarcaBloqueo(evento: EventoGoogle): boolean {
  return evento.extendedProperties?.private?.spinus_bloqueo !== undefined
}

/** El id de bloqueo de la marca privada del evento, o `null`. */
export function marcaBloqueo(evento: EventoGoogle): string | null {
  const m = evento.extendedProperties?.private?.spinus_bloqueo
  return typeof m === 'string' && UUID_RE.test(m) ? m.toLowerCase() : null
}

/** Los argumentos de la RPC para un evento, o `null` si no hay nada que aplicar. */
export function argumentosBloqueo(evento: EventoGoogle, calendarId: string): Record<string, unknown> | null {
  if (!evento.id) return null
  const base = { p_calendar_id: calendarId, p_google_event_id: evento.id, p_bloqueo_id: marcaBloqueo(evento), p_etag: evento.etag ?? null, p_google_updated: evento.updated ?? null }
  const nulos = { p_inicio: null, p_fin: null, p_desde: null, p_hasta: null }
  if (evento.status === 'cancelled') return { ...base, ...nulos, p_borrar: true }
  if (!evento.etag) return null
  const { start, end } = evento
  if (start?.dateTime && end?.dateTime) return { ...base, ...nulos, p_borrar: false, p_inicio: start.dateTime, p_fin: end.dateTime }
  if (start?.date && end?.date && FECHA.test(start.date) && FECHA.test(end.date)) {
    return { ...base, ...nulos, p_borrar: false, p_desde: start.date, p_hasta: end.date }
  }
  return null
}

/**
 * Aplica a sus bloqueos los eventos de la página que lo son (con marca) y los
 * BORRADOS que no son de ninguna cita (un borrado llega sin marca). Devuelve los
 * errores; sin la migración (RPC ausente), nada y sin ruido.
 */
export async function aplicarBloqueosDePagina(
  clinicaId: string, calendarId: string, marcados: readonly EventoGoogle[], borradosSinFila: readonly EventoGoogle[],
): Promise<number> {
  let errores = 0
  const borrados = await borradosDeBloqueos(clinicaId, borradosSinFila)
  for (const evento of [...marcados, ...borrados]) {
    const args = argumentosBloqueo(evento, calendarId)
    if (!args) continue
    try {
      z.number().int().parse(await llamarBloqueo(clinicaId, args))
    } catch (err: unknown) {
      if (err instanceof SincronizacionNoDisponible) return errores
      errores += 1
      logger.warn('GCalSync', `bloqueo sin aplicar ${JSON.stringify({ clinica: clinicaId, evento: evento.id ?? null })}`)
    }
  }
  return errores
}

/**
 * De los borrados sin cita, sólo los que son de un bloqueo: UNA lectura por
 * página (cliente de servicio, acotada por `clinica_id`) en vez de una RPC por
 * cada borrado, que en una resincronización completa pueden ser cientos.
 * Sin la tabla, ninguno.
 */
const TANDA_BORRADOS = 50

async function borradosDeBloqueos(clinicaId: string, borrados: readonly EventoGoogle[]): Promise<EventoGoogle[]> {
  const ids = borrados.map((e) => e.id).filter((id): id is string => typeof id === 'string')
  const suyos = new Set<string | null>()
  // En tandas: una página trae hasta 250 borrados y la lista viaja en la URL.
  for (let i = 0; i < ids.length; i += TANDA_BORRADOS) {
    const { data, error } = await createAdminClient().from('agenda_bloqueos').select('google_event_id')
      .eq('clinica_id', clinicaId).in('google_event_id', ids.slice(i, i + TANDA_BORRADOS))
    if (error && !['42P01', 'PGRST205'].includes(error.code)) {
      logger.warn('GCalSync', `borrados de bloqueos sin leer ${JSON.stringify({ clinica: clinicaId, codigo: error.code })}`)
    }
    for (const f of data ?? []) suyos.add(f.google_event_id)
  }
  return borrados.filter((e) => e.id && suyos.has(e.id))
}
