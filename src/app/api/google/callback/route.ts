import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encrypt'
import { crearCalendarioSpinus } from '@/lib/gcal'

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
    // Una instancia por petición: compartirla entre peticiones concurrentes
    // deja que un usuario sobrescriba las credenciales de otro.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // CONSENTIMIENTO GRANULAR — Google presenta los permisos con casillas
    // individuales. Un médico puede desmarcar la de crear calendarios y darle
    // Continuar: quedaría conectado pero sin poder crear nada, y fallaría más
    // tarde con un error opaco. La respuesta del token trae los permisos
    // realmente concedidos; si falta el imprescindible, no se guarda nada.
    //
    // `calendar.events.freebusy` NO se exige: sin él sólo se pierden los
    // bloques de "Ocupado" del calendario personal, y la sincronización de
    // citas —que es el punto— sigue funcionando entera.
    const CALENDARIO_PROPIO = 'https://www.googleapis.com/auth/calendar.app.created'
    if (!(tokens.scope ?? '').split(' ').includes(CALENDARIO_PROPIO)) {
      const denegado = NextResponse.redirect(new URL('/perfil?gcal_error=permiso_calendario', req.url))
      denegado.cookies.delete('oauth_state')
      return denegado
    }

    await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expires_at: tokens.expiry_date ?? null,
    })

    // El calendario propio de Spinus. Si falla, los tokens quedan guardados y
    // `calendar_id` en null: `conCalendarioSpinus` lo crea en la primera
    // operación. No vale la pena tumbar la conexión entera por esto.
    try {
      await crearCalendarioSpinus(
        supabase,
        user.id,
        google.calendar({ version: 'v3', auth: oauth2Client }),
      )
    } catch {
      console.error('[GCal] No se pudo crear el calendario de Spinus en el callback')
    }

    const response = NextResponse.redirect(new URL('/dashboard?calendar=connected', req.url))
    response.cookies.delete('oauth_state')
    return response
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', req.url))
  }
}
