import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { altaConexion, resolverConexionClinica, type ErrorAlta } from '@/lib/gcalConexion'
import { crearCalendarioSpinus, calendarioVive, registrarFalloGCal } from '@/lib/gcal'

/**
 * A dónde se manda al médico según qué contestó `alta_conexion_google`.
 *
 * Los cinco errores tienen nombre y el tipo obliga a cubrirlos todos. El plan
 * §2.5 sólo asignaba destino a dos —los dos que el médico puede resolver por sí
 * mismo—; los otros tres son anomalías que no sabe arreglar, así que comparten
 * un destino genérico y se distinguen en el log.
 */
function destinoDeErrorAlta(error: ErrorAlta): string {
  switch (error) {
    // Otra cuenta de Google ya es la de esta clínica. NO se degrada a 'personal'
    // en silencio: el relevo de administrador es un flujo consciente.
    case 'clinica_ya_conectada':
      return '/perfil?gcal_error=clinica_ya_conectada'
    // Esta cuenta ya tenía una conexión 'personal' y reconectar NO la promueve.
    // Sin este aviso, la clínica se quedaría con cero conexiones de clínica y
    // las citas dejarían de sincronizarse sin que nadie se enterara.
    case 'rol_no_promovido':
      return '/perfil?gcal_error=rol_no_promovido'
    default:
      return '/perfil?gcal_error=alta_fallida'
  }
}

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

    // SÓLO EL ADMINISTRADOR CONECTA GOOGLE (plan §2.5 y §12.3). Éste es el gate
    // que cuenta —el de /api/google/connect va por higiene—, porque aquí es
    // donde se escribe el renglón. Sin él, un médico invitado crearía una
    // conexión que no sirve para nada y confunde el estado de la clínica.
    //
    // El intercambio del código ya ocurrió arriba: a un no-administrador se le
    // rechaza con el código quemado, que es inocuo (es de un solo uso y no se
    // escribió nada).
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (!canManageClinica(profile) || !profile?.clinica_id) {
      const denegado = NextResponse.redirect(new URL('/perfil?gcal_error=solo_admin', req.url))
      denegado.cookies.delete('oauth_state')
      return denegado
    }
    const clinicaId: string = profile.clinica_id

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

    // Sin access token no hay nada que dar de alta. Se corta ANTES de llamar al
    // módulo, que lo exige no nulo a propósito: una conexión sin token es la
    // anomalía que el puente existe para hacer imposible.
    if (!tokens.access_token) {
      registrarFalloGCal(
        { operacion: 'oauth2.getToken (sin access_token)', userId: user.id },
        new Error('Google no devolvió access_token'),
      )
      const fallo = NextResponse.redirect(new URL('/perfil?gcal_error=alta_fallida', req.url))
      fallo.cookies.delete('oauth_state')
      return fallo
    }

    // UNA SOLA LLAMADA: metadata y secretos entran en la misma transacción
    // dentro del RPC, así que no puede nacer una conexión sin tokens. Antes
    // esto era un upsert sobre `google_tokens` por usuario — el modelo que esta
    // rama sustituye.
    const alta = await altaConexion({
      userId:    user.id,
      clinicaId,
      rol:       'clinica',
      cuenta:    { sub: null, email: null },   // los puebla el commit 4, con los scopes openid/email
      tokens: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt:    tokens.expiry_date ?? null,
      },
    })

    if (!alta.ok) {
      const fallo = NextResponse.redirect(new URL(destinoDeErrorAlta(alta.error), req.url))
      fallo.cookies.delete('oauth_state')
      return fallo
    }

    // El calendario propio de Spinus. Si falla, los tokens quedan guardados y
    // `calendar_id` en null: `conCalendarioSpinus` lo crea en la primera
    // operación. No vale la pena tumbar la conexión entera por esto.
    try {
      const gcal = google.calendar({ version: 'v3', auth: oauth2Client })

      // RECONECTAR NO DEBE CREAR UN SEGUNDO CALENDARIO. El alta de arriba no
      // toca `calendar_id` al reconectar la misma cuenta, así que el de antes
      // sigue ahí; crear otro lo pisaría y dejaría el anterior huérfano en la
      // cuenta de Google, sin registro en ninguna parte — el mismo estropicio
      // que este archivo acaba de dejar de causar, entrando por otra puerta.
      //
      // El camino que llevaba aquí —los GET de Google respondían
      // `connected: false` ante un fallo pasajero y el perfil le pintaba
      // "Conectar" a un médico que ya lo estaba— quedó cerrado: ahora
      // contestan 'error_google' y el perfil no ofrece reconectar. La guarda
      // se queda igual: sigue habiendo reconexiones legítimas.
      //
      // `calendarioVive` contesta "vive" ante cualquier error que no sea 404,
      // que es justo lo que conviene: si no se puede comprobar, no se crea.
      // El `calendar_id` sale del descriptor que acaba de devolver el alta: el
      // RPC ya lo trae, así que no hace falta una segunda consulta.
      const yaRegistrado = alta.alta.calendarId

      // La conexión completa, para pasársela al creador. Se resuelve con el
      // cliente de sesión, aquí todavía dentro de la petición.
      const conexion = await resolverConexionClinica(supabase, clinicaId)

      // `yaRegistrado` como valor esperado, no null: si llegamos aquí con un
      // id no nulo es porque ese calendario ya no existe y hay que reemplazar
      // ESE. Con null, el comparar-y-cambiar no prendería y se adoptaría el id
      // muerto como bueno.
      if (conexion && (!yaRegistrado || !(await calendarioVive(gcal, yaRegistrado, user.id)))) {
        await crearCalendarioSpinus(
          conexion, createAdminClient(), gcal, { esperado: yaRegistrado, actorId: user.id },
        )
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
