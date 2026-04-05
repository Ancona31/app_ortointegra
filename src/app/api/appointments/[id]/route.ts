import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/encrypt'

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

    const { data: profile } = await supabase.from('profiles').select('clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json()
    const { title, start_time, end_time, paciente_id, notes, status, medico_id, updated_at: clientUpdatedAt } = body

    // ── Verificar ownership ──────────────────────────────────
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id, gcal_sync_status, updated_at')
      .eq('id', id)
      .eq('clinica_id', profile.clinica_id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    if (clientUpdatedAt && existing.updated_at !== clientUpdatedAt) {
      return NextResponse.json(
        { error: 'Esta cita fue modificada por otro usuario recientemente. Recarga para ver los cambios.' },
        { status: 409 }
      )
    }

    // ── Construir payload dinámico ───────────────────────────
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title       !== undefined) updates.title       = title
    if (start_time  !== undefined) updates.start_time  = start_time
    if (end_time    !== undefined) updates.end_time    = end_time
    if (paciente_id !== undefined) updates.paciente_id = paciente_id || null
    if (notes       !== undefined) updates.notes       = notes || null
    if (status      !== undefined) updates.status      = status
    if (medico_id   !== undefined) updates.medico_id   = medico_id || null

    const admin = createAdminClient()
    const { data: apt, error } = await admin
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Sincronizar con Google Calendar en background ──────
    const gcalFieldChanged = title !== undefined || start_time !== undefined || end_time !== undefined || notes !== undefined || status !== undefined
    if (existing.google_event_id && gcalFieldChanged) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      after(async () => {
        const STATUS_COLOR: Record<string, string | undefined> = {
          confirmed: '2',   // verde (sage)
          cancelled: '11',  // rojo (tomato)
          no_show:   '11',  // rojo
          completed: '8',   // gris (graphite)
        }
        let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
        try {
          const calendar = await getGCalClient(supabase, userId)
          if (calendar) {
            await calendar.events.patch({
              calendarId: 'primary',
              eventId:    gcalEventId,
              requestBody: {
                ...(title      !== undefined ? { summary:     title }                                               : {}),
                ...(notes      !== undefined ? { description: notes ?? '' }                                         : {}),
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
          console.error('[GCal background sync error]', gcalErr)
          gcal_sync_status = 'failed'
        }
        await admin.from('appointments').update({ gcal_sync_status }).eq('id', id)
      })
    }

    return NextResponse.json({ appointment: apt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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

    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id')
      .eq('id', id)
      .eq('clinica_id', profile.clinica_id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    const admin = createAdminClient()
    const { error } = await admin.from('appointments').delete().eq('id', id)
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
