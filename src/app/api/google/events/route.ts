import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  conCalendarioSpinus,
  registrarFalloGCal,
  esCredencialInvalida,
  type GCalCliente,
  type EstadoGoogle,
} from '@/lib/gcal'

/** Un hueco ocupado del calendario personal del médico. Sin título ni detalle. */
type BloqueOcupado = { start: string; end: string }

/**
 * Qué contestar cuando no hay eventos que devolver. Son dos situaciones que
 * hasta ahora se veían iguales (`connected: false`) y no lo son: sin token el
 * médico debe conectar, con token y Google caído no hay nada que pueda hacer.
 *
 * Ante la duda, 'sin_token': es el estado accionable y el que la interfaz
 * llevaba mostrando, así que equivocarse hacia ahí no estrena ningún camino.
 */
async function estadoDeFallo(
  supabase: Awaited<ReturnType<typeof createClient>> | null,
  userId: string,
  err?: unknown,
): Promise<EstadoGoogle> {
  if (err !== undefined && esCredencialInvalida(err)) return 'sin_token'
  if (!supabase) return 'sin_token'
  try {
    // La RLS de `google_tokens` acota por `user_id = auth.uid()`; aquí seguimos
    // dentro de la petición, así que el médico lee su propia fila y nada más.
    const { data } = await supabase
      .from('google_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    return data ? 'error_google' : 'sin_token'
  } catch {
    return 'sin_token'
  }
}

/**
 * Disponibilidad del calendario personal (`primary`) del médico, vía
 * `freebusy.query`: horarios ocupados, sin títulos ni asistentes ni nada más.
 * Es todo lo que autoriza el scope no sensible `calendar.events.freebusy`.
 *
 * Va en su propio try/catch a propósito. Un fallo aquí (el médico desmarcó la
 * casilla del permiso, o Google rechaza el alias) NO puede tumbar la respuesta
 * entera: el catch de afuera contestaría 'error_google' y la agenda se quedaría
 * sin eventos teniendo el calendario de Spinus sano. Degradar a "sin bloques"
 * es lo correcto.
 */
async function consultarOcupado(
  calendar: GCalCliente,
  timeMin: string,
  timeMax: string,
  userId: string,
): Promise<BloqueOcupado[]> {
  try {
    const { data } = await calendar.freebusy.query({
      requestBody: { timeMin, timeMax, items: [{ id: 'primary' }] },
    })
    const calendarios = data.calendars ?? {}
    // El alias `primary` no está documentado para freebusy: si Google devuelve
    // el calendario bajo otra llave (el correo de la cuenta), la tomamos igual
    // y dejamos rastro en el log para saberlo.
    let entrada = calendarios.primary
    if (!entrada) {
      const llaves = Object.keys(calendarios)
      if (llaves.length > 0) {
        // Las llaves son ids de calendario del médico, no datos de paciente.
        registrarFalloGCal(
          { operacion: 'freebusy.query (sin llave "primary")', userId },
          new Error(`llaves devueltas: ${llaves.join(', ')}`),
        )
        entrada = calendarios[llaves[0]]
      }
    }
    if (entrada?.errors?.length) {
      registrarFalloGCal(
        { operacion: 'freebusy.query (errores en el calendario personal)', userId },
        new Error(entrada.errors.map((e) => e.reason ?? 'sin reason').join(', ')),
      )
      return []
    }
    return (entrada?.busy ?? []).flatMap((hueco) =>
      hueco.start && hueco.end ? [{ start: hueco.start, end: hueco.end }] : []
    )
  } catch (err) {
    registrarFalloGCal({ operacion: 'freebusy.query', userId }, err)
    return []
  }
}

export async function GET(req: NextRequest) {
  // Los necesita el catch de afuera, donde `user`, el cliente y el calendario
  // resuelto ya no están a la vista.
  let userId = 'sin-sesion'
  let calendarIdUsado: string | null = null
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null

  try {
    supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const ahora = new Date()
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const timeMin = fromParam ?? new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const timeMax = toParam ?? new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString()

    // Dos fuentes, en paralelo dentro de la misma sesión de Google:
    //   1. El calendario propio de Spinus, con detalle completo.
    //   2. La disponibilidad del calendario personal, sin detalle alguno.
    //
    // La segunda va MEMOIZADA y fuera del cuerpo que se reintenta. Si el
    // calendario de Spinus da 404, `conCalendarioSpinus` lo recrea y vuelve a
    // correr la operación entera; pero `freebusy` consulta `primary`, que no
    // tiene nada que ver con el calendario caído y que ya respondió bien.
    // Guardando la promesa, el reintento repite sólo `events.list`, que es lo
    // único que depende del calendario recreado.
    //
    // Se guarda la promesa y no su resultado a propósito: así las dos siguen
    // saliendo en paralelo en la primera pasada. `consultarOcupado` nunca
    // rechaza —tiene su propio catch y degrada a lista vacía—, así que dejarla
    // sin await en el camino de error no deja ningún rechazo suelto.
    let ocupadoPromesa: Promise<BloqueOcupado[]> | null = null

    const eventos = await conCalendarioSpinus(supabase, user.id, async (calendar, calendarId) => {
      calendarIdUsado = calendarId
      // El reintento trae el mismo cliente de Google (misma sesión), así que
      // la promesa de la primera pasada sigue valiendo tal cual.
      ocupadoPromesa ??= consultarOcupado(calendar, timeMin, timeMax, user.id)
      const [lista] = await Promise.all([
        calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        }),
        ocupadoPromesa,
      ])
      return lista.data.items ?? []
    })
    // null = no hay sesión de Google (sin token) o no se pudo resolver el
    // calendario (Google falló al crearlo). Sólo lo segundo es un fallo.
    // Comparación explícita: una lista vacía de eventos SÍ es una respuesta.
    if (eventos === null) {
      return NextResponse.json({ estado: await estadoDeFallo(supabase, userId) })
    }

    // Deduplicación del lado del servidor: los eventos que ya son una cita de
    // Spinus se quitan aquí. La agenda pinta esas citas por su cuenta desde
    // /api/appointments, así que devolverlas otra vez las duplicaría — y el
    // cliente ya no necesita una segunda petición para averiguarlo.
    // La RLS acota `appointments` a la clínica del médico.
    const { data: citas } = await supabase
      .from('appointments')
      .select('google_event_id')
      .gte('start_time', timeMin)
      .lte('start_time', timeMax)
      .not('google_event_id', 'is', null)
    const yaSonCitas = new Set((citas ?? []).map((c) => c.google_event_id))

    return NextResponse.json({
      estado:  'conectado' satisfies EstadoGoogle,
      events:  eventos.filter((e) => !e.id || !yaSonCitas.has(e.id)),
      // No nula por construcción —el cuerpo de arriba corrió—, pero el
      // fallback evita depender de eso para el compilador.
      ocupado: ocupadoPromesa ? await ocupadoPromesa : [],
    })
  } catch (err) {
    registrarFalloGCal(
      { operacion: 'events.list (agenda)', userId, calendarId: calendarIdUsado },
      err,
    )
    // `err` entra en la cuenta para poder pescar el `invalid_grant`: ahí hay
    // fila en `google_tokens`, pero está muerta y toca reconectar.
    return NextResponse.json({
      estado: await estadoDeFallo(supabase, userId, err),
      error:  'Error al obtener eventos',
    })
  }
}
