import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encrypt'
import { crearCalendarioSpinus, calendarioVive, registrarFalloGCal } from '@/lib/gcal'

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

  // Se resuelve dentro del try, pero el catch de afuera lo necesita: si lo que
  // revienta es `getToken`, todavía no hay sesión que consultar.
  let userId = 'sin-sesion'

  try {
    // Una instancia por petición: compartirla entre peticiones concurrentes
    // deja que un usuario sobrescriba las credenciales de otro.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)
    // `getToken` NO deja las credenciales puestas en el cliente: devuelve los
    // tokens y nada más. Sin este `setCredentials`, el cliente de Calendar que
    // se construye abajo sale sin autenticar y `calendars.insert` revienta
    // antes de salir a la red ("No access, refresh token, API key or refresh
    // handler callback is set") — que es exactamente cómo `calendar_id` se
    // quedaba en null sin que nadie se enterara.
    oauth2Client.setCredentials(tokens)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    userId = user.id

    // CONSENTIMIENTO GRANULAR — Google presenta los permisos con casillas
    // individuales. Un médico puede desmarcar la de crear calendarios y darle
    // Continuar: quedaría conectado pero sin poder crear nada, y fallaría más
    // tarde con un error opaco. La respuesta del token trae los permisos
    // realmente concedidos; si falta el imprescindible, no se guarda nada.
    const CALENDARIO_PROPIO = 'https://www.googleapis.com/auth/calendar.app.created'
    if (!(tokens.scope ?? '').split(' ').includes(CALENDARIO_PROPIO)) {
      const denegado = NextResponse.redirect(new URL('/perfil?gcal_error=permiso_calendario', req.url))
      denegado.cookies.delete('oauth_state')
      return denegado
    }

    const { error: errTokens } = await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expires_at: tokens.expiry_date ?? null,
    })
    // Sin fila de tokens no hay conexión ni dónde guardar el calendario: no
    // vale la pena crear uno para tener que borrarlo un renglón más abajo.
    if (errTokens) {
      registrarFalloGCal({ operacion: 'google_tokens.upsert', userId: user.id }, errTokens)
      const fallo = NextResponse.redirect(new URL('/dashboard?error=oauth_failed', req.url))
      fallo.cookies.delete('oauth_state')
      return fallo
    }

    // El calendario propio de Spinus. Si falla, los tokens quedan guardados y
    // `calendar_id` en null: `conCalendarioSpinus` lo crea en la primera
    // operación. No vale la pena tumbar la conexión entera por esto.
    try {
      const gcal = google.calendar({ version: 'v3', auth: oauth2Client })

      // RECONECTAR NO DEBE CREAR UN SEGUNDO CALENDARIO. El `upsert` de arriba
      // no toca `calendar_id`, así que el de antes sigue ahí; crear otro lo
      // pisaría y dejaría el anterior huérfano en la cuenta del médico, sin
      // registro en ninguna parte — el mismo estropicio que este archivo
      // acaba de dejar de causar, entrando por otra puerta.
      //
      // El camino que llevaba aquí —los GET de Google respondían
      // `connected: false` ante un fallo pasajero y el perfil le pintaba
      // "Conectar" a un médico que ya lo estaba— quedó cerrado: ahora
      // contestan 'error_google' y el perfil no ofrece reconectar. La guarda
      // se queda igual: sigue habiendo reconexiones legítimas.
      //
      // `calendarioVive` contesta "vive" ante cualquier error que no sea 404,
      // que es justo lo que conviene: si no se puede comprobar, no se crea.
      const { data: fila } = await supabase
        .from('google_tokens')
        .select('calendar_id')
        .eq('user_id', user.id)
        .maybeSingle<{ calendar_id: string | null }>()
      const yaRegistrado = fila?.calendar_id ?? null

      // `yaRegistrado` como valor esperado, no null: si llegamos aquí con un
      // id no nulo es porque ese calendario ya no existe y hay que reemplazar
      // ESE. Con null, el comparar-y-cambiar no prendería y se adoptaría el id
      // muerto como bueno.
      if (!yaRegistrado || !(await calendarioVive(gcal, yaRegistrado, user.id))) {
        await crearCalendarioSpinus(supabase, user.id, gcal, yaRegistrado)
      }
    } catch (err) {
      registrarFalloGCal({ operacion: 'calendars.insert (callback)', userId: user.id }, err)
    }

    const response = NextResponse.redirect(new URL('/dashboard?calendar=connected', req.url))
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    // Aquí caen `getToken` (código caducado, redirect_uri que no cuadra,
    // cliente OAuth revocado) y cualquier otro fallo del intercambio. Hasta
    // hoy se iba entero al redirect sin dejar una línea.
    registrarFalloGCal({ operacion: 'oauth2.getToken (callback)', userId }, err)
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', req.url))
  }
}
