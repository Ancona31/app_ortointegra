import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  // ESTA RUTA NO TENÍA NINGUNA AUTENTICACIÓN. Ni sesión, ni rol: un GET anónimo
  // devolvía el redirect a la pantalla de consentimiento de Google con el
  // client_id de Spinus y plantaba la cookie `oauth_state`. Lo que contenía el
  // daño era que el callback sí exige sesión antes de escribir.
  //
  // El gate que cuenta sigue siendo el del callback, que es donde se escribe el
  // renglón (plan §2.5); éste va por higiene, para no llevar a nadie a una
  // pantalla de Google que va a acabar en un error.
  //
  // SE RECHAZA POR REDIRECT, NO CON UN 403 JSON, y no es cosmética: el
  // disparador es un `<a href>` de /perfil, o sea navegación del navegador, y
  // un 403 con cuerpo JSON le pintaría el JSON crudo en la pantalla al médico.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  if (!canManageClinica(profile)) {
    return NextResponse.redirect(new URL('/perfil?gcal_error=solo_admin', req.url))
  }

  const state = randomBytes(16).toString('hex')

  // Esta ruta no tiene ningún catch que tape nada —no llama a Google, sólo
  // arma la URL—, pero sí un modo de fallar callado: sin estas variables la
  // URL sale con `client_id=undefined` y el médico ve un error de Google sin
  // que quede una sola línea del lado de Spinus.
  const faltantes = (['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const)
    .filter((v) => !process.env[v])
  if (faltantes.length > 0) {
    console.error('[GCal] fallo ' + JSON.stringify({
      operacion: 'oauth2.generateAuthUrl (connect)',
      mensaje:   `faltan variables de entorno: ${faltantes.join(', ')}`,
    }))
  }

  // Una instancia por petición: compartirla entre peticiones concurrentes
  // deja que un usuario sobrescriba las credenciales de otro.
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    // Scope NO sensible: sin verificación, sin tope de 100 usuarios y sin
    // pantalla de advertencia. Da CRUD sólo en calendarios que creó la app.
    //
    // Aquí había un segundo scope, `calendar.events.freebusy`, para pintar los
    // huecos del calendario PERSONAL de quien conectaba. Se retiró con la
    // función entera: bajo un calendario de clínica, esa consulta enseñaría la
    // disponibilidad personal del administrador a toda la clínica. Retirarlo
    // del consentimiento no afecta a quien ya conectó —su permiso concedido
    // sigue vivo—, sólo a los consentimientos nuevos.
    scope: [
      'https://www.googleapis.com/auth/calendar.app.created',
    ],
    prompt: 'consent',
    state,
  })

  const response = NextResponse.redirect(url)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutos
    path: '/',
  })
  return response
}
