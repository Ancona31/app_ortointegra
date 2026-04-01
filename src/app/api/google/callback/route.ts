import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encrypt'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const savedState = req.cookies.get('oauth_state')?.value

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=no_code', req.url))
  }

  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_state', req.url))
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expires_at: tokens.expiry_date ?? null,
    })

    const response = NextResponse.redirect(new URL('/dashboard?calendar=connected', req.url))
    response.cookies.delete('oauth_state')
    return response
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', req.url))
  }
}
