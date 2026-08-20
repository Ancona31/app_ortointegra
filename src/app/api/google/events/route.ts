import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canVerAgendaCompleta, canManageClinica } from '@/lib/permissions'
import { resolverConexionClinica, type ConexionGoogle } from '@/lib/gcalConexion'
import {
  conCalendarioSpinus,
  registrarFalloGCal,
  esCredencialInvalida,
  type EstadoGoogle,
} from '@/lib/gcal'

/**
 * Los ÚNICOS campos del evento de Google que la agenda consume
 * (`agenda/page.tsx`, `gcalSource`). Todo lo demás del `Schema$Event` se queda
 * en el servidor: no viaja quien no se pinta.
 *
 * `start` y `end` conservan LAS DOS llaves a propósito. Un evento de día
 * completo no trae `dateTime`, sólo `date`; quedarse con la primera los dejaría
 * sin fecha de inicio y FullCalendar los descartaría sin decir nada. Los
 * eventos escritos a mano en Google son justo donde aparecen los de día
 * completo.
 */
type EventoAgenda = {
  id:       string
  summary?: string
  start?:   { dateTime?: string; date?: string }
  end?:     { dateTime?: string; date?: string }
}

/**
 * Tope de páginas de `events.list`. Con `maxResults: 250` son ~5.000 eventos.
 *
 * Existe por dos motivos distintos: un calendario con muchas recurrencias
 * expandidas por `singleEvents` podría encadenar decenas de páginas dentro de
 * una petición que la agenda espera síncrona, y un `nextPageToken` que no
 * avanzara sería un bucle infinito en producción.
 */
const TOPE_PAGINAS = 20

/**
 * Qué contestar cuando no hay eventos que devolver. Son dos situaciones que
 * hasta ahora se veían iguales (`connected: false`) y no lo son: sin conexión
 * hay que conectar, con conexión y Google caído no hay nada que hacer.
 *
 * La pregunta va POR CLÍNICA, no por usuario. Antes miraba si quien preguntaba
 * tenía fila en `google_tokens`, y con la conexión por clínica eso contestaría
 * 'sin_token' a una secretaria cuya clínica está perfectamente conectada.
 *
 * Ante la duda, 'sin_token': es el estado accionable y el que la interfaz
 * llevaba mostrando, así que equivocarse hacia ahí no estrena ningún camino.
 */
function estadoDeFallo(conexion: ConexionGoogle | null, err?: unknown): EstadoGoogle {
  // Atajo: esta misma petición acaba de descubrir que la credencial está muerta.
  // No hace falta preguntar por la conexión, que a estas alturas puede seguir
  // marcada activa porque el marcado corre en paralelo.
  if (err !== undefined && esCredencialInvalida(err)) return 'sin_token'
  return conexion ? 'error_google' : 'sin_token'
}

export async function GET(req: NextRequest) {
  // Los necesita el catch de afuera, donde `user` y el calendario resuelto ya
  // no están a la vista.
  let userId = 'sin-sesion'
  let calendarIdUsado: string | null = null
  // La necesita el catch de afuera para distinguir 'error_google' de
  // 'sin_token'. Si la resolución misma revienta se queda en null, y eso
  // contesta 'sin_token', que es el fallo hacia el lado accionable.
  let conexion: ConexionGoogle | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    userId = user.id

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // CORTE ANTICIPADO — el vacío del médico invitado, y es estructural.
    //
    // Este carril devuelve el calendario de la CLÍNICA, y lo que sobrevive al
    // filtro de abajo son los eventos que el administrador escribió a mano.
    // Sólo administrador y secretaria los ven; el médico invitado recibe vacío
    // y sigue viendo sus citas por /api/appointments bajo RLS.
    //
    // El vacío NO puede derivarse de "el invitado no tiene conexión que
    // resolver": la policy de `clinica_conexiones_google` filtra por clínica y
    // no por usuario, así que un invitado resuelve la conexión igual que el
    // administrador. De ahí que la puerta sea un helper de capacidad, y de ahí
    // que sea lista blanca: un rol futuro cae en vacío por construcción.
    //
    // Se contesta 'conectado' sin haber comprobado nada, y se acepta: ningún
    // consumidor usa ese valor para decidir nada (la agenda sólo distingue
    // "pinta eventos" de "no pintes"), y quien informa del estado real de la
    // conexión es /perfil por otra ruta. Estrenar un cuarto valor en
    // `EstadoGoogle` tocaría un tipo compartido para una distinción que nadie
    // consume. Cortar aquí evita además abrir una sesión de Google para tirar
    // el resultado.
    if (!canVerAgendaCompleta(profile)) {
      return NextResponse.json({ estado: 'conectado' satisfies EstadoGoogle, events: [] })
    }

    const ahora = new Date()
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const timeMin = fromParam ?? new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const timeMax = toParam ?? new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString()

    // La conexión se resuelve con el cliente de SESIÓN y antes de nada más; el
    // admin sólo entra a partir de aquí, para que `conCalendarioSpinus` pueda
    // leerle los tokens a la cuenta de la clínica.
    conexion = await resolverConexionClinica(supabase, profile.clinica_id)
    // Quien no administra la clínica opera en modo estricto: si el calendario
    // falta o Google contesta 404, esta ruta NO lo crea ni desvincula nada.
    // Abrir la agenda no puede ser el disparador de una escritura masiva en
    // citas ajenas ni de un calendario nuevo en la cuenta de otra persona.
    const puedeReparar = canManageClinica(profile)
    const admin = createAdminClient()

    const eventos = await conCalendarioSpinus(conexion, admin, async (calendar, calendarId) => {
      calendarIdUsado = calendarId

      // EL ACUMULADOR VA DENTRO DEL CALLBACK, NUNCA FUERA. `conCalendarioSpinus`
      // reejecuta la operación ENTERA si el calendario responde 404: lo recrea y
      // vuelve a llamar aquí (`gcal.ts:451`). Un array declarado fuera sumaría
      // las páginas de la primera pasada más las del reintento y cada evento se
      // pintaría dos veces.
      const acumulados: EventoAgenda[] = []
      let pageToken: string | undefined
      let paginas = 0

      do {
        const { data } = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          // Con el bucle esto deja de ser un techo y pasa a ser tamaño de
          // página. 250 es el máximo que admite la API.
          maxResults: 250,
          pageToken,
        })
        for (const e of data.items ?? []) {
          // Con `singleEvents` Google puede devolver instancias canceladas de
          // series recurrentes. No se pintan, así que no se copian.
          if (!e.id || e.status === 'cancelled') continue
          acumulados.push({
            id:      e.id,
            summary: e.summary ?? undefined,
            start:   { dateTime: e.start?.dateTime ?? undefined, date: e.start?.date ?? undefined },
            end:     { dateTime: e.end?.dateTime   ?? undefined, date: e.end?.date   ?? undefined },
          })
        }
        pageToken = data.nextPageToken ?? undefined
        paginas++
      } while (pageToken && paginas < TOPE_PAGINAS)

      // Tocar el tope significa que SEGUIMOS perdiendo eventos en silencio, que
      // es exactamente lo que el bucle viene a evitar. Sin este registro, el
      // tope es el mismo defecto con otro número.
      if (pageToken) {
        registrarFalloGCal(
          { operacion: 'events.list (agenda, tope de páginas alcanzado)', userId, calendarId },
          new Error(`${TOPE_PAGINAS} páginas recorridas y Google sigue devolviendo nextPageToken`),
        )
      }

      return acumulados
    }, { puedeReparar, actorId: user.id })
    // null = la clínica no tiene conexión activa, no se pudo resolver el
    // calendario, o el modo estricto se negó a crearlo. Comparación explícita:
    // una lista vacía de eventos SÍ es una respuesta.
    if (eventos === null) {
      return NextResponse.json({ estado: estadoDeFallo(conexion) })
    }

    // RESTA acotada por capacidad, NO intersección. Lo que queda después de
    // quitar los eventos que ya son cita de Spinus son los que el administrador
    // escribió a mano en el calendario de la clínica: no tienen fila en
    // `appointments` y ninguna otra fuente los trae. Intersecar los borraría.
    //
    // El conjunto que se resta tiene que ser TODAS las citas de la clínica. La
    // fuga original no venía de restar: venía de restar contra un conjunto
    // parcial. Aquí sólo llegan administrador y secretaria (corte de arriba), y
    // `appointments_select` les da todas las de su clínica, así que la resta es
    // completa y no queda ninguna cita ajena colándose como evento crudo con el
    // nombre del paciente en el título.
    //
    // El `.eq('clinica_id')` es redundante frente a la RLS y va explícito de
    // todos modos: deja la barrera escrita para quien mañana cambie el cliente.
    //
    // La ventana se compara por SOLAPE, no por `start_time` dentro del rango.
    // `events.list` devuelve todo evento que solape la ventana (`timeMin` es
    // cota inferior del FIN del evento); filtrar las citas sólo por su inicio
    // dejaría fuera del conjunto a la que empezó antes de `timeMin` y termina
    // dentro, y esa cita saldría sin restar.
    const { data: citas } = await supabase
      .from('appointments')
      .select('google_event_id')
      .eq('clinica_id', profile.clinica_id)
      .lte('start_time', timeMax)
      .gte('end_time', timeMin)
      .not('google_event_id', 'is', null)
    const yaSonCitas = new Set((citas ?? []).map((c) => c.google_event_id))

    return NextResponse.json({
      estado: 'conectado' satisfies EstadoGoogle,
      events: eventos.filter((e) => !yaSonCitas.has(e.id)),
    })
  } catch (err) {
    registrarFalloGCal(
      { operacion: 'events.list (agenda)', userId, conexionId: conexion?.id, calendarId: calendarIdUsado },
      err,
    )
    // `err` entra en la cuenta para poder pescar el `invalid_grant`: ahí hay
    // conexión, pero está muerta y toca reconectar.
    return NextResponse.json({
      estado: estadoDeFallo(conexion, err),
      error:  'Error al obtener eventos',
    })
  }
}
