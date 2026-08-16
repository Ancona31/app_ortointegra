/**
 * Punto único de verdad del calendario propio de Spinus en Google.
 *
 * Spinus ya no escribe en el calendario `primary` del médico: crea y posee un
 * calendario secundario ("Spinus - Dr. Fulano") con el scope NO sensible
 * `calendar.app.created`. Toda la lógica de resolver ese calendario vive aquí
 * — si se reparte por las rutas, el día que un médico borre el calendario
 * desde Google cada ruta se romperá a su manera.
 *
 * PRIVACIDAD — nada clínico sale hacia Google. A este módulo sólo llegan
 * títulos y horarios; notas, motivo de consulta y diagnóstico se quedan en
 * Spinus (ver el comentario "NO enviar notes/descripción" en las rutas).
 */
import { google, type calendar_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/encrypt'
import { logger } from '@/lib/logger'
import { componerNombreMedicoCompleto, type CamposNombre } from '@/lib/nombreMedico'

export const GCAL_TIMEZONE = 'America/Mexico_City'

export type GCalCliente = calendar_v3.Calendar

interface FilaTokens {
  access_token:  string | null
  refresh_token: string | null
  expires_at:    number | null
  calendar_id:   string | null
}

/**
 * Estado de la conexión con Google, tal como lo consumen la agenda y el perfil.
 * Sustituye al viejo `connected: boolean`, que mentía: cualquier fallo de
 * Google se veía en la interfaz igual que "nunca conectaste".
 *
 *   'conectado'    hay token, hay calendario y Google respondió.
 *   'sin_token'    el médico nunca conectó, desconectó, o revocó el acceso
 *                  desde su cuenta de Google. ACCIONABLE: enseñar "Conectar".
 *   'error_google' hay token bueno y Google falló. NO accionable: ofrecer
 *                  "Conectar" aquí empuja a una reconexión que no hace falta.
 *
 * Esta unión se repite a mano en los componentes cliente que la consumen
 * (`/perfil`): importarla de aquí arrastraría `googleapis` al bundle.
 */
export type EstadoGoogle = 'conectado' | 'sin_token' | 'error_google'

/** ¿El error de la API de Google es un 404? Distingue "no existe" de "falló". */
export function esNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ('code'   in err && err.code   === 404) return true
  if ('status' in err && err.status === 404) return true
  if ('response' in err && typeof err.response === 'object' && err.response !== null
      && 'status' in err.response && err.response.status === 404) return true
  return false
}

/**
 * ¿El error dice que las credenciales ya no sirven? Google contesta
 * `invalid_grant` al refrescar cuando el médico revocó el acceso desde su
 * cuenta o cuando el refresh token caducó.
 *
 * Importa separarlo de un fallo cualquiera: hay fila en `google_tokens`, pero
 * está muerta. Cuenta como 'sin_token' y no como 'error_google', porque esto SÍ
 * se arregla volviendo a conectar y tratarlo como fallo pasajero deja al médico
 * esperando para siempre a que Google "se recupere".
 */
export function esCredencialInvalida(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as Record<string, unknown>
  const respuesta = (typeof e.response === 'object' && e.response !== null)
    ? e.response as Record<string, unknown>
    : null
  const datos = (typeof respuesta?.data === 'object' && respuesta.data !== null)
    ? respuesta.data as Record<string, unknown>
    : null
  if (datos?.error === 'invalid_grant') return true
  // googleapis no siempre trae `response.data`: si reventó antes de tener
  // respuesta, el motivo viaja sólo en el mensaje.
  return err instanceof Error && err.message.includes('invalid_grant')
}

/** Datos mínimos para que una línea de log sirva para diagnosticar. */
export interface ContextoGCal {
  /** Qué se intentaba: 'calendars.insert', 'events.patch', 'freebusy.query'… */
  operacion:   string
  userId:      string
  calendarId?: string | null
  eventId?:    string | null
}

/**
 * Saca de un error de la API de Google lo publicable: mensaje, código HTTP y
 * código simbólico. Los errores de googleapis vienen en varias formas según
 * dónde revienten (antes de salir a la red, en el transporte, o con respuesta
 * de Google), así que se buscan las tres.
 */
function detalleError(err: unknown): { mensaje: string; status: number | null; codigo: string | null } {
  if (typeof err !== 'object' || err === null) {
    return { mensaje: String(err), status: null, codigo: null }
  }
  const e = err as Record<string, unknown>
  const respuesta = (typeof e.response === 'object' && e.response !== null)
    ? e.response as Record<string, unknown>
    : null

  const status =
    typeof e.status            === 'number' ? e.status
    : typeof e.code            === 'number' ? e.code
    : typeof respuesta?.status === 'number' ? respuesta.status
    : null

  const codigo = typeof e.code === 'string' ? e.code : null

  // Se registra `message` y NADA más de la respuesta. El cuerpo entero del
  // error de Google puede traer de vuelta lo que se le mandó —y el título de
  // un evento lleva el nombre del paciente—. Los mensajes de Calendar son del
  // tipo "Not Found" / "Insufficient Permission" y no lo incluyen; el corte a
  // 300 caracteres acota el daño si algún día uno lo hiciera.
  const mensaje = (err instanceof Error ? err.message : String(err)).slice(0, 300)

  return { mensaje, status, codigo }
}

/**
 * Registra un fallo de Google con lo que hace falta para diagnosticarlo:
 * operación, médico, calendario y el error real.
 *
 * PRIVACIDAD — aquí NO entra ningún token (ni cifrado ni descifrado) ni ningún
 * nombre de paciente. Si añades un campo, que siga siendo así.
 */
export function registrarFalloGCal(ctx: ContextoGCal, err: unknown): void {
  const { mensaje, status, codigo } = detalleError(err)
  console.error('[GCal] fallo ' + JSON.stringify({
    operacion:  ctx.operacion,
    userId:     ctx.userId,
    calendarId: ctx.calendarId ?? null,
    ...(ctx.eventId ? { eventId: ctx.eventId } : {}),
    status,
    codigo,
    mensaje,
  }))
}

/**
 * Abre sesión con Google para un médico: refresca el token si expiró y
 * devuelve el cliente de Calendar junto al calendario que tenga registrado
 * (null si todavía no se le ha creado uno).
 * Devuelve null si el médico no tiene Google conectado.
 */
async function abrirSesionGoogle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ calendar: GCalCliente; calendarId: string | null } | null> {
  const { data: tokenData } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at, calendar_id')
    .eq('user_id', userId)
    .maybeSingle<FilaTokens>()
  if (!tokenData) return null

  // Una instancia por petición: compartirla entre peticiones concurrentes
  // deja que un usuario sobrescriba las credenciales de otro.
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token:  decrypt(tokenData.access_token),
    refresh_token: decrypt(tokenData.refresh_token),
    expiry_date:   tokenData.expires_at,
  })

  if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
    // Si el médico revocó el acceso desde su cuenta de Google, esto revienta
    // con `invalid_grant` y hasta hoy subía sin dejar rastro hasta el catch
    // mudo de la ruta de turno.
    let credentials
    try {
      ({ credentials } = await oauth2Client.refreshAccessToken())
    } catch (err) {
      registrarFalloGCal(
        { operacion: 'oauth2.refreshAccessToken', userId, calendarId: tokenData.calendar_id },
        err,
      )
      throw err
    }
    const { error } = await supabase.from('google_tokens').update({
      access_token: credentials.access_token ? encrypt(credentials.access_token) : null,
      expires_at:   credentials.expiry_date ?? null,
    }).eq('user_id', userId)
    // No se aborta: la sesión en memoria sirve para esta petición. Pero si no
    // se guardó, la siguiente vuelve a refrescar y conviene saberlo.
    if (error) {
      registrarFalloGCal(
        { operacion: 'google_tokens.update(access_token)', userId, calendarId: tokenData.calendar_id },
        error,
      )
    }
    oauth2Client.setCredentials(credentials)
  }

  return {
    calendar:   google.calendar({ version: 'v3', auth: oauth2Client }),
    calendarId: tokenData.calendar_id,
  }
}

/**
 * Cliente de Calendar autenticado, sin resolver calendario.
 * Para operar sobre el calendario de Spinus usa `conCalendarioSpinus`.
 */
export async function getGCalClient(
  supabase: SupabaseClient,
  userId: string,
): Promise<GCalCliente | null> {
  const sesion = await abrirSesionGoogle(supabase, userId)
  return sesion?.calendar ?? null
}

/**
 * Crea el calendario de Spinus del médico y persiste su id en `google_tokens`.
 * Se llama desde el callback de OAuth y, si allí falló, desde el helper en la
 * primera operación. Devuelve null si Google no devolvió id.
 *
 * `esperado` es el valor que `calendar_id` debe tener AHORA para aceptar el
 * cambio, y no es opcional de verdad: pasar el que no toca cuesta un
 * calendario huérfano o uno muerto adoptado como bueno.
 *
 *   null            se está creando el primero, la columna está vacía.
 *   <id existente>  se está reemplazando ese id concreto porque Google
 *                   contestó 404 sobre él. Con `null` aquí, el
 *                   comparar-y-cambiar no prendería, se tiraría el calendario
 *                   nuevo y se devolvería el id MUERTO como si valiera.
 *
 * Si el cambio no prende porque otra petición ganó la carrera, devuelve el
 * calendario de esa otra petición: sirve igual y evita duplicados.
 */
export async function crearCalendarioSpinus(
  supabase: SupabaseClient,
  userId: string,
  calendar: GCalCliente,
  esperado: string | null = null,
): Promise<string | null> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('titulo, nombres, apellido_paterno')
    .eq('id', userId)
    .maybeSingle<CamposNombre>()

  // Perfil incompleto → "Spinus" a secas, nunca "Spinus - undefined".
  const nombre = perfil ? componerNombreMedicoCompleto(perfil).trim() : ''

  const { data: cal } = await calendar.calendars.insert({
    requestBody: {
      summary:     nombre ? `Spinus - ${nombre}` : 'Spinus',
      timeZone:    GCAL_TIMEZONE,
      // Quitarlo de la lista es tan destructivo como borrarlo y además es
      // indetectable desde Spinus (`calendarList.get` pide un permiso sensible
      // que no tenemos), así que se avisa de las dos cosas.
      description:
        'Citas sincronizadas desde Spinus. No borres este calendario '
        + 'ni lo quites de tu lista de calendarios en Google: si desaparece de '
        + 'tu lista, Spinus sigue escribiendo aquí y tú dejas de verlo.',
    },
  })

  const calendarId = cal?.id ?? null
  if (!calendarId) return null

  // COMPARAR-Y-CAMBIAR. El UPDATE sólo prende si `calendar_id` sigue valiendo
  // lo que valía cuando se decidió crear. Dos peticiones en paralelo —la
  // agenda dispara dos— llegan aquí con el mismo `esperado` y cada una crea su
  // calendario, pero sólo una lo persiste; la otra se entera por los cero
  // renglones, borra el suyo y adopta el del ganador. Sin esto ganaba la
  // última en escribir y las demás quedaban de basura invisible en la cuenta
  // del médico.
  //
  // `.select()` es lo que permite enterarse: sin él PostgREST responde éxito
  // sin decir cuántos renglones tocó. Cubre además el UPDATE que la RLS filtra
  // o sobre un user_id que ya no tiene fila.
  const cambio = supabase
    .from('google_tokens')
    .update({ calendar_id: calendarId })
    .eq('user_id', userId)
  const { data: guardado, error } = await (
    esperado === null
      ? cambio.is('calendar_id', null)
      : cambio.eq('calendar_id', esperado)
  ).select('calendar_id').maybeSingle()

  if (!error && guardado) return calendarId

  // No prendió. Sea cual sea el motivo, el calendario recién creado sobra: un
  // calendario que nadie registró es basura invisible —el médico no tiene por
  // dónde enterarse de que existe— y cada intento fallido deja otro. Se borra
  // aquí mismo; `calendar.app.created` autoriza borrar lo que la app creó.
  try {
    await calendar.calendars.delete({ calendarId })
  } catch (errBorrado) {
    // Se queda huérfano de verdad. Al menos ahora hay una línea con el id
    // exacto para poder borrarlo a mano.
    registrarFalloGCal(
      { operacion: 'calendars.delete (limpieza de huérfano)', userId, calendarId },
      errBorrado,
    )
  }

  // ¿Se perdió una carrera o falló el guardado de verdad? Lo dice el valor que
  // haya ahora: si ya no es el esperado, otra petición ganó y su calendario
  // sirve exactamente igual que el que acabamos de tirar.
  const { data: fila } = await supabase
    .from('google_tokens')
    .select('calendar_id')
    .eq('user_id', userId)
    .maybeSingle<{ calendar_id: string | null }>()
  const actual = fila?.calendar_id ?? null

  if (actual !== null && actual !== esperado) {
    // No es un fallo: es el mecanismo funcionando. Va como warn para que se
    // vea en producción sin ensuciar el conteo de errores.
    logger.warn('GCal', 'carrera de creación resuelta ' + JSON.stringify({
      operacion:  'google_tokens.update(calendar_id) — comparar-y-cambiar no prendió',
      userId,
      descartado: calendarId,
      adoptado:   actual,
    }))
    return actual
  }

  registrarFalloGCal(
    { operacion: 'google_tokens.update(calendar_id)', userId, calendarId },
    error ?? new Error('UPDATE sin renglones afectados y calendar_id sin cambiar'),
  )
  return null
}

/**
 * ¿Sigue existiendo el calendario? Un error que no sea 404 se lee como "sí".
 *
 * Ese sesgo es deliberado y los dos llamadores dependen de él: ante la duda,
 * ninguno destruye ni duplica nada.
 */
export async function calendarioVive(calendar: GCalCliente, calendarId: string, userId: string): Promise<boolean> {
  try {
    await calendar.calendars.get({ calendarId })
    return true
  } catch (err) {
    // Un error que no sea 404 hace que esta comprobación conteste "vive" y el
    // 404 original suba sin recrear nada. Es lo correcto, pero deja de serlo en
    // silencio si lo que falla de verdad es el permiso o la cuota.
    if (!esNotFound(err)) {
      registrarFalloGCal({ operacion: 'calendars.get (comprobar si vive)', userId, calendarId }, err)
      return true
    }
    return false
  }
}

/**
 * El médico borró el calendario desde Google: los eventos murieron con él.
 * Se sueltan los vínculos, NUNCA la cita.
 *
 * ÁMBITO — dentro de la clínica, las citas de este médico MÁS las que no
 * tienen médico asignado. `medico_id` a secas dejaba a estas últimas con un
 * `google_event_id` muerto para siempre (la columna es nullable). `clinica_id`
 * es imprescindible y no decorativo: sin él, el tramo `medico_id IS NULL`
 * barrería las citas huérfanas de TODAS las clínicas — esta función corre a
 * veces con el cliente admin, donde la RLS no acota nada.
 *
 * No se amplía a la clínica entera a propósito: en una clínica con varios
 * médicos, las citas de otro pueden tener su evento en un calendario que sigue
 * vivo, y desvincularlas rompería un enlace bueno.
 *
 * Hueco conocido que esto NO cierra: el evento se crea en el calendario de
 * quien guarda la cita, no en el del médico de la cita. Si una secretaria
 * agenda para el Dr. B y luego borra su propio calendario, esa cita no se
 * desvincula. Cerrarlo pide una columna que registre de quién es el evento;
 * queda fuera de esta rama.
 */
export async function desvincularCitas(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('clinica_id')
    .eq('id', userId)
    .maybeSingle<{ clinica_id: string | null }>()
  // Sin clínica no hay citas que soltar: el trabajo está hecho, no fallido.
  if (!perfil?.clinica_id) return true

  const { error } = await supabase
    .from('appointments')
    .update({ google_event_id: null, gcal_sync_status: 'unbound' })
    .eq('clinica_id', perfil.clinica_id)
    .or(`medico_id.eq.${userId},medico_id.is.null`)
    .not('google_event_id', 'is', null)

  // Si esto falla, las citas quedan apuntando a eventos de un calendario
  // muerto y nada más vuelve a intentarlo. `conCalendarioSpinus` no puede hacer
  // nada al respecto e ignora el resultado; el botón de recrear del perfil sí
  // lo mira, y aborta antes de destruir nada.
  if (error) {
    registrarFalloGCal({ operacion: 'appointments.update(unbound)', userId }, error)
    return false
  }
  return true
}

/**
 * Ejecuta una operación contra el calendario de Spinus del médico.
 *
 * Resuelve el calendario (creándolo si hace falta), corre la operación y, si
 * Google responde 404 **sobre ese calendario**, lo recrea, desvincula las
 * citas huérfanas y reintenta UNA sola vez. El 404 se confirma con
 * `calendars.get` antes de actuar: un `events.patch` sobre un evento borrado
 * también responde 404 y no debe desencadenar nada de esto.
 *
 * Devuelve null si el médico no tiene Google conectado.
 *
 * Nota: si la operación llevaba un eventId del calendario muerto, el reintento
 * vuelve a fallar y el error sube al llamador — correcto, esa escritura sí
 * falló. La cita ya quedó desvinculada.
 */
export async function conCalendarioSpinus<T>(
  supabase: SupabaseClient,
  userId: string,
  operacion: (calendar: GCalCliente, calendarId: string) => Promise<T>,
): Promise<T | null> {
  const sesion = await abrirSesionGoogle(supabase, userId)
  if (!sesion) return null
  const { calendar } = sesion

  const calendarId = sesion.calendarId ?? await crearCalendarioSpinus(supabase, userId, calendar)
  if (!calendarId) return null

  try {
    return await operacion(calendar, calendarId)
  } catch (err) {
    if (!esNotFound(err)) throw err
    if (await calendarioVive(calendar, calendarId, userId)) throw err

    await desvincularCitas(supabase, userId)
    // `calendarId` es el que acaba de dar 404: se reemplaza ESE. Pasar null
    // haría que el comparar-y-cambiar no prendiera y que se devolviera el id
    // muerto, dejando el reintento condenado a fallar otra vez.
    const recreado = await crearCalendarioSpinus(supabase, userId, calendar, calendarId)
    if (!recreado) throw err
    return await operacion(calendar, recreado)
  }
}
