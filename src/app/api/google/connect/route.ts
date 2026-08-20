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
    // LOS TRES SCOPES SON NO SENSIBLES, y eso es requisito, no un detalle: en
    // cuanto uno solo fuera sensible o restringido, esta app volvería a
    // necesitar verificación y estrenaría el tope de 100 usuarios nuevos —un
    // contador que NO se puede restablecer nunca (plan §12.11)—.
    //
    // Comprobado en Google Cloud Console → Acceso a los datos el 2026-08-20:
    // los tres aparecen bajo «Tus permisos no sensibles», y los bloques de
    // sensibles y restringidos están vacíos. Si añades uno más, míralo AHÍ
    // antes de escribirlo aquí; la clasificación es de Google y no se deduce
    // del nombre del scope.
    //
    //   · calendar.app.created → CRUD sólo en calendarios que creó la app.
    //   · openid + userinfo.email → SÓLO para saber QUÉ cuenta de Google se
    //     conectó (`google_account_sub` y `google_account_email`). Sin ellos,
    //     un 404 sobre el calendario no se puede distinguir entre «lo
    //     borraron» y «reconectaron con otra cuenta», que piden respuestas
    //     opuestas. No dan acceso a nada más.
    //
    // `userinfo.email` va en su forma larga a propósito, aunque `email` sea su
    // alias corto y válido: es la forma que Google devuelve en `tokens.scope` y
    // la que aparece registrada en la consola. Ver la trampa que esto tiene en
    // el callback, junto al chequeo de consentimiento granular.
    //
    // Aquí había un cuarto scope, `calendar.events.freebusy`, para pintar los
    // huecos del calendario PERSONAL de quien conectaba. Se retiró con la
    // función entera: bajo un calendario de clínica, esa consulta enseñaría la
    // disponibilidad personal del administrador a toda la clínica. Retirarlo
    // del consentimiento no afecta a quien ya conectó —su permiso concedido
    // sigue vivo—, sólo a los consentimientos nuevos. También se retiró de la
    // lista de la consola, que seguía anunciándolo.
    scope: [
      'https://www.googleapis.com/auth/calendar.app.created',
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
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
