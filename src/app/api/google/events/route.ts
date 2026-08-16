import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  conCalendarioSpinus,
  registrarFalloGCal,
  esCredencialInvalida,
  GCAL_TIMEZONE,
  type GCalCliente,
  type EstadoGoogle,
} from '@/lib/gcal'
import { anonimizarTexto } from '@/lib/anonimizar'

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
    const respuesta = await conCalendarioSpinus(supabase, user.id, async (calendar, calendarId) => {
      calendarIdUsado = calendarId
      const [lista, ocupado] = await Promise.all([
        calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        }),
        consultarOcupado(calendar, timeMin, timeMax, user.id),
      ])
      return { eventos: lista.data.items ?? [], ocupado }
    })
    // null = no hay sesión de Google (sin token) o no se pudo resolver el
    // calendario (Google falló al crearlo). Sólo lo segundo es un fallo.
    if (!respuesta) {
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
      events:  respuesta.eventos.filter((e) => !e.id || !yaSonCitas.has(e.id)),
      ocupado: respuesta.ocupado,
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

export async function DELETE(req: NextRequest) {
  let userId = 'sin-sesion'
  let calendarIdUsado: string | null = null
  let eventIdUsado: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const { eventId } = await req.json()
    if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 })
    eventIdUsado = eventId

    const borrado = await conCalendarioSpinus(supabase, user.id, (calendar, calendarId) => {
      calendarIdUsado = calendarId
      return calendar.events.delete({ calendarId, eventId })
    })
    if (borrado === null) return NextResponse.json({ error: 'Calendar no conectado' }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    registrarFalloGCal(
      { operacion: 'events.delete', userId, calendarId: calendarIdUsado, eventId: eventIdUsado },
      err,
    )
    return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let userId = 'sin-sesion'
  let calendarIdUsado: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const { titulo, descripcion, todoDia, fecha, inicio, fin, zona, emailMedico } = await req.json()
    if (!titulo) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

    const timeZone = zona ?? GCAL_TIMEZONE

    const creado = await conCalendarioSpinus(supabase, user.id, (calendar, calendarId) => {
      calendarIdUsado = calendarId
      return calendar.events.insert({
        calendarId,
        sendUpdates: 'all',
        // PRIVACIDAD — LFPDPPP: anonimizar título y descripción antes de enviar a Google.
        // Este camino es texto libre que el médico escribe en CalendarWidget, no
        // una cita con paciente ligado: aquí la anonimización se queda.
        requestBody: {
          summary: anonimizarTexto(titulo),
          description: descripcion ? anonimizarTexto(descripcion) : undefined,
          start: todoDia ? { date: fecha } : { dateTime: inicio, timeZone },
          end:   todoDia ? { date: fecha } : { dateTime: fin,   timeZone },
          ...(emailMedico ? { attendees: [{ email: emailMedico }] } : {}),
        },
      })
    })
    if (!creado) return NextResponse.json({ error: 'Calendar no conectado' }, { status: 400 })

    return NextResponse.json({ ok: true, evento: creado.data })
  } catch (err) {
    registrarFalloGCal(
      { operacion: 'events.insert (evento suelto)', userId, calendarId: calendarIdUsado },
      err,
    )
    return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 })
  }
}
