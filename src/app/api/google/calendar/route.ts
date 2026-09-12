/**
 * El calendario de Spinus del médico: consultarlo (GET) y rehacerlo (POST).
 *
 * POR QUÉ EXISTE EL POST — hay dos formas de romper este calendario y sólo una
 * se cura sola. Si el médico lo BORRA, la siguiente llamada da 404 y
 * `conCalendarioSpinus` lo recrea. Si lo QUITA DE SU LISTA en Google, no hay
 * 404 ni error de ninguna clase: Spinus sigue escribiendo en un calendario que
 * el médico ya no ve. Averiguarlo por API pediría `calendarList.get`, que es un
 * permiso sensible que no tenemos, así que la salida es manual.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { resolverConexionClinica, guardarCalendarIdSiEsperado, type ConexionGoogle } from '@/lib/gcalConexion'
import { logAudit } from '@/lib/audit'
import {
  getGCalClient,
  crearCalendarioSpinus,
  desvincularCitas,
  registrarFalloGCal,
  esNotFound,
  esCredencialInvalida,
  type GCalCliente,
  type EstadoGoogle,
} from '@/lib/gcal'

/** El nombre que el calendario tiene HOY en Google, no el que se le puso al crearlo. */
async function nombreEnGoogle(
  calendar: GCalCliente,
  calendarId: string,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await calendar.calendars.get({ calendarId })
    return data.summary ?? null
  } catch (err) {
    // 404 = el médico lo borró. No es un fallo que reportar: el helper lo
    // recreará en la primera operación y el perfil sólo deja de mostrar nombre.
    if (!esNotFound(err)) {
      registrarFalloGCal({ operacion: 'calendars.get (nombre para el perfil)', userId, calendarId }, err)
    }
    return null
  }
}

/**
 * Resuelve la conexión de la clínica para quien ADMINISTRA la clínica, o
 * devuelve la respuesta de rechazo.
 *
 * El gate cubre el GET además del POST, y eso es nuevo. Mientras la conexión
 * era del propio usuario, un GET sin gate sólo le enseñaba lo suyo; resolviendo
 * por clínica, cualquier secretaria o médico invitado obtendría el `calendarId`
 * de la clínica y provocaría de paso una lectura de sus tokens con el cliente
 * admin. El único consumidor de esta ruta es /perfil, donde los dos botones ya
 * viven dentro de `isAdmin`, así que gatearla no rompe nada.
 */
async function conexionDeQuienAdministra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ conexion: ConexionGoogle | null } | { rechazo: NextResponse }> {
  const { data: profile } = await supabase
    .from('profiles')
    // OJO: no se gatea por `role === 'admin'`. Un médico dueño de su cuenta
    // tiene role='medico' con es_admin_de_clinica=true.
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', userId)
    .single()
  if (!canManageClinica(profile) || !profile?.clinica_id) {
    return { rechazo: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { conexion: await resolverConexionClinica(supabase, profile.clinica_id) }
}

/* ── GET /api/google/calendar ───────────────────────────────
 * A qué calendario se está sincronizando. Sólo lee: a diferencia de
 * `conCalendarioSpinus`, NO crea uno si `calendar_id` viene en null.
 *
 * Tenía el mismo defecto que el GET de /api/google/events: contestaba
 * `connected: false` tanto sin token como con Google caído, y el perfil le
 * pintaba "Conectar" a un médico que ya lo estaba. Ahora contesta `estado`. */
export async function GET() {
  let userId = 'sin-sesion'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const resuelto = await conexionDeQuienAdministra(supabase, user.id)
    if ('rechazo' in resuelto) return resuelto.rechazo

    // null = la clínica no tiene conexión activa. Es el único camino de "sin
    // token" que llega hasta aquí sin lanzar.
    const { conexion } = resuelto
    if (!conexion) return NextResponse.json({ estado: 'sin_token' satisfies EstadoGoogle })

    const calendar = await getGCalClient(conexion)
    const calendarId = conexion.calendarId
    return NextResponse.json({
      estado:       'conectado' satisfies EstadoGoogle,
      calendarId,
      calendarName: calendarId ? await nombreEnGoogle(calendar, calendarId, user.id) : null,
      // A QUÉ CUENTA DE GOOGLE está atado el calendario. No tiene por qué ser el
      // correo con el que se entra a Spinus —hoy en producción no lo es—, y sin
      // enseñarlo no hay forma de saberlo desde la interfaz.
      //
      // ⚠ VA SÓLO EN ESTA RESPUESTA, Y ES DELIBERADO. Es la cuenta PERSONAL de
      // quien conectó, y esta ruta es la única de las cinco que resuelven la
      // conexión que está entera tras `canManageClinica`
      // (`conexionDeQuienAdministra`, arriba). NO lo copies a /api/google/events
      // ni a las de appointments: ésas las llama también quien no administra.
      //
      // NULL = identidad desconocida (conexión anterior a los scopes
      // `openid`/`email`, plan §12.17). El cliente se calla y pinta como antes;
      // no hay texto de «cuenta desconocida» que inventar.
      cuentaEmail:  conexion.googleAccountEmail,
    })
  } catch (err) {
    // Aquí cae sobre todo el refresco de token de una conexión revocada desde
    // la cuenta de Google: existe, pero está muerta y esto sí se arregla
    // reconectando, así que va como 'sin_token'. Cualquier otro fallo (incluido
    // no llegar a mirar los tokens) es 'error_google': no accionable, y ofrecer
    // "Conectar" ahí sería el mismo engaño de antes. Aquí caen también las tres
    // respuestas anómalas del puente, que `abrirSesionGoogle` lanza en vez de
    // tragarse (plan §3.1).
    registrarFalloGCal({ operacion: 'calendars.get (estado para el perfil)', userId }, err)
    return NextResponse.json({
      estado: (esCredencialInvalida(err) ? 'sin_token' : 'error_google') satisfies EstadoGoogle,
    })
  }
}

/* ── POST /api/google/calendar ──────────────────────────────
 * Tira el calendario actual y monta uno nuevo.
 *
 * ORDEN DELIBERADO — el invariante es que la base NUNCA quede apuntando a un
 * calendario que no existe. Por eso lo destructivo va al final y lo reversible
 * al principio:
 *
 *   1. desvincular las citas   → si falla, no se ha roto nada todavía: 500.
 *   2. calendar_id = null      → si falla, tampoco: 500 antes de borrar.
 *   3. borrar el calendario    → si falla, seguimos: la base ya está en null.
 *   4. crear y guardar el nuevo→ si falla, la base se queda en null y
 *                                `conCalendarioSpinus` lo resuelve solo.
 *
 * En cualquier corte el resultado es el id nuevo o null. Nunca un id muerto.
 */
/* `req` es nuevo y sólo sirve para la `ip` de la entrada de auditoría. Es la
   firma canónica de un handler de Next; el GET de arriba sigue sin recibirla
   porque no registra nada. */
export async function POST(req: Request) {
  let userId = 'sin-sesion'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const resuelto = await conexionDeQuienAdministra(supabase, user.id)
    if ('rechazo' in resuelto) return resuelto.rechazo
    const { conexion } = resuelto
    if (!conexion) {
      return NextResponse.json(
        { error: 'no_conectado', message: 'Conecta Google Calendar antes de recrear el calendario.' },
        { status: 400 },
      )
    }

    const calendar = await getGCalClient(conexion)
    const anterior = conexion.calendarId

    // 1. Los eventos del calendario viejo mueren con él: los vínculos se
    //    sueltan, las citas NO. Si esto no se puede, no se toca nada más.
    //
    //    VA POR `conexion.userId`, NO POR QUIEN PULSA EL BOTÓN. El calendario
    //    que se está tirando es el de la cuenta de Google de la conexión, y una
    //    clínica puede tener más de un médico con `es_admin_de_clinica`. Con
    //    `user.id` se soltarían las citas del administrador que pulsa —que no
    //    están en ese calendario— y quedarían intactas las que sí apuntaban al
    //    que acaba de morir.
    if (!await desvincularCitas(supabase, conexion.userId)) {
      return NextResponse.json(
        { error: 'desvinculacion_fallida', message: 'No se pudieron soltar las citas. No se cambió nada.' },
        { status: 500 },
      )
    }

    // 2. Soltar el id ANTES de borrar en Google, no después. Va por el módulo,
    //    que lo suelta en las dos fuentes con el mismo comparar-y-cambiar.
    try {
      await guardarCalendarIdSiEsperado({ conexion, nuevo: null, esperado: anterior })
    } catch (errNull) {
      registrarFalloGCal(
        { operacion: 'guardarCalendarIdSiEsperado(null)', userId: user.id, conexionId: conexion.id, calendarId: anterior },
        errNull,
      )
      return NextResponse.json(
        { error: 'guardado_fallido', message: 'No se pudo actualizar la conexión. No se borró ningún calendario.' },
        { status: 500 },
      )
    }

    // 3. Borrar el de antes. Un 404 significa que ya no estaba: no es error.
    if (anterior) {
      try {
        await calendar.calendars.delete({ calendarId: anterior })
      } catch (err) {
        if (!esNotFound(err)) {
          // Queda vivo en la cuenta de Google de la conexión, pero ya no es el
          // de Spinus. Se sigue adelante: el objetivo es volver a tener uno
          // bueno.
          registrarFalloGCal({ operacion: 'calendars.delete (recrear)', userId: user.id, conexionId: conexion.id, calendarId: anterior }, err)
        }
      }
    }

    // 4. Mismo criterio de nombre y descripción que el callback. El valor
    //    esperado es null porque el paso 2 acaba de dejar la columna en null;
    //    si otra petición se coló y ya escribió un id, el comparar-y-cambiar
    //    no prende y se adopta el suyo en vez de duplicar.
    const nuevo = await crearCalendarioSpinus(
      conexion, createAdminClient(), calendar, { esperado: null, actorId: user.id },
    )
    if (!nuevo) {
      return NextResponse.json(
        { error: 'creacion_fallida', message: 'Se soltó el calendario anterior pero no se pudo crear el nuevo. Recarga la agenda y se creará solo.' },
        { status: 500 },
      )
    }

    /* Recrear tira un calendario y monta otro: los eventos del viejo mueren con
       él y las citas se sueltan. Queda registrado quién lo pidió y con qué
       resultado.

       SÓLO EL CAMINO DE ÉXITO, y por eso va aquí abajo y no arriba: los cuatro
       cortes anteriores devuelven 500 antes de llegar. Eso resuelve además el
       doble clic sin ninguna guarda extra —el comparar-y-cambiar de
       `guardarCalendarIdSiEsperado` deja pasar a una sola petición y la
       perdedora sale por `guardado_fallido`—, así que no puede haber dos
       entradas para una misma recreación.

       `anterior` puede ser null: la conexión estaba sin calendario y esto fue
       un alta, no un relevo. Se registra tal cual.

       El nombre del calendario NO entra en la descripción aunque lo tengamos a
       mano tres líneas más abajo para la respuesta: es `"Spinus - Dr. Fulano"`,
       o sea el nombre de una persona. Ver la nota en `src/lib/audit.ts`. */
    await logAudit({
      userId:      user.id,
      accion:      'gcal_calendario_recreado',
      tabla:       'clinica_conexiones_google',
      registroId:  conexion.id,
      ip:          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
      descripcion: JSON.stringify({
        clinica:  conexion.clinicaId,
        anterior,
        nuevo,
      }),
    })

    return NextResponse.json({
      ok:           true,
      calendarId:   nuevo,
      calendarName: await nombreEnGoogle(calendar, nuevo, user.id),
    })
  } catch (err) {
    registrarFalloGCal({ operacion: 'calendars.insert (recrear desde el perfil)', userId }, err)
    return NextResponse.json({ error: 'Error al recrear el calendario' }, { status: 500 })
  }
}
