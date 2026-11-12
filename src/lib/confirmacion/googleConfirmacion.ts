/**
 * googleConfirmacion.ts — la respuesta del paciente por el enlace se refleja
 * en Google (agenda E3, plan_E hallazgo 7). SÓLO SERVIDOR; corre en el
 * `after()` de POST /api/confirmar/[codigo].
 *
 * No hay sesión, así que el `after()` de C5 del PUT no sirve. Se usa el
 * restablecimiento de C5 (`restablecerEnGoogle`), que relee la fila por RPC y
 * escribe en Google lo que Spinus tiene: título (cancelada, con «CANCELADA — »),
 * puntas, color del estado, `status:'confirmed'` y la marca privada, SIN
 * descripción, con `If-Match` = el `etag` guardado y `sendUpdates:'none'`
 * (lista A 10: devolver el evento al estado de Spinus no avisa a los
 * invitados; el personal, al cancelar, sí avisa). Un 412 (alguien tocó el
 * evento en Google) se deja: el sondeo siguiente decide con «gana el último»,
 * y la respuesta del paciente es lo más nuevo (su `updated_at`).
 *
 * Base de datos, con el cliente de servicio y SIEMPRE con la clínica, por los
 * mismos ayudantes que el evento de la reserva por enlace (D8,
 * `googleReserva.ts`): `resolverConexionClinica` y `conCalendarioSpinus`
 * (filtran por `clinica_id`); la cita, por las RPC de C. `puedeReparar:false`:
 * una página pública no crea calendarios en la cuenta de nadie.
 * Nunca lanza: todo fallo va al log sin datos personales.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { conCalendarioSpinus } from '@/lib/gcal'
import { restablecerEnGoogle } from '@/lib/gcalSincronizacionRestablecer'
import { logger } from '@/lib/logger'

export interface CitaRespondida {
  clinicaId: string
  citaId: string
  eventId: string
  /** El `etag` que Spinus guardó del evento (para `If-Match`); null si no hay. */
  etag: string | null
}

/** Escribe en Google el estado nuevo de la cita. Nunca lanza. */
export async function reflejarEnGoogle(c: CitaRespondida): Promise<void> {
  try {
    const admin = createAdminClient()
    const conexion = await resolverConexionClinica(admin, c.clinicaId)
    if (!conexion) return
    const r = await conCalendarioSpinus(conexion, admin,
      (calendar, calendarId) => restablecerEnGoogle(c.clinicaId, calendar, calendarId, [{ citaId: c.citaId, eventId: c.eventId, etag: c.etag }]),
      { puedeReparar: false, actorId: 'enlace_paciente' })
    if (r && r.errores > 0) logger.warn('confirmacion', 'Google: la respuesta del paciente no se escribió; lo hará el sondeo')
  } catch (err) {
    logger.warn('confirmacion', `Google: reflejo fallido (${err instanceof Error ? err.name : 'desconocido'})`)
  }
}
