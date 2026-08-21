import { NextRequest, NextResponse } from 'next/server'
import type { calendar_v3 } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canVerAgendaCompleta } from '@/lib/permissions'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import {
  conCalendarioSpinus,
  registrarFalloGCal,
  esNotFound,
  esCredencialInvalida,
} from '@/lib/gcal'
import { logAudit } from '@/lib/audit'

/* ═══ POST /api/appointments/[id]/invitacion ═══════════════════════════════
   Añade al evento de Google de una cita a su médico asignado, a su paciente, o
   a los dos, y deja que Google les mande la invitación por correo.

   ── POR QUÉ ES RUTA PROPIA Y NO UNA RAMA DEL PUT ──────────────────────────
   Cuatro motivos, y ninguno sobra:
     · el PUT sincroniza con Google DENTRO de `after()`, así que su resultado se
       calcula DESPUÉS de responder y no llega jamás a quien pulsó. Una
       invitación tiene que poder decir si salió o no;
     · el PUT escribe `gcal_sync_status` y `gcal_calendar_id` en la cita, y
       enviar una invitación no debe tocar ninguna columna de `appointments`;
     · el permiso no es el mismo (ver abajo);
     · el PUT sólo entra en Google si cambió algún campo que Google vea, y aquí
       no cambia ninguno.
   Es SÍNCRONA por lo primero: quien pulsa espera el veredicto.

   ── QUIÉN PUEDE ───────────────────────────────────────────────────────────
   `canVerAgendaCompleta` — administrador de clínica y secretaria. Lista blanca,
   igual que en `/api/google/events`: un rol futuro cae fuera por construcción.
   Y el gate vive AQUÍ. Que el botón no se pinte no es un permiso: la ruta se
   alcanza con `curl` y una sesión cualquiera.

   Los dos destinatarios comparten permiso a propósito. Dos permisos distintos
   para dos casillas contiguas de la misma confirmación es complejidad que
   habría que explicarle a un médico cada vez.

   ── LO QUE ESTA RUTA NO HACE, EN NINGUNA DE SUS RAMAS ─────────────────────
   NO escribe en `appointments`. Ni en el camino feliz, ni en ninguno de los
   fallos. La cita queda exactamente igual que estaba, incluido su
   `gcal_sync_status`: una invitación que no sale no es una cita desincronizada.

   NO devuelve al navegador el correo del médico. Se resuelve en el servidor, al
   pulsar, y muere aquí. Ver `correoDelMedico`.

   NO lee la respuesta del invitado. Que el paciente rechace la invitación desde
   su correo no vuelve a Spinus: eso sería CAMINO DE VUELTA y está fuera de
   alcance (plan §12.2). La notificación cae en el buzón de la cuenta de Google
   de la clínica y se cancela a mano si procede.

   NO guarda que ya se envió. No hay columna de «invitación enviada» y es
   decisión, no olvido (plan §12.4): Google no duplica al asistente, sólo
   reenvía el correo, y eso es justo lo que hace falta para quien lo perdió. */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Máximo de invitaciones por usuario y hora.
 *
 * ⚠️ NO ES UN CONTROL DE SEGURIDAD Y NO HAY QUE LLAMARLO ASÍ. La policy
 * `usuario_own` de `rate_limits` es `FOR ALL`, así que quien quiera puede borrar
 * sus propias filas desde el cliente y reponerse el cupo entero. Es una barrera
 * contra el dedo repetido y contra el bucle accidental de un `useEffect`, que es
 * de lo que protege de verdad: cada pulsación manda correo a personas reales.
 */
const LIMITE_POR_HORA = 20

/** La cita, con lo justo para invitar. `pacientes` llega por el join. */
interface FilaCita {
  readonly id: string
  readonly clinica_id: string
  readonly google_event_id: string | null
  readonly medico_id: string | null
  readonly paciente_id: string | null
  readonly pacientes: { readonly email: string | null } | null
}

/** A quién se invita, ya con su dirección resuelta. */
interface Destinatario {
  readonly papel: 'medico' | 'paciente'
  readonly correo: string
}

/**
 * ¿Google rechazó la dirección de un asistente?
 *
 * ASUMIENDO QUE el 400 de `events.patch` por una dirección mal formada llega con
 * la palabra «attendee» en el mensaje, que es como lo documenta Google
 * (`invalidAttendeeEmail`). No está verificado contra producción: no se puede
 * comprobar leyendo código. Si la detección falla, el fallo cae en el 502
 * genérico, que dice «Google rechazó la operación» — impreciso pero no falso.
 *
 * ⚠️ Y ESTO SÓLO CAZA LO MAL ESCRITO, NO LO INEXISTENTE. Una dirección con
 * forma correcta que no existe la acepta Google con un 200 y rebota después, en
 * silencio y fuera de nuestra vista. Es el mismo motivo por el que el acuse de
 * esta ruta no puede decir «Enviado».
 */
function esCorreoRechazado(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as Record<string, unknown>
  const respuesta = (typeof e.response === 'object' && e.response !== null)
    ? e.response as Record<string, unknown>
    : null
  const status = typeof e.code === 'number' ? e.code
    : typeof e.status === 'number' ? e.status
    : typeof respuesta?.status === 'number' ? respuesta.status
    : null
  if (status !== 400) return false
  return err instanceof Error && /attendee/i.test(err.message)
}

/**
 * El correo del médico asignado, resuelto EN EL SERVIDOR y al pulsar.
 *
 * ── POR QUÉ NO VIAJA EN LA CITA ───────────────────────────────────────────
 * `public.profiles` NO TIENE COLUMNA `email` —son 16 y ninguna es ésa—, así que
 * ampliar el join de `APPOINTMENT_SELECT` no es cuestión de añadir un campo:
 * no se puede pedir lo que la tabla no tiene. Tampoco hay vista que lo exponga
 * (`public` no tiene ninguna) y PostgREST no cruza al esquema `auth`. Sale por
 * la API de Admin de Auth, que exige service role.
 *
 * ── `getUserById` Y NUNCA `listUsers` ─────────────────────────────────────
 * `src/app/api/admin/usuarios/route.ts` barre el proyecto con `listUsers()` y
 * cruza después por id, porque necesita a todos. Aquí hace falta UNO. Barrer
 * mil cuentas para quedarse con una es traer al servidor la libreta entera de
 * la plataforma cada vez que alguien pulsa un botón.
 *
 * ── LA COMPROBACIÓN DE CLÍNICA NO ES DECORATIVA ───────────────────────────
 * El cliente admin esquiva la RLS, así que el perfil se comprueba por `id` Y
 * por `clinica_id` ANTES de pedirle el correo a Auth (pendiente prioritario de
 * `CLAUDE.md`). `medicoId` sale de la fila de la cita, que ya vino filtrada por
 * RLS, pero esta ruta no puede depender de eso: el día que alguien lea la cita
 * con el cliente admin, esta línea es lo único que impide sacar el correo de un
 * usuario de otra clínica.
 *
 * Devuelve null sólo si el usuario no tiene correo, que es casi inalcanzable:
 * todo usuario de Spinus nace de un alta con correo. Se contempla igualmente
 * porque el `null` está en el tipo que devuelve Auth.
 */
async function correoDelMedico(
  admin: ReturnType<typeof createAdminClient>,
  medicoId: string,
  clinicaId: string,
): Promise<{ correo: string } | { fallo: NextResponse }> {
  const { data: perfil } = await admin
    .from('profiles')
    .select('id')
    .eq('id', medicoId)
    .eq('clinica_id', clinicaId)
    .maybeSingle<{ id: string }>()

  if (!perfil) {
    return {
      fallo: NextResponse.json(
        { error: 'medico_invalido', message: 'El médico de la cita no pertenece a tu clínica.' },
        { status: 400 },
      ),
    }
  }

  const { data, error } = await admin.auth.admin.getUserById(medicoId)
  const correo = data?.user?.email?.trim().toLowerCase() ?? ''

  if (error || correo === '') {
    return {
      fallo: NextResponse.json(
        {
          error: 'medico_sin_correo',
          message: 'No se pudo obtener el correo del médico asignado. Invita al paciente y avísale por otra vía.',
        },
        { status: 409 },
      ),
    }
  }

  return { correo }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    /* EL GATE. Ocultar el botón no es un permiso. */
    if (!canVerAgendaCompleta(profile)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Tu rol no puede enviar invitaciones de citas.' },
        { status: 403 },
      )
    }

    const { id } = await ctx.params
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'id_invalido' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const cuerpo: unknown = await req.json()
    const datos = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as {
      medico?: unknown
      paciente?: unknown
      pacienteEmail?: unknown
      confirmarCorreoTecleado?: unknown
    }
    const pedirMedico   = datos.medico   === true
    const pedirPaciente = datos.paciente === true
    /* Si llega, sustituye al de la ficha SÓLO para este envío: esta ruta no
       escribe en `pacientes`. Guardarlo es otra petición, posterior y aparte. */
    const correoTecleado = typeof datos.pacienteEmail === 'string'
      ? datos.pacienteEmail.trim().toLowerCase()
      : ''

    if (!pedirMedico && !pedirPaciente) {
      return NextResponse.json(
        { error: 'sin_destinatarios', message: 'Marca al menos un destinatario.' },
        { status: 400 },
      )
    }

    /* ── Tope de frecuencia ────────────────────────────────────────────────
       Antes de mirar la cita: si el cupo está agotado, no hay razón para leer
       nada más. El CONSUMO va más abajo, justo antes de llamar a Google. */
    const hace1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ruta', 'invitacion-cita')
      .gte('created_at', hace1h)

    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return NextResponse.json(
        {
          error: 'limite_alcanzado',
          message: `Has alcanzado el límite de ${LIMITE_POR_HORA} invitaciones por hora. Intenta más tarde.`,
        },
        { status: 429 },
      )
    }

    /* La cita, con el cliente de SESIÓN: `appointments_select` ya acota por
       clínica —y por médico, para el invitado, que aquí no llega—. Si no es
       visible para quien pregunta, no llega fila y esto contesta 404. */
    const { data: cita } = await supabase
      .from('appointments')
      .select('id, clinica_id, google_event_id, medico_id, paciente_id, pacientes(email)')
      .eq('id', id)
      .maybeSingle<FilaCita>()

    if (!cita) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    /* Sin evento no hay dónde invitar: invitar es un `patch` sobre el evento.
       No es un caso raro —la clínica puede no tener Google conectado, o ser la
       primera cita y el calendario aún no existir—, así que el botón ya llega
       apagado con el motivo a la vista y esto es la barrera de detrás. */
    if (!cita.google_event_id) {
      return NextResponse.json(
        {
          error: 'sin_evento',
          message: 'Esta cita todavía no tiene evento en Google, así que no hay a qué invitar.',
        },
        { status: 409 },
      )
    }

    // ── Los destinatarios ───────────────────────────────────────────────────
    const admin = createAdminClient()
    const destinos: Destinatario[] = []

    if (pedirMedico) {
      if (!cita.medico_id) {
        return NextResponse.json(
          { error: 'cita_sin_medico', message: 'Esta cita no tiene médico asignado.' },
          { status: 400 },
        )
      }
      const resuelto = await correoDelMedico(admin, cita.medico_id, profile.clinica_id)
      if ('fallo' in resuelto) return resuelto.fallo
      destinos.push({ papel: 'medico', correo: resuelto.correo })
    }

    if (pedirPaciente) {
      if (!cita.paciente_id) {
        return NextResponse.json(
          { error: 'cita_sin_paciente', message: 'Esta cita no tiene paciente ligado.' },
          { status: 400 },
        )
      }
      const correoFicha = cita.pacientes?.email?.trim().toLowerCase() ?? ''
      const destino = correoTecleado !== '' ? correoTecleado : correoFicha

      if (destino === '') {
        return NextResponse.json(
          {
            error: 'paciente_sin_correo',
            message: 'Este paciente no tiene correo en su ficha. Escribe uno para invitarlo.',
          },
          { status: 400 },
        )
      }
      if (!EMAIL_REGEX.test(destino)) {
        return NextResponse.json(
          { error: 'correo_invalido', message: 'El correo del paciente no tiene forma válida.' },
          { status: 400 },
        )
      }

      /* ⚠️ TODA DIRECCIÓN QUE VENGA DEL TECLADO EXIGE CONFIRMACIÓN, tenga la
         ficha correo o no. No es un «¿estás seguro?» de más: no existe
         «cancelar invitación», y lo que sale lleva el nombre completo del
         paciente en el título del evento.

         La confirmación letra por letra vive en el panel, que es donde se lee.
         Esta comprobación es la segunda barrera: la que sigue en pie cuando
         alguien cambia la primera. Con el correo de la ficha no hay nada que
         confirmar —ese dato ya lo validó alguien al guardarlo— y por eso la
         condición mira de dónde viene la dirección, no si coincide con la ficha. */
      if (correoTecleado !== '' && datos.confirmarCorreoTecleado !== true) {
        return NextResponse.json(
          {
            error: 'correo_no_confirmado',
            message: 'Una dirección escrita a mano tiene que confirmarse antes de enviar.',
          },
          { status: 403 },
        )
      }

      destinos.push({ papel: 'paciente', correo: destino })
    }

    // ── Google ──────────────────────────────────────────────────────────────
    const conexion = await resolverConexionClinica(supabase, profile.clinica_id)
    if (!conexion) {
      return NextResponse.json(
        {
          error: 'sin_conexion',
          message: 'Tu clínica no tiene Google Calendar conectado, así que no hay invitación que enviar.',
        },
        { status: 409 },
      )
    }

    /* El intento se cuenta ANTES de llamar a Google: un fallo del proveedor que
       no consumiera cupo dejaría el límite abierto a reintentos en bucle, que
       es justo el accidente del que esto protege. */
    await supabase.from('rate_limits').insert({ user_id: user.id, ruta: 'invitacion-cita' })

    const eventId = cita.google_event_id

    try {
      const resultado = await conCalendarioSpinus(conexion, admin, async (calendar, calendarId) => {
        /* ⚠️⚠️ TODO EL ESTADO DE ESTA OPERACIÓN VIVE DENTRO DEL CALLBACK, y no
           es estilo: `conCalendarioSpinus` REEJECUTA la operación entera si el
           calendario responde 404 (lo recrea y vuelve a llamar aquí). Cualquier
           acumulador declarado fuera arrastraría lo de la primera pasada a la
           segunda. */

        /* ⚠️⚠️⚠️ EL `get` NO ES UNA COMPROBACIÓN: ES LA MITAD DE LA OPERACIÓN.
           `events.patch` con `attendees` PISA LA LISTA ENTERA — no añade, pone.
           Un patch que mandara sólo al paciente BORRARÍA al médico invitado
           antes, y Google le mandaría una CANCELACIÓN de la cita.

           Lo peor de este error es cuándo aparece: la primera invitación de
           cada cita funciona perfecta, porque no hay nadie a quien borrar. Se
           rompe a partir de la segunda. Si alguien «simplifica» esto quitando
           el `get`, no se va a notar en ninguna prueba de un solo envío. */
        const { data: evento } = await calendar.events.get({ calendarId, eventId })

        const previos = evento.attendees ?? []
        const yaEstaban = new Set(
          previos.map(a => a.email?.trim().toLowerCase() ?? '').filter(e => e !== ''),
        )

        /* Los que ya estaban se reenvían TAL CUAL, con su `responseStatus`
           incluido: si el médico ya había aceptado, escribirle un `attendees`
           sin ese campo le devolvería la cita a «pendiente de responder». Se
           copia sólo lo que la API admite escribir; lo de sólo lectura (`id`,
           `self`, `organizer`) se queda fuera. Un asistente sin correo no es
           escribible y no puede reenviarse. */
        const mezclados: calendar_v3.Schema$EventAttendee[] = previos.flatMap(a => {
          const correo = a.email?.trim() ?? ''
          if (correo === '') return []
          return [{
            email: correo,
            ...(a.displayName      != null ? { displayName:      a.displayName }      : {}),
            ...(a.optional         != null ? { optional:         a.optional }         : {}),
            ...(a.responseStatus   != null ? { responseStatus:   a.responseStatus }   : {}),
            ...(a.comment          != null ? { comment:          a.comment }          : {}),
            ...(a.additionalGuests != null ? { additionalGuests: a.additionalGuests } : {}),
            ...(a.resource         != null ? { resource:         a.resource }         : {}),
          }]
        })

        for (const d of destinos) {
          if (!yaEstaban.has(d.correo)) mezclados.push({ email: d.correo })
        }

        /* UN SOLO `patch` CON LOS DOS INVITADOS, nunca dos seguidos.
           `sendUpdates: 'all'` notifica a TODOS los asistentes en CADA patch, así
           que dos llamadas le meterían al médico un segundo correo de «evento
           actualizado» encima de su invitación. */
        await calendar.events.patch({
          calendarId,
          eventId,
          sendUpdates: 'all',
          requestBody: {
            attendees: mezclados,
            /* LOS TRES VAN SIEMPRE, aunque el evento ya los tuviera.
               VERIFICADO CONTRA PRODUCCIÓN que los eventos NACEN sin ellos y que
               los defaults NO son iguales: `guestsCanModify` es false por
               omisión, pero `guestsCanInviteOthers` y `guestsCanSeeOtherGuests`
               valen TRUE. Si este patch no los manda, el médico y el paciente se
               ven el correo el uno al otro.

               Cuidado al comprobarlo en la respuesta: Google omite el campo
               cuando vale su default, así que un campo ausente significa
               «aplicado» en el primero y «Google lo ignoró» en los otros dos. */
            guestsCanModify:         false,
            guestsCanInviteOthers:   false,
            guestsCanSeeOtherGuests: false,
          },
        })

        return {
          medico:   pedirMedico   && yaEstaban.has(destinos.find(d => d.papel === 'medico')?.correo   ?? ''),
          paciente: pedirPaciente && yaEstaban.has(destinos.find(d => d.papel === 'paciente')?.correo ?? ''),
        }
      }, {
        /* `puedeReparar: false` FIJO, y no `canManageClinica`. Si el calendario
           está muerto, la rama de reparación desvincula TODAS las citas del
           dueño de la conexión y crea un calendario nuevo — y el reintento
           fallaría igual, porque el `eventId` que llevamos es del calendario que
           acaba de morir. Enviar una invitación no justifica un UPDATE masivo
           sobre `appointments`. Que lo repare quien administra, por la agenda. */
        puedeReparar: false,
        actorId: user.id,
      })

      /* null NO ES ÉXITO. Significa que no se resolvió calendario: la conexión
         existe pero no tiene `calendar_id`, o el de siempre dio 404 y el modo
         estricto se negó a recrearlo. Comparación explícita. */
      if (resultado === null) {
        registrarFalloGCal(
          { operacion: 'events.patch (invitación de cita, sin calendario)', userId: user.id, conexionId: conexion.id, eventId },
          new Error('no se resolvió calendario de clínica (modo estricto)'),
        )
        return NextResponse.json(
          {
            error: 'sin_conexion',
            message: 'No se pudo abrir el calendario de la clínica. Pide a quien administra que revise la conexión con Google.',
          },
          { status: 409 },
        )
      }

      /* ⚠️ EL `await` NO ES DECORATIVO Y NO SE QUITA.
         `logAudit` es `async` y su `try/catch` interno sólo garantiza que NO
         LANZA — no que termine. Sin esperarla, el `insert` sigue en vuelo
         cuando esta función devuelve la respuesta, y en Vercel la lambda puede
         congelarse en cuanto la respuesta se vacía: el registro se pierde. Y se
         pierde a veces, que es lo peor que puede pasarle a una auditoría —
         casi siempre llega, así que nadie sospecha del hueco.

         Media docena de rutas del repo la llaman sin esperarla, incluidas
         `/api/email/enviar-documento` y `/api/pacientes/[id]/correo`. Eso es el
         mismo defecto, no un precedente: aquí se espera. */
      await logAudit({
        userId: user.id,
        accion: 'enviar_invitacion_cita',
        tabla: 'appointments',
        registroId: cita.id,
        ip,
        /* El papel, nunca la dirección. Ver la nota de `AuditAccion`. */
        descripcion: `Invitación de cita enviada a: ${destinos.map(d => d.papel === 'medico' ? 'el médico asignado' : 'el paciente').join(' y ')}.`,
      })

      return NextResponse.json({
        ok: true,
        invitados: { medico: pedirMedico, paciente: pedirPaciente },
        /* Quién ya figuraba como asistente antes de este patch. Sirve para que
           el acuse no prometa un alta que no ocurrió: a ése Google le reenvió el
           correo, que es lo que se buscaba. */
        yaEstaban: resultado,
      })
    } catch (gcalErr) {
      registrarFalloGCal(
        { operacion: 'events.patch (invitación de cita)', userId: user.id, conexionId: conexion.id, eventId },
        gcalErr,
      )

      /* El orden importa: `invalid_grant` puede venir con cualquier status, así
         que se pregunta primero. Ninguna de estas ramas escribe en la cita. */
      if (esCredencialInvalida(gcalErr)) {
        return NextResponse.json(
          {
            error: 'conexion_revocada',
            message: 'La conexión con Google dejó de ser válida. Hay que volver a conectarla desde el perfil de quien administra.',
          },
          { status: 409 },
        )
      }
      if (esNotFound(gcalErr)) {
        return NextResponse.json(
          {
            error: 'evento_desaparecido',
            message: 'El evento de esta cita ya no existe en Google. Edita y guarda la cita para volver a sincronizarla.',
          },
          { status: 409 },
        )
      }
      if (esCorreoRechazado(gcalErr)) {
        return NextResponse.json(
          { error: 'correo_rechazado', message: 'Google rechazó una de las direcciones. Revísala y vuelve a intentarlo.' },
          { status: 400 },
        )
      }
      return NextResponse.json(
        { error: 'google_fallo', message: 'Google no pudo completar la invitación. Inténtalo de nuevo en un momento.' },
        { status: 502 },
      )
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
