/**
 * googleReserva.ts — el evento de Google de una cita reservada por enlace
 * (agenda D8). SÓLO SERVIDOR; corre en el `after()` de POST /api/reservar.
 *
 * ⚠️ DUPLICADO A PROPÓSITO (Protocolo 4) del `after()` del alta de citas
 * (`src/app/api/appointments/route.ts`), en versión reducida: no hay sesión,
 * no hay todo el día, el médico es el del enlace. El FORMATO no se duplica:
 * sale del único `eventoParaGoogle`, con el convenio de la cita por ligar
 * (`{ nombre: reserva_nombre, apellidos: '' }`, el de D4 y el de
 * `pacienteParaGoogle` del lado interno), así que el título es «Cita médica: {nombre}» y la descripción la de cualquier cita con
 * paciente (clínica, «Consulta:», nombre y hora). SIN teléfono, correo,
 * observaciones ni tipo de cita (S1). Invitado: SÓLO el médico; el correo de
 * quien reservó nunca va a Google.
 *
 * `puedeReparar: false`: si la clínica aún no tiene calendario, no se crea en
 * la cuenta del dueño desde una página pública; la cita se queda `pending`,
 * como cuando agenda la secretaria. Sin conexión de Google, no se hace nada
 * (la cita también se queda `pending`, el valor con que nace en D3).
 * ⚠️ DEUDA ACEPTADA: si Google FALLA, la cita también se queda `pending` (no
 * `failed`, como en el alta), porque marcar el fallo exigiría un `.from()` con
 * el cliente de servicio o ampliar `gcal_aplicar_evento`. Queda el log; la
 * primera edición desde la agenda reintenta el alta del evento (PUT sin
 * `google_event_id`).
 *
 * Base de datos, con el cliente de servicio y SIEMPRE con la clínica:
 *   · la conexión, el correo del médico y el calendario, con los ayudantes de
 *     siempre (`resolverConexionClinica`, `correoDelMedico`,
 *     `conCalendarioSpinus`), que filtran por `clinica_id`;
 *   · ligar el evento a la cita SIN `.from()`: `citasDeEventos` (lee su
 *     `updated_at`) y `aplicarEvento` con `vincular` (comparar-y-cambiar,
 *     sólo columnas técnicas: no mueve `updated_at` ni audita), las
 *     envolturas de C sobre `gcal_citas_por_evento` / `gcal_aplicar_evento`. Si
 *     no prende (alguien editó la cita en ese instante), el sondeo la liga más
 *     tarde por la marca privada `spinus_cita` del evento (C4/C5).
 * Nunca lanza: todo fallo va al log sin datos personales.
 */
import type { calendar_v3 } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { conCalendarioSpinus, registrarFalloGCal } from '@/lib/gcal'
import { correoDelMedico } from '@/lib/medicoCorreo'
import { aplicarEvento, citasDeEventos } from '@/lib/gcalSincronizacionBase'
import {
  INTERRUPTORES_INVITADOS, componerAsistentes, eventoParaGoogle, propiedadesSpinus, puntasParaGoogle,
  type ClinicaEnCita, type PacienteEnCita,
} from '@/lib/appointments'

export interface CitaReservada {
  clinicaId: string
  citaId: string
  medicoId: string
  nombre: string
  inicio: string
  fin: string
  zona: string
  clinica: ClinicaEnCita
}

/** Lo que va a Google. Puro, para probarlo sin red. */
export function eventoDeReserva(c: CitaReservada, correoMedico: string | null): calendar_v3.Schema$Event {
  // El convenio de la cita por ligar (D4 y D6): nombre completo, apellidos vacíos.
  const persona: PacienteEnCita = { nombre: c.nombre.trim(), apellidos: '' }
  const { summary, description, reminders } = eventoParaGoogle(persona, c.clinica, c.nombre, c.inicio, c.zona, 'scheduled')
  const attendees = correoMedico
    ? componerAsistentes([], { medicoActual: correoMedico, medicoSaliente: null, pacienteSaliente: null, nuevos: [] })
    : []
  return {
    summary, description, attendees, ...INTERRUPTORES_INVITADOS, reminders,
    ...puntasParaGoogle({ todoElDia: false, inicio: c.inicio, fin: c.fin, timezone: c.zona }, { limpiarLaOtraForma: false }),
    extendedProperties: propiedadesSpinus(c.citaId),
  }
}

/**
 * Liga el evento recién creado a la cita con las envolturas de C (las únicas
 * autorizadas a nombrar estas RPC, ver `cerrojoGcalSincronizacion.test.ts`),
 * que mandan `p_clinica_id`. true si prendió. Lanza si la RPC falta o falla.
 */
async function ligar(c: CitaReservada, calendarId: string, eventId: string, etag: string): Promise<boolean> {
  const [fila] = await citasDeEventos(c.clinicaId, [], [c.citaId])
  if (!fila) return false
  const n = await aplicarEvento(c.clinicaId, calendarId, {
    citaId: c.citaId, esperadoUpdatedAt: fila.updatedAt, etag, actualizado: null,
    vincular: eventId, desvincular: false, cambios: {},
  })
  return n === 1
}

/** Crea el evento de la reserva y lo liga. Nunca lanza. */
export async function crearEventoReserva(c: CitaReservada): Promise<void> {
  const admin = createAdminClient()
  const ctx = { operacion: 'events.insert (reserva por enlace)', userId: c.medicoId }
  try {
    const conexion = await resolverConexionClinica(admin, c.clinicaId)
    if (!conexion) return
    const correo = await correoDelMedico(admin, c.medicoId, c.clinicaId)
    if (!correo.ok) {
      // Como en el alta: el evento se crea igual, sin invitado, y queda la pista.
      registrarFalloGCal({ ...ctx, conexionId: conexion.id }, new Error(`médico sin invitar: ${correo.motivo}`))
    }
    const creado = await conCalendarioSpinus(conexion, admin, async (calendar, calendarId) => ({
      calendarId,
      res: await calendar.events.insert({ calendarId, sendUpdates: 'all', requestBody: eventoDeReserva(c, correo.ok ? correo.correo : null) }),
    }), { puedeReparar: false, actorId: c.medicoId })
    const id = creado?.res.data.id
    const etag = creado?.res.data.etag
    if (!creado || !id || !etag) {
      registrarFalloGCal({ ...ctx, conexionId: conexion.id }, new Error(creado ? 'Google respondió sin id o etag' : 'sin calendario de clínica'))
      return
    }
    if (!(await ligar(c, creado.calendarId, id, etag))) {
      registrarFalloGCal({ ...ctx, conexionId: conexion.id, calendarId: creado.calendarId }, new Error('no se ligó el evento; lo hará el sondeo'))
    }
  } catch (err) {
    registrarFalloGCal(ctx, err)
  }
}
