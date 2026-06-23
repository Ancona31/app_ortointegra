import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/encrypt'

// PRIVACIDAD — LFPDPPP Art. 9: los datos de salud son sensibles.
// Google Calendar es un servicio externo — NUNCA enviar nombres de
// pacientes ni datos clínicos. Solo "Cita médica" + iniciales como máximo.
function gcalSummary(title: string): string {
  // Extraer iniciales si el título parece un nombre (2+ palabras capitalizadas)
  const words = title.trim().split(/\s+/)
  if (words.length >= 2 && words.every(w => /^[A-ZÁÉÍÓÚÑ]/.test(w))) {
    const iniciales = words.map(w => w[0]).join('').toUpperCase()
    return `Cita médica (${iniciales})`
  }
  return 'Cita médica'
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

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
      .select('*, pacientes(id, nombre, apellidos, telefono), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)')
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
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Google Calendar sync en background — necesita admin porque after() no tiene contexto de cookies
    const admin = createAdminClient()
    after(async () => {
      let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
      let google_event_id: string | null = null

      try {
        const { data: tokenData } = await admin
          .from('google_tokens')
          .select('*')
          .eq('user_id', profile.userId)
          .single()

        if (tokenData) {
          const bgOauth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          )
          bgOauth.setCredentials({
            access_token:  decrypt(tokenData.access_token),
            refresh_token: decrypt(tokenData.refresh_token),
            expiry_date:   tokenData.expires_at,
          })
          if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
            const { credentials } = await bgOauth.refreshAccessToken()
            await admin.from('google_tokens').update({
              access_token: credentials.access_token ? encrypt(credentials.access_token) : null,
              expires_at:   credentials.expiry_date ?? null,
            }).eq('user_id', profile.userId)
            bgOauth.setCredentials(credentials)
          }

          const calendar = google.calendar({ version: 'v3', auth: bgOauth })
          const { data: gEvent } = await calendar.events.insert({
            calendarId:  'primary',
            requestBody: {
              summary: gcalSummary(title),
              // NO enviar notes/descripción a Google — puede contener datos clínicos
              start: { dateTime: start_time, timeZone: 'America/Mexico_City' },
              end:   { dateTime: end_time,   timeZone: 'America/Mexico_City' },
            },
          })
          google_event_id  = gEvent.id ?? null
          gcal_sync_status = 'synced'
        } else {
          gcal_sync_status = 'synced'
        }
      } catch (gcalErr) {
        console.error('[GCal] Error de sincronización en background')
        gcal_sync_status = 'failed'
      }

      await admin
        .from('appointments')
        .update({ google_event_id, gcal_sync_status })
        .eq('id', apt.id)
    })

    return NextResponse.json({
      appointment: apt,
      gcalSynced:  false,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
