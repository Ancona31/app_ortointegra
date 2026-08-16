import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conCalendarioSpinus, GCAL_TIMEZONE, type GCalCliente } from '@/lib/gcal'
import { anonimizarTexto } from '@/lib/anonimizar'

/** Un hueco ocupado del calendario personal del médico. Sin título ni detalle. */
type BloqueOcupado = { start: string; end: string }

/**
 * Disponibilidad del calendario personal (`primary`) del médico, vía
 * `freebusy.query`: horarios ocupados, sin títulos ni asistentes ni nada más.
 * Es todo lo que autoriza el scope no sensible `calendar.events.freebusy`.
 *
 * Va en su propio try/catch a propósito. Un fallo aquí (el médico desmarcó la
 * casilla del permiso, o Google rechaza el alias) NO puede tumbar la respuesta
 * entera: el catch de afuera devolvería `connected: false` y la agenda y el
 * perfil se verían desconectados de Google teniendo el calendario sano.
 * Degradar a "sin bloques" es lo correcto.
 */
async function consultarOcupado(
  calendar: GCalCliente,
  timeMin: string,
  timeMax: string,
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
        console.error('[GCal] freebusy no devolvió la llave "primary"; llegó:', llaves.join(', '))
        entrada = calendarios[llaves[0]]
      }
    }
    if (entrada?.errors?.length) {
      console.error('[GCal] freebusy devolvió errores en el calendario personal')
      return []
    }
    return (entrada?.busy ?? []).flatMap((hueco) =>
      hueco.start && hueco.end ? [{ start: hueco.start, end: hueco.end }] : []
    )
  } catch {
    console.error('[GCal] freebusy.query falló sobre el calendario personal')
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const ahora = new Date()
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const timeMin = fromParam ?? new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const timeMax = toParam ?? new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString()

    // Dos fuentes, en paralelo dentro de la misma sesión de Google:
    //   1. El calendario propio de Spinus, con detalle completo.
    //   2. La disponibilidad del calendario personal, sin detalle alguno.
    const respuesta = await conCalendarioSpinus(supabase, user.id, async (calendar, calendarId) => {
      const [lista, ocupado] = await Promise.all([
        calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        }),
        consultarOcupado(calendar, timeMin, timeMax),
      ])
      return { eventos: lista.data.items ?? [], ocupado }
    })
    if (!respuesta) return NextResponse.json({ connected: false })

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
      connected: true,
      events:    respuesta.eventos.filter((e) => !e.id || !yaSonCitas.has(e.id)),
      ocupado:   respuesta.ocupado,
    })
  } catch {
    return NextResponse.json({ connected: false, error: 'Error al obtener eventos' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { eventId } = await req.json()
    if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 })

    const borrado = await conCalendarioSpinus(supabase, user.id, (calendar, calendarId) =>
      calendar.events.delete({ calendarId, eventId })
    )
    if (borrado === null) return NextResponse.json({ error: 'Calendar no conectado' }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { titulo, descripcion, todoDia, fecha, inicio, fin, zona, emailMedico } = await req.json()
    if (!titulo) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

    const timeZone = zona ?? GCAL_TIMEZONE

    const creado = await conCalendarioSpinus(supabase, user.id, (calendar, calendarId) =>
      calendar.events.insert({
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
    )
    if (!creado) return NextResponse.json({ error: 'Calendar no conectado' }, { status: 400 })

    return NextResponse.json({ ok: true, evento: creado.data })
  } catch {
    return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 })
  }
}
