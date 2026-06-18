import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/encrypt'

// PRIVACIDAD — LFPDPPP Art. 9: NUNCA enviar nombres de pacientes
// ni datos clínicos a Google Calendar.
function gcalSummary(title: string): string {
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

async function getGCalClient(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: tokenData } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (!tokenData) return null

  oauth2Client.setCredentials({
    access_token:  decrypt(tokenData.access_token),
    refresh_token: decrypt(tokenData.refresh_token),
    expiry_date:   tokenData.expires_at,
  })
  if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await supabase.from('google_tokens').update({
      access_token: credentials.access_token ? encrypt(credentials.access_token) : null,
      expires_at:   credentials.expiry_date ?? null,
    }).eq('user_id', userId)
    oauth2Client.setCredentials(credentials)
  }
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

/* ── PUT /api/appointments/[id] ─────────────────────────── */
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/appointments/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id, role, es_admin_de_clinica').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json()
    const { title, start_time, end_time, paciente_id, notes, status, medico_id, consultorio_id, updated_at: clientUpdatedAt } = body

    // RLS filtra por clinica_id
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id, gcal_sync_status, updated_at, medico_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    if (clientUpdatedAt && existing.updated_at !== clientUpdatedAt) {
      return NextResponse.json(
        { error: 'Esta cita fue modificada por otro usuario recientemente. Recarga para ver los cambios.' },
        { status: 409 }
      )
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title       !== undefined) updates.title       = title
    if (start_time  !== undefined) updates.start_time  = start_time
    if (end_time    !== undefined) updates.end_time    = end_time
    if (paciente_id !== undefined) updates.paciente_id = paciente_id || null
    if (notes       !== undefined) updates.notes       = notes || null
    if (status      !== undefined) updates.status      = status
    // 5.H Paso 1: Validar cambio de medico_id según rol (D-5.H-3).
    // Médico invitado NO puede transferir su cita a otro médico (defense in depth
    // con la policy de Paso 3; mensaje claro al usuario en lugar de RLS 42501).
    if (medico_id !== undefined) {
      const esMedicoInvitado = profile.role === 'medico' && !profile.es_admin_de_clinica
      const esAdminOSecretaria = (profile.role === 'medico' && profile.es_admin_de_clinica) || profile.role === 'secretaria'

      if (esMedicoInvitado) {
        // Médico invitado: solo puede mantener su propio UUID
        if (medico_id !== null && medico_id !== profile.id) {
          return NextResponse.json(
            { error: 'forbidden_transfer', message: 'No puedes transferir tu cita a otro médico.' },
            { status: 403 }
          )
        }
        updates.medico_id = profile.id
      } else if (esAdminOSecretaria) {
        // Admin/secretaria: medico_id es obligatorio, validar pertenencia a clínica
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
        updates.medico_id = medico_id
      } else {
        return NextResponse.json(
          { error: 'forbidden', message: 'Tu rol no puede modificar citas.' },
          { status: 403 }
        )
      }
    }

    // Fase 2.6: snapshot de consultorio.
    // Si el cliente está cambiando medico_id (admin/secretaria), DEBE enviar
    // consultorio_id también — el consultorio del médico viejo no es válido
    // para el médico nuevo. Esto preserva el invariante "consultorio pertenece
    // al médico de la cita" que el POST garantiza.
    const cambiaMedico =
      updates.medico_id !== undefined &&
      updates.medico_id !== existing.medico_id

    if (cambiaMedico && consultorio_id === undefined) {
      return NextResponse.json(
        {
          error: 'consultorio_id_required',
          message: 'Al cambiar de médico, debes seleccionar el consultorio del nuevo médico.',
        },
        { status: 400 }
      )
    }

    // Si el cliente envía consultorio_id, validar y actualizar snapshot.
    // Si NO viene Y el médico no cambia, la cita conserva su snapshot actual.
    if (consultorio_id !== undefined) {
      // null o string vacío → rechazar (N3).
      if (consultorio_id === null || consultorio_id === '') {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'consultorio_id no puede ser nulo o vacío. Si no quieres cambiar el consultorio, omite el campo.' },
          { status: 400 }
        )
      }

      // Validar formato UUID.
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(consultorio_id)) {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'consultorio_id no tiene formato UUID válido.' },
          { status: 400 }
        )
      }

      // Determinar el medico_id efectivo del dueño de la cita después del UPDATE.
      // Si el cliente está cambiando medico_id, usar el nuevo; si no, el actual de BD.
      const medicoIdEfectivo = (updates.medico_id as string | undefined) ?? existing.medico_id

      if (!medicoIdEfectivo) {
        return NextResponse.json(
          { error: 'cita_sin_medico', message: 'La cita no tiene médico asignado. No se puede asignar consultorio.' },
          { status: 400 }
        )
      }

      // Cargar consultorio y validar ownership/activo.
      // F3-6a+c.1: validar consultorio con admin client (espejo del POST).
      // Tras la migración 06 (RLS consultorios owner-only), un admin de
      // clínica NO ve los consultorios de invitados vía RLS. medicoIdEfectivo
      // ya quedó validado contra la clínica del caller (rama de cambio de
      // médico L101-122 o vía RLS de appointments L63-67), así que el bypass
      // de RLS es seguro. Defensa en profundidad: filtramos por clinica_id.
      const adminConsultorio = createAdminClient()
      const { data: consultorio, error: errConsultorio } = await adminConsultorio
        .from('consultorios')
        .select('id, nombre, nombre_corto, direccion, telefono, timezone')
        .eq('id', consultorio_id)
        .eq('medico_id', medicoIdEfectivo)
        .eq('clinica_id', profile.clinica_id)
        .eq('activo', true)
        .maybeSingle()

      if (errConsultorio) {
        console.error('[PUT /api/appointments/[id]] error cargando consultorio:', errConsultorio)
        return NextResponse.json({ error: errConsultorio.message }, { status: 500 })
      }
      if (!consultorio) {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'El consultorio no existe, está archivado, o no pertenece al médico de la cita.' },
          { status: 400 }
        )
      }

      // Agregar los 6 campos snapshot al updates.
      updates.consultorio_id            = consultorio.id
      updates.consultorio_nombre        = consultorio.nombre
      updates.consultorio_nombre_corto  = consultorio.nombre_corto
      updates.consultorio_direccion     = consultorio.direccion
      updates.consultorio_telefono      = consultorio.telefono
      updates.consultorio_timezone      = consultorio.timezone
    }

    // RLS filtra por clinica_id
    const { data: apt, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Google Calendar sync en background — necesita admin porque after() no tiene contexto de cookies
    const gcalFieldChanged = title !== undefined || start_time !== undefined || end_time !== undefined || notes !== undefined || status !== undefined
    if (existing.google_event_id && gcalFieldChanged) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      const admin = createAdminClient()
      after(async () => {
        const STATUS_COLOR: Record<string, string | undefined> = {
          confirmed: '2',
          cancelled: '11',
          no_show:   '11',
          completed: '8',
        }
        let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
        try {
          const calendar = await getGCalClient(supabase, userId)
          if (calendar) {
            await calendar.events.patch({
              calendarId: 'primary',
              eventId:    gcalEventId,
              requestBody: {
                ...(title      !== undefined ? { summary: gcalSummary(title) }                                      : {}),
                // NO enviar notes/descripción a Google — puede contener datos clínicos
                ...(start_time !== undefined ? { start: { dateTime: start_time, timeZone: 'America/Mexico_City' } } : {}),
                ...(end_time   !== undefined ? { end:   { dateTime: end_time,   timeZone: 'America/Mexico_City' } } : {}),
                ...(status     !== undefined && STATUS_COLOR[status] ? { colorId: STATUS_COLOR[status] }            : {}),
              },
            })
            gcal_sync_status = 'synced'
          } else {
            gcal_sync_status = 'synced'
          }
        } catch (gcalErr) {
          console.error('[GCal] Error de sincronización en background')
          gcal_sync_status = 'failed'
        }
        await admin.from('appointments').update({ gcal_sync_status }).eq('id', id)
      })
    }

    return NextResponse.json({ appointment: apt })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── DELETE /api/appointments/[id] ──────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/appointments/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params

    // RLS filtra por clinica_id
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id')
      .eq('id', id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existing.google_event_id) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      after(async () => {
        try {
          const calendar = await getGCalClient(supabase, userId)
          if (calendar) {
            await calendar.events.delete({ calendarId: 'primary', eventId: gcalEventId })
          }
        } catch { /* GCal delete es best-effort */ }
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
