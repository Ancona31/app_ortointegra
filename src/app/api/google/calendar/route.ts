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
import { canManageClinica } from '@/lib/permissions'
import {
  getGCalClient,
  crearCalendarioSpinus,
  desvincularCitas,
  registrarFalloGCal,
  esNotFound,
  type GCalCliente,
} from '@/lib/gcal'

/** El calendario registrado en `google_tokens`, sin crear nada si no hay. */
async function calendarioRegistrado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('google_tokens')
    .select('calendar_id')
    .eq('user_id', userId)
    .maybeSingle<{ calendar_id: string | null }>()
  return data?.calendar_id ?? null
}

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

/* ── GET /api/google/calendar ───────────────────────────────
 * A qué calendario se está sincronizando. Sólo lee: a diferencia de
 * `conCalendarioSpinus`, NO crea uno si `calendar_id` viene en null. */
export async function GET() {
  let userId = 'sin-sesion'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const calendar = await getGCalClient(supabase, user.id)
    if (!calendar) return NextResponse.json({ connected: false })

    const calendarId = await calendarioRegistrado(supabase, user.id)
    return NextResponse.json({
      connected:    true,
      calendarId,
      calendarName: calendarId ? await nombreEnGoogle(calendar, calendarId, user.id) : null,
    })
  } catch (err) {
    // Aquí cae sobre todo el refresco de token de un médico que revocó el
    // acceso desde su cuenta de Google.
    registrarFalloGCal({ operacion: 'calendars.get (estado para el perfil)', userId }, err)
    return NextResponse.json({ connected: false })
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
export async function POST() {
  let userId = 'sin-sesion'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    // OJO: no se gatea por `role === 'admin'`. Un médico dueño de su cuenta
    // tiene role='medico' con es_admin_de_clinica=true.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (!canManageClinica(profile)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const calendar = await getGCalClient(supabase, user.id)
    if (!calendar) {
      return NextResponse.json(
        { error: 'no_conectado', message: 'Conecta Google Calendar antes de recrear el calendario.' },
        { status: 400 },
      )
    }

    const anterior = await calendarioRegistrado(supabase, user.id)

    // 1. Los eventos del calendario viejo mueren con él: los vínculos se
    //    sueltan, las citas NO. Si esto no se puede, no se toca nada más.
    if (!await desvincularCitas(supabase, user.id)) {
      return NextResponse.json(
        { error: 'desvinculacion_fallida', message: 'No se pudieron soltar las citas. No se cambió nada.' },
        { status: 500 },
      )
    }

    // 2. Soltar el id ANTES de borrar en Google, no después.
    const { error: errNull } = await supabase
      .from('google_tokens')
      .update({ calendar_id: null })
      .eq('user_id', user.id)
    if (errNull) {
      registrarFalloGCal(
        { operacion: 'google_tokens.update(calendar_id=null)', userId: user.id, calendarId: anterior },
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
          // Queda vivo en la cuenta del médico, pero ya no es el de Spinus.
          // Se sigue adelante: el objetivo es que vuelva a tener uno bueno.
          registrarFalloGCal({ operacion: 'calendars.delete (recrear)', userId: user.id, calendarId: anterior }, err)
        }
      }
    }

    // 4. Mismo criterio de nombre y descripción que el callback.
    const nuevo = await crearCalendarioSpinus(supabase, user.id, calendar)
    if (!nuevo) {
      return NextResponse.json(
        { error: 'creacion_fallida', message: 'Se soltó el calendario anterior pero no se pudo crear el nuevo. Recarga la agenda y se creará solo.' },
        { status: 500 },
      )
    }

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
