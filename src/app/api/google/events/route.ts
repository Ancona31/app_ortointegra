import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conCalendarioSpinus, GCAL_TIMEZONE } from '@/lib/gcal'
import { anonimizarTexto } from '@/lib/anonimizar'

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

    const respuesta = await conCalendarioSpinus(supabase, user.id, (calendar, calendarId) =>
      calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      })
    )
    if (!respuesta) return NextResponse.json({ connected: false })

    return NextResponse.json({ connected: true, events: respuesta.data.items || [] })
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
