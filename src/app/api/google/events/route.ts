import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokenData) return NextResponse.json({ connected: false })

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expires_at,
    })

    // Refrescar token si expiró
    if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await supabase.from('google_tokens').update({
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ?? null,
      }).eq('user_id', user.id)
      oauth2Client.setCredentials(credentials)
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const ahora = new Date()
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const timeMin = fromParam ?? new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const timeMax = toParam ?? new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    })

    return NextResponse.json({ connected: true, events: data.items || [] })
  } catch {
    return NextResponse.json({ connected: false, error: 'Error al obtener eventos' })
  }
}
