/**
 * Punto único de verdad del calendario propio de Spinus en Google.
 *
 * Spinus ya no escribe en el calendario `primary` del médico: crea y posee un
 * calendario secundario ("Spinus - Dr. Fulano") con el scope NO sensible
 * `calendar.app.created`. Toda la lógica de resolver ese calendario vive aquí
 * — si se reparte por las rutas, el día que un médico borre el calendario
 * desde Google cada ruta se romperá a su manera.
 *
 * PRIVACIDAD — nada clínico sale hacia Google, y desde que murió el POST de
 * texto libre de `/api/google/events` ya no queda por dónde: lo único que se
 * escribe son las citas, y su título y descripción los compone
 * `eventoParaGoogle` (src/lib/appointments.ts) con un formato fijo de nombre
 * de clínica y nombre de paciente. Ni `notes`, ni motivo de consulta, ni
 * diagnóstico. Si alguna vez vuelve a haber un camino de texto libre, vuelve
 * a hacer falta anonimizarlo antes de mandarlo.
 */
import { google, type calendar_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encrypt'
import { logger } from '@/lib/logger'
import { componerNombreMedicoCompleto, type CamposNombre } from '@/lib/nombreMedico'
import {
  leerConexionConSecretos,
  guardarSecretos,
  guardarCalendarIdSiEsperado,
  releerCalendarId,
  marcarRevocada,
  type ConexionGoogle,
} from '@/lib/gcalConexion'

/**
 * Zona de VISUALIZACIÓN del calendario «Spinus - Dr. X» que la app crea en la
 * cuenta de Google del médico. Ver `crearCalendarioSpinus`, su único uso.
 *
 * ⚠️  NO ES EL HUSO DE LAS CITAS y no vale para etiquetar eventos. Cada evento
 * lleva el suyo, el de su consultorio, desde `appointments.consultorio_timezone`
 * (rutas de `appointments`). Hasta agosto de 2026 esta constante etiquetaba
 * también los eventos, y por eso las invitaciones de una cita en Hermosillo
 * decían «hora estándar central». Si vuelves a importarla desde una ruta de
 * citas, estás reintroduciendo ese bug.
 */
export const GCAL_TIMEZONE = 'America/Mexico_City'

export type GCalCliente = calendar_v3.Calendar


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
 * Importa separarlo de un fallo cualquiera: la conexión de la clínica existe,
 * pero está muerta. Cuenta como 'sin_token' y no como 'error_google', porque
 * esto SÍ se arregla volviendo a conectar y tratarlo como fallo pasajero deja
 * al médico esperando para siempre a que Google "se recupere".
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
  /** Qué se intentaba: 'calendars.insert', 'events.patch', 'events.list'… */
  operacion:   string
  /**
   * QUIÉN EJECUTA LA ACCIÓN, y no el dueño de la cuenta de Google. Los dos eran
   * la misma persona mientras la conexión iba por usuario, y desde la conexión
   * por clínica ya no lo son: la secretaria mueve una cita y el calendario es
   * del administrador. Poner aquí el dueño de la cuenta haría que todos los
   * logs dijeran «el administrador» y se perdería quién disparó cada cosa —que
   * es justo lo que hace falta para diagnosticar H2—. El dueño viaja aparte, en
   * `conexionId`.
   */
  userId:      string
  /** La conexión de clínica implicada. Identifica de quién es el calendario. */
  conexionId?: string | null
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
    ...(ctx.conexionId ? { conexionId: ctx.conexionId } : {}),
    calendarId: ctx.calendarId ?? null,
    ...(ctx.eventId ? { eventId: ctx.eventId } : {}),
    status,
    codigo,
    mensaje,
  }))
}

/**
 * Abre sesión con Google para LA CONEXIÓN DE LA CLÍNICA: refresca el token si
 * expiró y devuelve el cliente de Calendar junto al calendario registrado (null
 * si todavía no se ha creado uno).
 *
 * ── EL CAMBIO QUE ARREGLA EL BUG DE LA RAMA ─────────────────────────────────
 * Hasta aquí esta función leía `google_tokens` por el `user_id` de QUIEN
 * EJECUTA la acción. La secretaria no tiene fila, no se encontraba nada y el
 * código seguía de largo devolviendo null: sus citas no llegaban a Google y
 * nadie se enteraba. Ahora recibe la conexión ya resuelta por clínica y los
 * tokens salen del puente, así que quién ejecute deja de importar.
 *
 * ── POR QUÉ YA NO DEVUELVE null ANTE UN PROBLEMA DE SECRETOS (plan §3.1) ────
 * Antes, un fallo de la consulta se descartaba y se contestaba null, que aguas
 * arriba se lee como «esta clínica nunca conectó». Con el puente esa misma rama
 * se tragaría un PGRST202 (la función fuera de la caché de PostgREST), un 42501
 * (falta el GRANT) o una conexión de otra clínica. Las TRES respuestas anómalas
 * del RPC —error, cero filas, y `tieneSecretos = false`— se registran y se
 * LANZAN. Aquí ya no se devuelve null nunca: «no hay conexión» lo decide el
 * resolvedor bajo RLS antes de llegar a esta función.
 */
async function abrirSesionGoogle(
  conexion: ConexionGoogle,
): Promise<{ calendar: GCalCliente; calendarId: string | null }> {
  const { fila, error } = await leerConexionConSecretos({
    clinicaId:  conexion.clinicaId,
    conexionId: conexion.id,
  })

  const ctx = { userId: conexion.userId, conexionId: conexion.id, calendarId: conexion.calendarId }
  if (error) {
    registrarFalloGCal({ ...ctx, operacion: 'leer_conexion_google_con_secretos (error)' }, new Error(error))
    throw new Error(`abrirSesionGoogle: el puente falló — ${error}`)
  }
  if (!fila) {
    // La conexión existía al resolverla y ya no está: la borraron entre medias,
    // o el filtro por clínica del RPC la descartó. No es «nunca conectó».
    registrarFalloGCal(
      { ...ctx, operacion: 'leer_conexion_google_con_secretos (cero filas)' },
      new Error('la conexión resuelta no existe para esta clínica'),
    )
    throw new Error('abrirSesionGoogle: la conexión no existe para esta clínica')
  }
  if (!fila.tieneSecretos) {
    // Metadata sin tokens. Es una ANOMALÍA, no un «desconectado»: el alta los
    // escribe en la misma transacción que la fila, así que esto no debería
    // poder ocurrir.
    registrarFalloGCal(
      { ...ctx, operacion: 'leer_conexion_google_con_secretos (tiene_secretos = false)' },
      new Error('hay conexión y no hay tokens'),
    )
    throw new Error('abrirSesionGoogle: la conexión no tiene tokens')
  }

  // Una instancia por petición: compartirla entre peticiones concurrentes
  // deja que un usuario sobrescriba las credenciales de otro.
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token:  decrypt(fila.accessToken),
    refresh_token: decrypt(fila.refreshToken),
    expiry_date:   fila.expiresAt,
  })

  if (fila.expiresAt && Date.now() > fila.expiresAt) {
    await refrescarSesion(oauth2Client, conexion)
  }

  return {
    calendar:   google.calendar({ version: 'v3', auth: oauth2Client }),
    calendarId: fila.calendarId,
  }
}

/**
 * Refresca el access token y lo persiste por el módulo, en las dos fuentes.
 *
 * Va aparte para que `abrirSesionGoogle` no pase de 50 líneas (Protocolo 3), y
 * porque lo que hace en el camino de error tiene entidad propia: si Google
 * contesta `invalid_grant`, la conexión se marca revocada antes de relanzar.
 */
async function refrescarSesion(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  conexion: ConexionGoogle,
): Promise<void> {
  const ctx = { userId: conexion.userId, conexionId: conexion.id, calendarId: conexion.calendarId }
  let credentials
  try {
    ({ credentials } = await oauth2Client.refreshAccessToken())
  } catch (err) {
    registrarFalloGCal({ ...ctx, operacion: 'oauth2.refreshAccessToken' }, err)
    // El permiso se retiró desde la cuenta de Google: estos tokens no vuelven a
    // servir y la conexión deja de contar como activa.
    //
    // ⚠ AQUÍ EL RADIO DEL FALLO PASA A SER LA CLÍNICA ENTERA, Y ESO ES NUEVO.
    // `resolverConexionClinica` filtra por `estado = 'activa'`, así que en
    // cuanto esta marca prende dejan de sincronizar el administrador, la
    // secretaria y todos los médicos invitados a la vez, hasta que alguien
    // reconecte a mano desde /perfil. Antes de la conexión por clínica, un
    // `invalid_grant` afectaba sólo a la persona dueña de esos tokens. Es la
    // consecuencia deliberada del plan §5 y está decidida; queda escrita aquí
    // porque no se deduce leyendo la línea de abajo.
    if (esCredencialInvalida(err)) await marcarRevocada(conexion)
    throw err
  }
  if (credentials.access_token) {
    // No aborta si el guardado falla: la sesión en memoria sirve para esta
    // petición y tirarla significaría perder una cita que se podía sincronizar
    // (plan §2.4, H9). El módulo registra el fallo por su cuenta.
    await guardarSecretos({
      clinicaId:   conexion.clinicaId,
      conexion,
      accessToken: credentials.access_token,
      expiresAt:   credentials.expiry_date ?? null,
    })
  }
  oauth2Client.setCredentials(credentials)
}

/**
 * Cliente de Calendar autenticado sobre la conexión de la clínica, sin resolver
 * calendario. Para operar sobre el calendario de Spinus usa
 * `conCalendarioSpinus`.
 */
export async function getGCalClient(conexion: ConexionGoogle): Promise<GCalCliente> {
  const sesion = await abrirSesionGoogle(conexion)
  return sesion.calendar
}

/**
 * Crea el calendario de Spinus de la clínica y persiste su id en la conexión.
 * Se llama desde el callback de OAuth y, si allí falló, desde el helper en la
 * primera operación. Devuelve null si Google no devolvió id.
 *
 * `opciones.esperado` es el valor que `calendar_id` debe tener AHORA para
 * aceptar el cambio, y ya no tiene default: el docstring decía «no es opcional
 * de verdad» y ahora lo impone el tipo. Pasar el que no toca cuesta un
 * calendario huérfano o uno muerto adoptado como bueno.
 *
 * `opciones.actorId` es QUIEN EJECUTA, sólo para los logs. No se confunde con
 * `conexion.userId`, que es el dueño de la cuenta de Google (ver `ContextoGCal`).
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
  conexion: ConexionGoogle,
  admin: SupabaseClient,
  calendar: GCalCliente,
  opciones: { esperado: string | null; actorId: string },
): Promise<string | null> {
  const { esperado, actorId } = opciones
  // EXCEPCIÓN DE CLIENTE, aprobada en el plan §3.4 (a) y en la decisión 4 de
  // §11. Esta lectura ocurre a veces dentro de `after()`, donde sólo entra el
  // cliente admin, así que va con él y acotada A MANO por `id` Y `clinica_id`:
  // sin RLS, el filtro por clínica es lo único que impide leer el perfil de
  // otra. El nombre es el del DUEÑO de la cuenta de Google, no el de quien
  // ejecuta, porque el calendario vive en su cuenta y se llama por él.
  const { data: perfil } = await admin
    .from('profiles')
    .select('titulo, nombres, apellido_paterno')
    .eq('id', conexion.userId)
    .eq('clinica_id', conexion.clinicaId)
    .maybeSingle<CamposNombre>()

  // Perfil incompleto → "Spinus" a secas, nunca "Spinus - undefined".
  const nombre = perfil ? componerNombreMedicoCompleto(perfil).trim() : ''

  const { data: cal } = await calendar.calendars.insert({
    requestBody: {
      summary:     nombre ? `Spinus - ${nombre}` : 'Spinus',
      // EL CENTRO AQUÍ ES UNA DECISIÓN, NO UN DESCUIDO (agosto de 2026).
      //
      // La `timeZone` de un CALENDARIO es sólo su zona de visualización por
      // defecto: cómo se pinta la cuadrícula al abrirlo si el médico no tiene
      // zona fija en su cuenta de Google. No afecta a ningún evento —cada uno
      // lleva su propia `start.timeZone`, la de su consultorio— ni, por tanto,
      // a lo que ve el paciente ni a lo que dicen las invitaciones.
      //
      // Y no hay una zona mejor que elegir: el calendario se crea UNA VEZ por
      // clínica, mientras que una clínica puede tener consultorios en husos
      // distintos. Tomar la del primer consultorio sería igual de arbitrario
      // que el Centro, con la desventaja de PARECER una decisión informada.
      //
      // O sea que si esto te chirría al leerlo, no lo arregles: no hay nada
      // roto debajo. Lo que sí importaba —la etiqueta de cada evento— ya se
      // arregló en las rutas de `appointments`.
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
  // Lo hace el módulo, que escribe en las DOS fuentes con el mismo `esperado`
  // (plan §2.3 y §2.6): el espejo también es comparar-y-cambiar, o dos
  // peticiones en carrera podrían persistirlas en orden inverso.
  const prendio = await guardarCalendarIdSiEsperado({ conexion, nuevo: calendarId, esperado })
  if (prendio) return calendarId

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
      { operacion: 'calendars.delete (limpieza de huérfano)', userId: actorId, conexionId: conexion.id, calendarId },
      errBorrado,
    )
  }

  // ¿Se perdió una carrera o falló el guardado de verdad? Lo dice el valor que
  // haya ahora: si ya no es el esperado, otra petición ganó y su calendario
  // sirve exactamente igual que el que acabamos de tirar.
  const actual = await releerCalendarId(conexion)

  if (actual !== null && actual !== esperado) {
    // No es un fallo: es el mecanismo funcionando. Va como warn para que se
    // vea en producción sin ensuciar el conteo de errores.
    logger.warn('GCal', 'carrera de creación resuelta ' + JSON.stringify({
      operacion:  'clinica_conexiones_google.calendar_id — comparar-y-cambiar no prendió',
      userId:     actorId,
      conexionId: conexion.id,
      descartado: calendarId,
      adoptado:   actual,
    }))
    return actual
  }

  registrarFalloGCal(
    { operacion: 'guardarCalendarIdSiEsperado', userId: actorId, conexionId: conexion.id, calendarId },
    new Error('el comparar-y-cambiar no prendió y calendar_id sigue sin cambiar'),
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
 * ⚠ ESE RAZONAMIENTO ERA CIERTO CON UN CALENDARIO POR MÉDICO Y HA DEJADO DE
 * SERLO. Bajo la conexión por clínica hay UN SOLO calendario y todas las citas
 * de todos los médicos viven en él, así que acotar por `medico_id` deja fuera
 * precisamente a las que había que soltar: cuando el administrador recrea el
 * calendario, las citas de los demás médicos conservan un `google_event_id`
 * que apunta a un evento muerto, con `gcal_sync_status = 'synced'` mintiendo, y
 * nada vuelve a intentarlo.
 *
 * ARREGLAR EL ÁMBITO ES DE LA RAMA SIGUIENTE, NO DE ÉSTA, y a propósito: se
 * hace con `appointments.gcal_calendar_id` —«las citas cuyo evento vive en ESTE
 * calendario»—, que es la columna que esta rama empieza a rellenar en los
 * `after()` del alta y de la edición. Antes de tener esos datos, ampliar el
 * barrido a la clínica entera sería barrer a ciegas.
 *
 * Lo que esta rama SÍ cierra es QUIÉN puede llegar hasta aquí: el
 * `puedeReparar` de `conCalendarioSpinus` (plan §3.3, H2). Sin él, cualquier
 * miembro de la clínica disparaba este UPDATE masivo con el cliente admin sin
 * poder leer ni una de las filas que modifica.
 *
 * Hueco conocido que esto NO cierra: el evento se crea en el calendario de
 * quien guarda la cita, no en el del médico de la cita. Cerrarlo pide la misma
 * columna de arriba; queda fuera de esta rama.
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
 * Ejecuta una operación contra el calendario de Spinus DE LA CLÍNICA.
 *
 * Resuelve el calendario (creándolo si hace falta), corre la operación y, si
 * Google responde 404 **sobre ese calendario**, lo recrea, desvincula las
 * citas huérfanas y reintenta UNA sola vez. El 404 se confirma con
 * `calendars.get` antes de actuar: un `events.patch` sobre un evento borrado
 * también responde 404 y no debe desencadenar nada de esto.
 *
 * Devuelve null si la clínica no tiene conexión activa —`conexion` en null—,
 * que es la misma semántica de «nada que sincronizar» que tenía cuando el
 * médico no tenía token. Los llamadores no cambian por eso.
 *
 * ── EL MODO ESTRICTO (`puedeReparar`), Y POR QUÉ NO TIENE DEFAULT ───────────
 * Esta función NO es de lectura: crea calendarios y dispara un UPDATE masivo
 * sobre `appointments`. Bajo la conexión por clínica lo hace con el cliente
 * admin y sobre la cuenta de Google de OTRA PERSONA, y cualquier miembro de la
 * clínica llega hasta aquí con sólo abrir la agenda (plan §3.3, H2).
 *
 *   puedeReparar = true    quien administra la clínica: como siempre.
 *   puedeReparar = false   todos los demás. Si falta `calendar_id` o hay 404,
 *                          devuelve null y NO ESCRIBE NADA, ni en la base ni
 *                          en Google. Ni crea, ni desvincula, ni recrea.
 *
 * Es OBLIGATORIO y sin default permisivo a propósito: un default `true` es
 * exactamente cómo se vuelve a abrir el agujero desde un llamador nuevo que no
 * sabe que existe. Lo calcula cada ruta con `canManageClinica` ANTES de
 * responder y lo hace viajar por closure hasta `after()`.
 *
 * Consecuencia aceptada: una secretaria que agenda la primera cita de una
 * clínica cuyo calendario aún no existe NO lo crea, y la cita queda `pending`
 * hasta que entre quien administra. Es peor UX que antes y es la contención
 * correcta.
 *
 * Nota: si la operación llevaba un eventId del calendario muerto, el reintento
 * vuelve a fallar y el error sube al llamador — correcto, esa escritura sí
 * falló. La cita ya quedó desvinculada.
 */
export async function conCalendarioSpinus<T>(
  conexion: ConexionGoogle | null,
  admin: SupabaseClient,
  operacion: (calendar: GCalCliente, calendarId: string) => Promise<T>,
  opciones: { puedeReparar: boolean; actorId: string },
): Promise<T | null> {
  if (!conexion) return null
  const { puedeReparar, actorId } = opciones

  const { calendar, calendarId: registrado } = await abrirSesionGoogle(conexion)

  // Sin calendario y sin permiso para crearlo: no hay nada que hacer aquí, y
  // fingir que sí escribiría en la cuenta de Google de otra persona.
  if (!registrado && !puedeReparar) return null

  const calendarId = registrado
    ?? await crearCalendarioSpinus(conexion, admin, calendar, { esperado: null, actorId })
  if (!calendarId) return null

  try {
    return await operacion(calendar, calendarId)
  } catch (err) {
    if (!esNotFound(err)) throw err
    if (await calendarioVive(calendar, calendarId, actorId)) throw err
    // El calendario está muerto de verdad, y a partir de aquí todo es
    // destructivo: el UPDATE masivo y una escritura en la cuenta ajena.
    if (!puedeReparar) return null

    // El ámbito del barrido va por el DUEÑO de la cuenta de Google, que es de
    // quien era el calendario que acaba de morir — no por quien ejecuta.
    await desvincularCitas(admin, conexion.userId)
    // `calendarId` es el que acaba de dar 404: se reemplaza ESE. Pasar null
    // haría que el comparar-y-cambiar no prendiera y que se devolviera el id
    // muerto, dejando el reintento condenado a fallar otra vez.
    const recreado = await crearCalendarioSpinus(conexion, admin, calendar, { esperado: calendarId, actorId })
    if (!recreado) throw err
    return await operacion(calendar, recreado)
  }
}
