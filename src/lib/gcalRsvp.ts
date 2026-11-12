/**
 * src/lib/gcalRsvp.ts — la respuesta del paciente a la invitación de Google
 * (RSVP) como segunda vía de confirmación (agenda E9). Puro.
 *
 * ⚠️ DETRÁS DE `AGENDA_RSVP_GOOGLE=encendido` (apagado por omisión), además de
 * la agenda v2: que un RSVP llegue por `syncToken` NO está documentado
 * (`mejora_agendaV2.md` §8). Angel lo enciende tras probarlo con su cuenta real.
 *
 * Sólo cuenta `accepted` de un asistente que no sea el organizador, ni la
 * propia cuenta (`self`), ni un recurso (sala). `declined` no cambia nada,
 * como hoy (plan_E lista A 15). La comparación con el correo del paciente NO
 * se hace aquí: la hace la base (`cita_rsvp_google`), para que el correo del
 * paciente no tenga que salir de ella.
 */
import type { EventoGoogle } from '@/lib/gcalSincronizacionDecidir'

/** Tope de la RPC (`cita_rsvp_google`: 50 correos de 254 caracteres como mucho). */
const MAX_CORREOS = 50
const MAX_LARGO = 254

/** ¿El interruptor propio del RSVP está encendido? Lee el entorno en cada llamada. */
export function rsvpGoogleEncendido(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.AGENDA_RSVP_GOOGLE === 'encendido'
}

/** Los correos (minúsculas, sin espacios, sin repetir) de quien ACEPTÓ la invitación. */
export function aceptaronDe(evento: EventoGoogle): string[] {
  const correos = new Set<string>()
  for (const a of evento.attendees ?? []) {
    if (a.responseStatus !== 'accepted' || a.organizer === true || a.self === true || a.resource === true) continue
    const c = (a.email ?? '').trim().toLowerCase()
    if (c === '' || c.length > MAX_LARGO || !c.includes('@')) continue
    correos.add(c)
    if (correos.size >= MAX_CORREOS) break
  }
  return [...correos]
}
