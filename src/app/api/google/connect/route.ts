import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function GET() {
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
    // Ambos scopes son NO sensibles: sin verificación, sin tope de 100
    // usuarios y sin pantalla de advertencia.
    //   calendar.app.created      → CRUD sólo en calendarios que creó la app.
    //   calendar.events.freebusy  → disponibilidad de `primary`, sin títulos.
    scope: [
      'https://www.googleapis.com/auth/calendar.app.created',
      'https://www.googleapis.com/auth/calendar.events.freebusy',
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
