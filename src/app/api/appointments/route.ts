import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, registrarFalloGCal, GCAL_TIMEZONE } from '@/lib/gcal'
import { APPOINTMENT_SELECT, eventoParaGoogle, type ClinicaEnCita, type PacienteEnCita } from '@/lib/appointments'

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
    const { title, start_time, end_time, paciente_id, notes, medico_id, consultorio_id } = body

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Google Calendar sync en background con el cliente admin.
    //
    // Este comentario decía "porque after() no tiene contexto de cookies" y era
    // FALSO: `after()` conserva el contexto de la petición y la RLS funciona
    // ahí con normalidad (comprobado en producción el 2026-08-16). El motivo
    // real es a quién se le lee el token: `conCalendarioSpinus` recibe el id de
    // quien ejecuta la acción y la RLS de `google_tokens` sólo deja leer
    // `user_id = auth.uid()`, así que el cliente admin es el prerrequisito para
    // leerle el token a otro usuario. Ver el comentario largo del PUT en
    // appointments/[id]/route.ts.
    const admin = createAdminClient()
    // El titulo del evento sale del paciente ligado; si la cita no tiene
    // paciente, del titulo libre de la cita.
    const pacienteCita: PacienteEnCita = apt.pacientes ?? null
    const clinicaCita:  ClinicaEnCita  = apt.clinicas  ?? null
    after(async () => {
      let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
      let google_event_id: string | null = null
      let calendarIdUsado: string | null = null

      try {
        // La descripción lleva un formato fijo (clínica y paciente) y NADA
        // clínico: ni notes, ni motivo de consulta, ni diagnóstico.
        const { summary, description, reminders } = eventoParaGoogle(pacienteCita, clinicaCita, title)
        const creado = await conCalendarioSpinus(admin, profile.userId, (calendar, calendarId) => {
          calendarIdUsado = calendarId
          return calendar.events.insert({
            calendarId,
            requestBody: {
              summary,
              description,
              // Sólo al crear: si el médico le cambia el recordatorio a mano en
              // Google, ninguna edición posterior desde Spinus se lo reimpone.
              reminders,
              start: { dateTime: start_time, timeZone: GCAL_TIMEZONE },
              end:   { dateTime: end_time,   timeZone: GCAL_TIMEZONE },
            },
          })
        })
        // creado === null → el médico no tiene Google conectado: nada que sincronizar.
        google_event_id  = creado?.data.id ?? null
        gcal_sync_status = 'synced'
      } catch (gcalErr) {
        // Corre dentro de after(): nadie ve el fallo del lado del cliente y la
        // cita se queda en 'failed' sin más pista que esta línea.
        registrarFalloGCal(
          { operacion: 'events.insert (alta de cita)', userId: profile.userId, calendarId: calendarIdUsado },
          gcalErr,
        )
        gcal_sync_status = 'failed'
      }

      // `clinica_id` no es decorativo aunque `id` sea la clave primaria: con el
      // cliente admin la RLS no acota nada. Mismo criterio que el `after()` del
      // PUT en appointments/[id]/route.ts.
      const { error: errEstado } = await admin
        .from('appointments')
        .update({ google_event_id, gcal_sync_status })
        .eq('id', apt.id)
        .eq('clinica_id', profile.clinica_id)
      if (errEstado) {
        registrarFalloGCal(
          { operacion: 'appointments.update(gcal_sync_status)', userId: profile.userId, calendarId: calendarIdUsado },
          errEstado,
        )
      }
    })

    // La escritura a Google corre en el after() de arriba, o sea DESPUÉS de
    // responder: aquí nunca se puede decir "sincronizado". Lo que sí se puede
    // decir es si hay con qué sincronizar, y son dos cosas muy distintas de
    // cara al médico: 'pending' es el caso normal y no pide nada de él;
    // 'disconnected' sí, tiene que ir a conectar Google.
    //
    // El `calendar_id` no entra en la cuenta a propósito: si falta,
    // `conCalendarioSpinus` lo crea dentro del mismo after(). Sin fila en
    // `google_tokens` no hay nada que pueda crearlo.
    const { data: tokenGoogle } = await supabase
      .from('google_tokens')
      .select('user_id')
      .eq('user_id', profile.userId)
      .maybeSingle()

    return NextResponse.json({
      appointment: apt,
      gcalSync:    tokenGoogle ? 'pending' : 'disconnected',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
