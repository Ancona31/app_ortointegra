import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { altaConexion, resolverConexionClinica, type ErrorAlta } from '@/lib/gcalConexion'
import { logAudit } from '@/lib/audit'
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
    // Esa cuenta de Google ya está enlazada a OTRO usuario de Spinus. Lo
    // detecta el módulo, no el RPC; antes de poblar la identidad no podía
    // ocurrir. La salida es del médico: usar otra cuenta, o desconectarla
    // desde el usuario que la tiene.
    case 'cuenta_ya_vinculada':
      return '/perfil?gcal_error=cuenta_ya_vinculada'
    default:
      return '/perfil?gcal_error=alta_fallida'
  }
}

/**
 * Qué cuenta de Google se acaba de conectar: el `sub` (identificador estable) y
 * el correo, para `google_account_sub` y `google_account_email`.
 *
 * NO HACE FALTA LLAMAR A `userinfo`. Con `openid` en el consentimiento, el
 * propio intercambio del código devuelve un `id_token` con las dos cosas
 * dentro, así que esto no cuesta una vuelta más a la red por la identidad.
 *
 * SE VERIFICA LA FIRMA aunque la documentación de Google diga que no hace
 * falta cuando el intercambio es servidor-a-Google sobre HTTPS autenticando con
 * el client secret —que es exactamente nuestro caso—. Se verifica igual porque
 * la alternativa es decodificar a mano el segundo segmento de un JWT dentro de
 * un camino de redirect, y eso es cómo se cuela un `atob` sin comprobar nada.
 *
 * DEVOLVER `{ null, null }` NO ES UN FALLO Y NO ABORTA NADA. Esas dos columnas
 * significan «no se sabe qué cuenta es», nunca «conexión defectuosa»: hay
 * conexiones en producción que las tienen en NULL y siguen sincronizando
 * perfectamente. Tumbar una conexión buena porque no se pudo leer su identidad
 * sería cambiar un dato de diagnóstico por el servicio entero.
 *
 * `sub` es obligatorio en el payload; `email` es OPCIONAL y puede faltar. Si
 * falta, va NULL — el `COALESCE` del RPC entiende NULL como «no lo toques».
 *
 * `email_verified` viene en el payload y NO se usa, y no es un olvido: el
 * identificador estable es `sub`, y el correo es informativo (para que el
 * médico vea a qué cuenta está enganchada su clínica). Lo dice ya el COMMENT de
 * la columna en `20260817_gcal_conexion_clinica_a_esquema.sql`.
 */
async function identidadDeGoogle(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  idToken: string | null | undefined,
  userId: string,
): Promise<{ sub: string | null; email: string | null }> {
  if (!idToken) return { sub: null, email: null }

  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    return { sub: payload?.sub ?? null, email: payload?.email ?? null }
  } catch (err) {
    registrarFalloGCal({ operacion: 'verifyIdToken (identidad de la cuenta)', userId }, err)
    return { sub: null, email: null }
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
    //
    // ⚠ ESTE CHEQUEO NO SE AMPLÍA A `openid` NI A `email`, Y NO ES UN OLVIDO.
    // El único permiso imprescindible es el del calendario: sin él no hay
    // sincronización que valga. Sin identidad sí la hay — sólo se pierde poder
    // decir de qué cuenta es, que es un dato de diagnóstico. Exigirlos aquí
    // convertiría una conexión que funciona en un rechazo.
    //
    // Y si alguien lo amplía de todas formas, la trampa: Google devuelve `email`
    // EXPANDIDO como `https://www.googleapis.com/auth/userinfo.email`, no como
    // el literal corto que se pide en /connect. Un `includes('email')` sobre
    // `tokens.scope` rechazaría conexiones perfectamente buenas.
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
    //
    // `cuenta` puede llegar con las dos mitades en null, y eso es NORMAL, no un
    // fallo: significa «no se sabe qué cuenta de Google es». Ocurre si el
    // `id_token` no viene o no verifica, y le pasa además a toda conexión
    // anterior a este commit — se decidió CONVIVIR con ellas en vez de forzar
    // reconexiones, así que nada aguas abajo puede romperse ni degradarse por
    // eso. Se irán poblando solas conforme la gente reconecte.
    const alta = await altaConexion({
      userId:    user.id,
      clinicaId,
      rol:       'clinica',
      cuenta:    await identidadDeGoogle(oauth2Client, tokens.id_token, user.id),
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

    /* QUIÉN APUNTÓ ESTA CLÍNICA A QUÉ CUENTA DE GOOGLE, Y CUÁNDO. Hasta hoy
       conectar no dejaba ni una línea, y `clinica_conexiones_google` no tiene
       trigger de auditoría, así que esto es todo el rastro que hay.

       VA AQUÍ Y NO DESPUÉS DEL CALENDARIO, a propósito: si la creación de abajo
       falla, la conexión existe igual —el alta ya está escrita— y esta entrada
       sigue siendo cierta. Colgarla del final registraría de menos.

       EL `await` NO ES DECORATIVO Y NO SE QUITA. `logAudit` es `async` y su
       `try/catch` interno sólo garantiza que NO LANZA, no que termine: sin
       esperarla, el `insert` sigue en vuelo cuando esta función devuelve el
       redirect y en Vercel la lambda puede congelarse ahí. Se perdería a veces,
       que es lo peor que le puede pasar a una auditoría. Esperar no añade
       ninguna rama de fallo nueva, y esto es un redirect tras una vuelta entera
       de OAuth: el viaje extra no se nota.

       ⚠ NI EL CORREO DE GOOGLE NI EL NOMBRE DEL CALENDARIO ENTRAN EN LA
       DESCRIPCIÓN. El porqué está escrito una sola vez, junto a la acción en
       `src/lib/audit.ts`; léelo antes de añadir nada aquí.

       `calendarioPrevio` NO AFIRMA «RECONEXIÓN», y la distinción importa: el
       RPC `alta_conexion_google` hace `ON CONFLICT DO UPDATE` y devuelve lo
       mismo tanto si insertó como si actualizó, así que «alta o reconexión» no
       es derivable de lo que tenemos. Lo que sí es un hecho: NO NULO prueba
       reconexión —un alta nueva nunca trae `calendar_id`, el INSERT del RPC no
       lo escribe—; NULL no distingue un alta nueva de una reconexión cuyo
       calendario nunca llegó a crearse. Se registra el hecho, no la
       interpretación. */
    await logAudit({
      userId:      user.id,
      accion:      'gcal_conexion_alta',
      tabla:       'clinica_conexiones_google',
      registroId:  alta.alta.conexionId,
      ip:          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
      descripcion: JSON.stringify({
        clinica:          clinicaId,
        rol:              alta.alta.rol,
        estado:           alta.alta.estado,
        calendarioPrevio: alta.alta.calendarId,
      }),
    })

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
