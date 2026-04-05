import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/encrypt'

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
    .select('id, clinica_id, role')
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

    let query = supabase
      .from('appointments')
      .select('*, pacientes(id, nombre, apellidos, telefono), medico:profiles!appointments_medico_id_fkey(id, nombre, titulo)')
      .eq('clinica_id', profile.clinica_id)
      .order('start_time', { ascending: true })

    if (medicoFilter) query = query.eq('medico_id', medicoFilter)

    if (from) query = query.gte('start_time', from)
    if (to)   query = query.lte('start_time', to)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ appointments: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── POST /api/appointments ─────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { title, start_time, end_time, paciente_id, notes, medico_id } = body

    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: apt, error } = await admin
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
        medico_id:        medico_id || null,
        gcal_sync_status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sincronizar con Google Calendar — fallo no bloquea, queda como 'pending' para reintento
    let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
    let google_event_id: string | null = null

    try {
      const { data: tokenData } = await supabase
        .from('google_tokens')
        .select('*')
        .eq('user_id', profile.userId)
        .single()

      if (tokenData) {
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
          }).eq('user_id', profile.userId)
          oauth2Client.setCredentials(credentials)
        }

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
        const { data: gEvent } = await calendar.events.insert({
          calendarId:  'primary',
          requestBody: {
            summary:     title,
            description: notes ?? undefined,
            start: { dateTime: start_time, timeZone: 'America/Mexico_City' },
            end:   { dateTime: end_time,   timeZone: 'America/Mexico_City' },
          },
        })
        google_event_id  = gEvent.id ?? null
        gcal_sync_status = 'synced'
      } else {
        // Sin Google Calendar conectado — no hay nada que sincronizar
        gcal_sync_status = 'synced'
      }
    } catch (gcalErr) {
      console.error('[GCal sync error]', gcalErr)
      gcal_sync_status = 'failed'
    }

    await admin
      .from('appointments')
      .update({ google_event_id, gcal_sync_status })
      .eq('id', apt.id)

    return NextResponse.json({
      appointment: { ...apt, google_event_id, gcal_sync_status },
      gcalSynced:  gcal_sync_status === 'synced',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
