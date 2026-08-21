import { NextRequest, NextResponse, after } from 'next/server'
import type { calendar_v3 } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, registrarFalloGCal } from '@/lib/gcal'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { canManageClinica } from '@/lib/permissions'
import { APPOINTMENT_SELECT, eventoParaGoogle, componerAsistentes, INTERRUPTORES_INVITADOS,
         type ClinicaEnCita, type PacienteEnCita } from '@/lib/appointments'
import { correoDelMedico } from '@/lib/medicoCorreo'
import { TZ_CLINICA } from '@/lib/dates'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/* ── GET /api/appointments ──────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const from = req.nextUrl.searchParams.get('from')
    const to   = req.nextUrl.searchParams.get('to')

    const medicoFilter = req.nextUrl.searchParams.get('medico_id')

    // RLS filtra por clinica_id
    let query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq('clinica_id', profile.clinica_id)
      .order('start_time', { ascending: true })

    if (medicoFilter) query = query.eq('medico_id', medicoFilter)

    if (from) query = query.gte('start_time', from)
    if (to)   query = query.lte('start_time', to)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ appointments: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── POST /api/appointments ─────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Gate Fase 8.1 (extendido en Fase 8.2): bloquear creación de citas si
    // la clínica está cancelada, no es VIP y ya tiene >5 pacientes activos
    // (ex-cliente pagado). Free de buena fe (≤5 pacientes) NO se ve afectado.
    const { data: clinicaGate } = await supabase
      .from('clinicas')
      .select('suscripcion_estado, es_vip_grant')
      .eq('id', profile.clinica_id)
      .single()
    if (clinicaGate?.suscripcion_estado === 'cancelado' && !clinicaGate?.es_vip_grant) {
      const { count: activosCount } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', profile.clinica_id)
        .or('activo.eq.true,activo.is.null')
      if ((activosCount ?? 0) > 5) {
        return NextResponse.json(
          { error: 'subscription_inactive', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevas citas.' },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const { title, start_time, end_time, paciente_id, notes, medico_id, consultorio_id, client_id } = body

    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Fase 2.6: consultorio_id es obligatorio para nuevas citas (multiconsultorio).
    if (!consultorio_id) {
      return NextResponse.json(
        { error: 'consultorio_id_required', message: 'Debes seleccionar un consultorio para la cita.' },
        { status: 400 }
      )
    }

    // Validar formato UUID antes de query (evita 500 con entrada malformada).
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(consultorio_id)) {
      return NextResponse.json(
        { error: 'consultorio_invalido', message: 'consultorio_id no tiene formato UUID válido.' },
        { status: 400 }
      )
    }

    // `client_id` — clave de idempotencia del alta, una por escritura (la
    // genera el cliente). Hace dos cosas a la vez:
    //   · el índice único `idx_appointments_client_id` convierte un doble
    //     clic, un reintento del navegador o una reconexión a media petición
    //     en la MISMA cita, no en dos (ver el manejo del 23505 más abajo);
    //   · viaja en el payload de Realtime, así que la pestaña que escribió
    //     reconoce su propio eco y no lo vuelve a aplicar.
    // Opcional a propósito: las citas que entran por otros caminos (o por un
    // cliente viejo) siguen funcionando sin ella.
    if (client_id !== undefined && client_id !== null) {
      if (typeof client_id !== 'string' || !UUID_REGEX.test(client_id)) {
        return NextResponse.json(
          { error: 'client_id_invalido', message: 'client_id no tiene formato UUID válido.' },
          { status: 400 }
        )
      }
    }

    // 5.H Paso 1: Determinar medico_id según rol (D-5.H-3).
    // Defense in depth: el frontend ya oculta el dropdown para médico invitado,
    // pero validamos server-side por si manipulan el request directamente.
    let finalMedicoId: string
    const esMedicoInvitado = profile.role === 'medico' && !profile.es_admin_de_clinica
    const esAdminOSecretaria = (profile.role === 'medico' && profile.es_admin_de_clinica) || profile.role === 'secretaria'

    if (esMedicoInvitado) {
      // Médico invitado: forzar su propio UUID, ignorar lo que envíe el body
      finalMedicoId = profile.userId
    } else if (esAdminOSecretaria) {
      // Admin/secretaria: aceptar body.medico_id, validar pertenencia a clínica
      if (!medico_id) {
        return NextResponse.json(
          { error: 'medico_id_required', message: 'Debes seleccionar un médico para la cita.' },
          { status: 400 }
        )
      }
      const { data: medicoValido } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', medico_id)
        .eq('clinica_id', profile.clinica_id)
        .eq('role', 'medico')
        .maybeSingle()
      if (!medicoValido) {
        return NextResponse.json(
          { error: 'medico_invalido', message: 'El médico seleccionado no pertenece a tu clínica.' },
          { status: 400 }
        )
      }
      finalMedicoId = medico_id
    } else {
      return NextResponse.json(
        { error: 'forbidden', message: 'Tu rol no puede crear citas.' },
        { status: 403 }
      )
    }

    // Fase 2.6 + F3-5c: validar consultorio y cargar snapshot inmutable.
    // El consultorio debe existir, estar activo, y pertenecer al médico
    // al que se le agendará la cita (finalMedicoId).
    // Usamos admin client porque tras la migración 06 (RLS consultorios
    // owner-only), un admin de clínica NO ve los consultorios de invitados
    // vía RLS, pero SÍ debe poder agendarles citas. finalMedicoId ya quedó
    // validado contra la clínica del caller (líneas 142-154), así que el
    // bypass de RLS es seguro. Defensa en profundidad: filtramos por
    // clinica_id por si hubiera drift de datos.
    const adminConsultorio = createAdminClient()
    const { data: consultorio, error: errConsultorio } = await adminConsultorio
      .from('consultorios')
      .select('id, nombre, nombre_corto, direccion, telefono, timezone')
      .eq('id', consultorio_id)
      .eq('medico_id', finalMedicoId)
      .eq('clinica_id', profile.clinica_id)
      .eq('activo', true)
      .maybeSingle()

    if (errConsultorio) {
      console.error('[POST /api/appointments] error cargando consultorio:', errConsultorio)
      return NextResponse.json({ error: errConsultorio.message }, { status: 500 })
    }
    if (!consultorio) {
      return NextResponse.json(
        { error: 'consultorio_invalido', message: 'El consultorio no existe, está archivado, o no pertenece al médico seleccionado.' },
        { status: 400 }
      )
    }

    // RLS filtra por clinica_id
    const { data: apt, error } = await supabase
      .from('appointments')
      .insert({
        clinica_id:      profile.clinica_id,
        created_by:      profile.userId,
        paciente_id:     paciente_id || null,
        title,
        start_time,
        end_time,
        notes:           notes || null,
        status:          'scheduled',
        medico_id:        finalMedicoId,
        gcal_sync_status: 'pending',
        client_id:        client_id ?? null,
        // Snapshot inmutable del consultorio (Fase 2.6).
        consultorio_id:            consultorio.id,
        consultorio_nombre:        consultorio.nombre,
        consultorio_nombre_corto:  consultorio.nombre_corto,
        consultorio_direccion:     consultorio.direccion,
        consultorio_telefono:      consultorio.telefono,
        consultorio_timezone:      consultorio.timezone,
      })
      .select(APPOINTMENT_SELECT)
      .single()

    if (error) {
      // 23505 = unique_violation. Con `client_id` en juego, casi siempre es el
      // índice único `idx_appointments_client_id`: alguien reintentó un alta
      // que YA ENTRÓ. La respuesta correcta no es un error —la cita existe y
      // el cliente sólo quiere saber cuál es—, sino devolverla con la misma
      // forma que si acabara de crearse. Sin esto, la idempotencia cambiaría
      // un duplicado por un 500, que no es mejor.
      //
      // No se decide leyendo el mensaje del índice, sino releyendo por
      // `client_id`: si aparece una cita, el choque fue ése; si no aparece
      // (otro índice, o la fila es de otra clínica y la RLS no la deja ver),
      // el error se propaga tal cual.
      //
      // Y se devuelve ANTES del after() de Google a propósito: el alta
      // original ya creó su evento. Reintentar aquí crearía el duplicado en
      // el calendario del médico que este bloque existe para evitar.
      if (error.code === '23505' && client_id) {
        const { data: yaExiste } = await supabase
          .from('appointments')
          .select(APPOINTMENT_SELECT)
          .eq('client_id', client_id)
          .eq('clinica_id', profile.clinica_id)
          .maybeSingle()
        if (yaExiste) {
          return NextResponse.json({ appointment: yaExiste, gcalSync: 'skipped' })
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Google Calendar sync en background con el cliente admin.
    //
    // NO es por las cookies: `after()` conserva el contexto de la petición y la
    // RLS funciona ahí con normalidad (comprobado en producción el 2026-08-16).
    // El cliente admin está aquí porque los tokens de la conexión sólo se
    // alcanzan por el puente, que exige service role.
    //
    // LO QUE ARREGLA ESTE COMMIT: antes se le buscaba token a QUIEN EJECUTA la
    // acción. La secretaria no tenía fila, no se encontraba nada, y sus citas
    // no llegaban a Google en silencio. Ahora la conexión se resuelve por
    // CLÍNICA y quién agende deja de importar.
    //
    // LAS TRES COSAS SE CAPTURAN ANTES DE RESPONDER, con el cliente de sesión,
    // y viajan por closure (plan §1): dentro de `after()` no se resuelve nada.
    const conexion = await resolverConexionClinica(supabase, profile.clinica_id)
    // Modo estricto para quien no administra: si el calendario de la clínica no
    // existe todavía, la secretaria NO lo crea —eso escribiría en la cuenta de
    // Google del administrador— y la cita queda 'pending' hasta que él entre.
    const puedeReparar = canManageClinica(profile)
    const admin = createAdminClient()
    // El titulo del evento sale del paciente ligado; si la cita no tiene
    // paciente, del titulo libre de la cita.
    const pacienteCita: PacienteEnCita = apt.pacientes ?? null
    const clinicaCita:  ClinicaEnCita  = apt.clinicas  ?? null
    // EL HUSO DEL EVENTO ES EL DEL CONSULTORIO, NO EL DEL CENTRO. Antes se
    // etiquetaba con una constante fija (Ciudad de Mexico), asi que la
    // invitacion de una cita en Hermosillo decia "hora estandar central". El
    // INSTANTE siempre viajo bien —`start_time` va en UTC y Google lo respeta—,
    // o sea que esto nunca movio ninguna cita de sitio: lo que estaba mal era la
    // ETIQUETA, y con ella el texto que lee el paciente.
    //
    // Sale del snapshot que la fila acaba de congelar: si el consultorio cambia
    // de huso manana, esta cita conserva el suyo. En el alta nunca es null
    // —`consultorios.timezone` es NOT NULL y el consultorio es obligatorio—,
    // pero el respaldo va igual, por simetria con el PUT, donde SI puede serlo.
    const tzCita: string = apt.consultorio_timezone ?? TZ_CLINICA
    // Sin conexión de clínica no se programa NADA. Antes se entraba igual y se
    // salía con `gcal_sync_status = 'synced'` y sin evento —una mentira
    // benigna—; marcarlo 'failed' en su lugar llenaría de citas fallidas la
    // agenda de una clínica que simplemente no usa Google. No hay nada que
    // sincronizar, así que la columna se queda como está y la respuesta ya
    // dice 'disconnected'.
    if (conexion) {
      after(async () => {
        let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
        let google_event_id: string | null = null
        let calendarIdUsado: string | null = null

        try {
          // La descripción lleva un formato fijo (clínica y paciente) y NADA
          // clínico: ni notes, ni motivo de consulta, ni diagnóstico.
          // El estado en el alta es siempre 'scheduled' (se escribe arriba, en
          // el insert de la fila), así que aquí nunca sale el prefijo de
          // cancelación — va igualmente porque el título tiene un solo autor.
          const { summary, description, reminders } = eventoParaGoogle(pacienteCita, clinicaCita, title, apt.start_time, tzCita, 'scheduled')

          /* ── EL MÉDICO ENTRA AQUÍ, EN EL MISMO `insert` ────────────────────
             Si tiene la cita asignada, tiene que tenerla en su calendario: no
             es una elección de nadie y por eso no pasa por el botón de
             invitación ni por su ruta.

             UNA LLAMADA Y NO DOS. Añadirlo después con un `patch` costaría un
             viaje más y, con `sendUpdates: 'all'`, un segundo correo de «evento
             actualizado» pisándole la invitación que acababa de recibir.

             Si el correo no se resuelve, el evento se crea IGUAL y sin
             asistentes: una cita sin invitación es peor que una cita sin
             evento, y ya existe `gcal_sync_status` para lo segundo. Queda la
             línea de log y el botón de invitación para arreglarlo a mano.

             `finalMedicoId` nunca es null en el alta: la ruta lo exige y lo
             valida contra la clínica más arriba. */
          let asistentes: calendar_v3.Schema$EventAttendee[] = []
          const correoMedico = await correoDelMedico(admin, finalMedicoId, profile.clinica_id)
          if (correoMedico.ok) {
            asistentes = componerAsistentes([], {
              medicoActual:     correoMedico.correo,
              medicoSaliente:   null,
              pacienteSaliente: null,
              nuevos:           [],
            })
          } else {
            registrarFalloGCal(
              { operacion: `events.insert (alta de cita, médico sin invitar: ${correoMedico.motivo})`, userId: profile.userId, conexionId: conexion.id },
              new Error('no se pudo resolver el correo del médico asignado'),
            )
          }

          const creado = await conCalendarioSpinus(conexion, admin, (calendar, calendarId) => {
            calendarIdUsado = calendarId
            return calendar.events.insert({
              calendarId,
              /* Que Google le mande el correo, y no sólo le deje el evento en la
                 agenda. Al médico que ES dueño de la cuenta conectada no le llega
                 nada de todos modos —Google no notifica al organizador de su
                 propio evento, §12.17—, así que esto sólo alcanza al médico
                 invitado con su propia cuenta, que es justo quien no tiene otra
                 vía de enterarse. Sin esto, que el evento le aparezca depende de
                 un ajuste de SU cuenta que nosotros no controlamos. */
              sendUpdates: 'all',
              requestBody: {
                summary,
                description,
                attendees: asistentes,
                ...INTERRUPTORES_INVITADOS,
                // Sólo al crear: si el médico le cambia el recordatorio a mano en
                // Google, ninguna edición posterior desde Spinus se lo reimpone.
                reminders,
                start: { dateTime: start_time, timeZone: tzCita },
                end:   { dateTime: end_time,   timeZone: tzCita },
              },
            })
          }, { puedeReparar, actorId: profile.userId })
          // EL 'synced' DEJA DE SER OPTIMISTA (H4). Antes se marcaba sincronizada
          // toda cita que no hubiera lanzado, incluidas las que salieron sin id
          // de evento: `creado` en null porque el modo estricto se negó a crear
          // el calendario, o porque Google contestó sin `id`. Esas citas se
          // quedaban en 'synced' sin nada en Google y nadie volvía a mirarlas.
          google_event_id  = creado?.data.id ?? null
          if (google_event_id) {
            gcal_sync_status = 'synced'
          } else {
            gcal_sync_status = 'failed'
            registrarFalloGCal(
              { operacion: 'events.insert (alta de cita, sin id de evento)', userId: profile.userId, conexionId: conexion.id, calendarId: calendarIdUsado },
              new Error(creado === null
                ? 'no se resolvió calendario de clínica (¿modo estricto?)'
                : 'Google respondió sin id de evento'),
            )
          }
        } catch (gcalErr) {
          // Corre dentro de after(): nadie ve el fallo del lado del cliente y la
          // cita se queda en 'failed' sin más pista que esta línea.
          registrarFalloGCal(
            { operacion: 'events.insert (alta de cita)', userId: profile.userId, conexionId: conexion.id, calendarId: calendarIdUsado },
            gcalErr,
          )
          gcal_sync_status = 'failed'
        }

        // `clinica_id` no es decorativo aunque `id` sea la clave primaria: con el
        // cliente admin la RLS no acota nada. Mismo criterio que el `after()` del
        // PUT en appointments/[id]/route.ts.
        //
        // `gcal_calendar_id` se estampa aquí y es la razón de que la rama
        // siguiente pueda arreglar el ámbito de `desvincularCitas`: sin saber en
        // qué calendario vive cada evento, el barrido no puede dejar de acotar
        // por `medico_id` (plan §0.7).
        const { error: errEstado } = await admin
          .from('appointments')
          .update({ google_event_id, gcal_sync_status, gcal_calendar_id: calendarIdUsado })
          .eq('id', apt.id)
          .eq('clinica_id', profile.clinica_id)
        if (errEstado) {
          registrarFalloGCal(
            { operacion: 'appointments.update(gcal_sync_status)', userId: profile.userId, conexionId: conexion.id, calendarId: calendarIdUsado },
            errEstado,
          )
        }
      })
    }

    // La escritura a Google corre en el after() de arriba, o sea DESPUÉS de
    // responder: aquí nunca se puede decir "sincronizado". Lo que sí se puede
    // decir es si hay con qué sincronizar, y son dos cosas muy distintas de
    // cara al médico: 'pending' es el caso normal y no pide nada de él;
    // 'disconnected' sí, alguien tiene que ir a conectar Google.
    //
    // El veredicto sale de la conexión YA RESUELTA arriba, sin una segunda
    // consulta, y la pregunta es por CLÍNICA: antes miraba si quien agendaba
    // tenía fila propia, así que a la secretaria le contestaba 'disconnected'
    // con la clínica perfectamente conectada.
    //
    // El `calendar_id` no entra en la cuenta a propósito: si falta y quien
    // agenda administra la clínica, `conCalendarioSpinus` lo crea en el mismo
    // after().
    return NextResponse.json({
      appointment: apt,
      gcalSync:    conexion ? 'pending' : 'disconnected',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
