/**
 * src/lib/gcalRsvpRechazo.ts — el «No» del paciente a la invitación de Google (avisos globales,
 * decisión de Angel del 2026-11-24). SÓLO SERVIDOR; lo llama la pasada de sincronización, DESPUÉS de
 * sus decisiones (que no cambian) y sólo con `AGENDA_RSVP_GOOGLE=encendido`.
 *
 * Qué pasa lo decide la BASE (`cita_rsvp_google_rechazo`, M2), que compara el correo sin sacarlo:
 *   · con más de 1 hora de anticipación → cancela la cita. La base audita (`via: google_rsvp`), deja
 *     el aviso a la clínica y cuenta la cancelación para el candado. Aquí sólo se le escribe al
 *     paciente y se refleja la cancelación en el evento de Google;
 *   · en la última hora → NO cancela: la base deja el aviso «indicó que no asistirá» y el personal
 *     decide. Aquí no se hace nada más (ni correo ni Google);
 *   · si no aplica (otro correo, cita pasada, ya cancelada o atendida, M2 sin aplicar) → nada.
 *
 * ⚠️ UNA VEZ: la base cancela una sola vez (la pasada siguiente ve la cita cancelada y devuelve
 * `sin_cambio`), así que el correo sale una vez; además lleva llave de idempotencia por cita.
 * ⚠️ El correo va al que RECHAZÓ (lo devuelve la base), a nombre del médico, sin nada clínico. Si no
 * sale, la cancelación NO se deshace: queda en el log, sin la dirección.
 * ⚠️ Si después responde «Sí», nada: `cita_rsvp_google` sólo confirma lo agendado y una cancelada no
 * se reabre. El correo ya le dice que agende de nuevo.
 */
import { rechazarPorRsvp, type RechazoRsvp } from '@/lib/gcalSincronizacionBase'
import type { EventoGoogle, FilaEspejo } from '@/lib/gcalSincronizacionDecidir'
import { rechazaronDe } from '@/lib/gcalRsvp'
import { reflejarEnGoogle } from '@/lib/confirmacion/googleConfirmacion'
import { correoCancelacionPorRsvp } from '@/lib/confirmacion/correosCita'
import { enviarCorreo } from '@/lib/correo/transporte'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { logger } from '@/lib/logger'

export interface TareaRsvp { evento: EventoGoogle; fila: FilaEspejo | null }

/** El correo «tu cita fue cancelada porque indicaste que no asistirás». Nunca lanza. */
async function escribirAlPaciente(citaId: string, r: RechazoRsvp): Promise<void> {
  if (!r.r_para || !r.r_inicio) return
  try {
    const c = correoCancelacionPorRsvp({
      inicio: r.r_inicio, zona: r.r_zona, medico: r.r_medico ? componerNombreMedicoCompleto(r.r_medico) : '',
      consultorio: r.r_consultorio ?? { nombre: null, direccion: null, telefono: null },
    }, r.r_nombre)
    const envio = await enviarCorreo({ para: r.r_para, asunto: c.asunto, texto: c.texto, html: c.html, remitente: c.remitente,
      etiqueta: 'cancelacion-rsvp', idempotencia: `cancelacion-rsvp/${citaId}` })
    if (!envio.ok) logger.warn('GCalSync', `correo de cancelación por RSVP sin enviar (${envio.motivo})`)
  } catch (err) {
    logger.warn('GCalSync', `correo de cancelación por RSVP sin armar (${err instanceof Error ? err.name : 'error'})`)
  }
}

/**
 * Recorre lo que trajo la página y aplica los «No». Devuelve cuántas citas cambió y cuántas fallaron;
 * un fallo no tumba la página (como el «Sí»).
 */
export async function rechazarPorRsvps(clinicaId: string, calendarId: string, tareas: readonly TareaRsvp[]): Promise<{ cambios: number; errores: number }> {
  let cambios = 0, errores = 0
  for (const { evento, fila } of tareas) {
    if (!fila || !evento.id || evento.status === 'cancelled' || !fila.conPaciente) continue
    if (fila.status !== 'scheduled' && fila.status !== 'confirmed') continue
    const rechazaron = rechazaronDe(evento)
    if (rechazaron.length === 0) continue
    try {
      const r = await rechazarPorRsvp(clinicaId, calendarId, fila.id, evento.id, rechazaron)
      if (r?.r_resultado !== 'cancelada') continue
      cambios += 1
      await escribirAlPaciente(fila.id, r)
      // El evento sigue en Google como estaba: se le pone el estado de Spinus (cancelada), sin avisar a los invitados.
      await reflejarEnGoogle({ clinicaId, citaId: fila.id, eventId: evento.id, etag: evento.etag ?? r.r_gcal_etag }, 'google_rsvp')
    } catch {
      errores += 1
      logger.warn('GCalSync', `RSVP «No» sin aplicar ${JSON.stringify({ clinica: clinicaId, evento: evento.id })}`)
    }
  }
  return { cambios, errores }
}
