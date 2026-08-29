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

/** Forma de un UUID, para validar el `medico_id` que llega por parámetro. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    // ── FILTRO DE MÉDICO ──────────────────────────────────────────────────
    // Lo que esta ruta devuelve son los eventos que alguien escribió A MANO en
    // el calendario de la clínica, y PERTENECEN A QUIEN CONECTÓ GOOGLE: la
    // cuenta que los organiza es la suya. Con el filtro de la agenda puesto en
    // otro médico no son suyos, así que no se pintan; sin filtro ('todos los
    // médicos') o con el filtro en el propio conector, sí.
    //
    // Antes de esto la agenda no filtraba estos eventos EN ABSOLUTO: filtrando
    // por el Dr. X aparecían encima de sus horas los eventos del administrador
    // y su hueco libre parecía ocupado.
    //
    // ⚠️ EL PRECIO, ACEPTADO A SABIENDAS: se cambia un FALSO OCUPADO para todos
    // por un FALSO LIBRE para el médico al que el bloque le concierne. Si el
    // administrador escribe «Junta Dr. Pérez 16:00-17:00» en el calendario
    // compartido, filtrando por el Dr. Pérez ese hueco sale LIBRE y alguien
    // puede agendarle encima; antes se veía —mal atribuido, pero se veía—. El
    // evento no dice a quién concierne: Google sólo sabe qué cuenta lo organiza,
    // y ésa es la del conector. Esto NO es un defecto pendiente de arreglar aquí;
    // atribuir un evento suelto a un médico exige que el evento lo diga, que es
    // otro cambio. Si alguien lo reporta como bug nuevo, es esta línea.
    //
    // POR QUÉ EL CORTE VA EN EL SERVIDOR Y NO EN EL NAVEGADOR. Tres razones, y
    // la primera es la que decide:
    //  1. Se ahorra la sesión con Google ENTERA —OAuth + `events.list` con su
    //     paginación— cuando el filtro no es del conector. Filtrar en el
    //     cliente pagaría esa llamada para tirar el resultado.
    //  2. La regla queda escrita al lado de la resta contra `appointments`,
    //     que es el otro sitio donde se decide qué evento sobrevive; quien
    //     venga a cambiar una va a leer la otra.
    //  3. NO baja al navegador el `user_id` de nadie. Lo único que sube es el
    //     `medico_id` del filtro, que el cliente ya tiene porque él lo eligió;
    //     lo que baja es la lista, vacía o no.
    //
    // ⚠️ LA COMPARACIÓN VA POR `clinica_conexiones_google.user_id` —el usuario
    // de SPINUS que conectó Google— Y NUNCA POR `google_account_email`. NO LO
    // "CORRIJAS": son dos identidades distintas y no tienen por qué coincidir.
    // Hay quien entra a Spinus con un correo y conectó Google con otro; comparar
    // por correo lo dejaría fuera de su propio calendario, que es justo el fallo
    // que este bloque viene a evitar. El filtro de la agenda ofrece `profiles`,
    // o sea usuarios de Spinus, así que `user_id` es lo único con lo que ese
    // valor es comparable.
    //
    // (No confundir con la comparación POR CORREO que hace falta en otro sitio,
    // para saber si Google le manda invitación a alguien: eso depende de qué
    // cuenta de Google organiza el evento. La pregunta de aquí es otra: de quién
    // son estos eventos DENTRO de Spinus.)
    //
    // NO AÑADE NINGUNA CONSULTA. `conexion` ya está resuelta arriba porque esta
    // ruta la necesita igual para leer los tokens, y `userId` viene en ella. Si
    // alguien se encuentra escribiendo un `SELECT` nuevo aquí, la solución es la
    // equivocada. Y sin lectura nueva no hay `createAdminClient()` nuevo que
    // filtrar por `clinica_id` (pendiente prioritario de CLAUDE.md); el admin de
    // abajo sigue leyendo sólo los tokens de esta conexión ya resuelta.
    //
    // ⚠️ LA PREMISA NO ESTÁ GARANTIZADA, y también se acepta: que el conector
    // sea FILTRABLE. El desplegable de la agenda se llena con /api/me/config,
    // que sólo devuelve perfiles con `role='medico'` de la clínica. Si quien
    // conectó Google no lo es —una secretaria administradora, un administrador
    // que no pasa consulta—, su `user_id` no aparece nunca como opción, así que
    // sus eventos sólo se ven en «Todos los médicos» y no hay filtro que los
    // traiga de vuelta. La interfaz no lo explica. NO lo cubras con más código
    // aquí: el gate está bien, lo que falta es que el conector sea elegible, y
    // eso se decide en el desplegable, no en esta comparación.
    //
    // Va DESPUÉS del corte de `canVerAgendaCompleta`, que no se toca: aquél es
    // lista blanca por capacidad y devuelve vacío al médico invitado pase lo que
    // pase. Este es un filtro de pertenencia, y sólo lo alcanza quien ya pasó
    // aquél.
    const medicoFiltro = req.nextUrl.searchParams.get('medico_id')
    // Cadena VACÍA cuenta como ausencia, y por eso la guarda es el valor y no
    // `!== null`: `medico_id=` sin valor devuelve `''`, no `null`, y significa
    // «todos los médicos». Comprobarle el formato lo convertiría en un 400 para
    // quien arme la URL a mano o escriba un test, por decir lo mismo que no
    // mandar el parámetro.
    if (medicoFiltro) {
      // El formato se valida ANTES de tocarlo, aunque sólo se compare. El 400
      // es para quien llame a esta ruta directamente: la agenda no mira
      // `res.ok` y pinta lo mismo —nada— con cualquier respuesta que no traiga
      // `estado: 'conectado'`, y así se queda a propósito (no hay forma de
      // llegar aquí desde la interfaz, y un `failure()` estrenaría un error
      // visible de FullCalendar donde hoy no hay ninguno).
      // El valor NO se usa para nada más que la comparación de abajo — no entra
      // en ninguna consulta ni sale en ninguna respuesta.
      if (!UUID_RE.test(medicoFiltro)) {
        return NextResponse.json({ error: 'medico_id_invalido' }, { status: 400 })
      }
      // Se comparan en minúsculas los dos lados: un UUID es el mismo escrito
      // como sea, y Postgres los emite en minúscula. Comparar en crudo dejaría
      // al conector sin sus propios eventos si el valor llega en mayúsculas
      // —hoy sale del `<select>` y no pasa, pero el fallo sería silencioso—.
      //
      // `conexion === null` se deja pasar a propósito: ahí no hay dueño contra
      // quien comparar y el camino de abajo ya contesta 'sin_token', que es el
      // estado accionable. Contestar 'conectado' aquí lo taparía.
      if (conexion !== null && medicoFiltro.toLowerCase() !== conexion.userId.toLowerCase()) {
        return NextResponse.json({ estado: 'conectado' satisfies EstadoGoogle, events: [] })
      }
    }

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
    //
    // ── NO SE PUEDE ACOTAR MÁS, Y EL FILTRO DE MÉDICO ES LA TENTACIÓN ──────
    // La agenda viene filtrada por médico y esta resta NO, a propósito. Lo que
    // Google devuelve arriba es el calendario ENTERO de la clínica, así que
    // entre esos eventos están las citas de TODOS los médicos; restar sólo las
    // del médico filtrado dejaría las ajenas sin restar y saldrían pintadas
    // como evento crudo de Google, con el nombre del paciente en el título. Es
    // exactamente la fuga del párrafo de arriba, reintroducida por el otro
    // lado. El caso peor no es «todos los médicos»: es justo el FILTRADO, donde
    // el conjunto que se resta y el que se pinta dejan de coincidir.
    // La única otra acotación posible sería `.in('google_event_id', …)` con los
    // ids que Google acaba de devolver — hasta 5.000 en la URL de un GET, y
    // truncable igual. No compensa.

    // ── SIN EVENTOS NO HAY NADA QUE RESTAR ────────────────────────────────
    // Además de ahorrar la consulta (con su COUNT exacto) en toda clínica que
    // no escribe eventos a mano, evita que la guarda de abajo levante la banda
    // violeta por un conjunto incompleto que no podía duplicar nada.
    if (eventos.length === 0) {
      return NextResponse.json({ estado: 'conectado' satisfies EstadoGoogle, events: [] })
    }

    // ⚠️ EL `count` NO ES UNA MÉTRICA: ES LA GUARDA DEL TRUNCADO SILENCIOSO.
    // NO LO QUITES, Y NO LE PONGAS UN `.limit()` EN SU LUGAR.
    //
    // El techo de filas del proveedor es DURO y GLOBAL (mil por respuesta): no
    // se sube desde la consulta, y cuando se alcanza la respuesta llega
    // recortada SIN error y sin aviso. Un `.limit()` no lo supera; sólo lo
    // baja. Aquí eso no se traduce en «faltan datos» sino en algo peor: cada
    // cita que no entró en el conjunto NO se resta, y se pinta DOS VECES —una
    // como cita de Spinus y otra como evento crudo de Google, esta segunda CON
    // EL NOMBRE DEL PACIENTE en el título—. No se parece a un problema de
    // carga, así que se diagnostica tarde y por el peor sitio.
    //
    // `count: 'exact'` viene del `Content-Range` y cuenta las filas que
    // CUMPLEN el filtro, no las que caben en la respuesta. Si sobran filas,
    // el conjunto está incompleto y la resta no es de fiar.
    const { data: citas, count: totalCitas, error: errorCitas } = await supabase
      .from('appointments')
      .select('google_event_id', { count: 'exact' })
      .eq('clinica_id', profile.clinica_id)
      .lte('start_time', timeMax)
      .gte('end_time', timeMin)
      .not('google_event_id', 'is', null)

    // Las cuatro ramas son el MISMO fallo: no hay conjunto completo contra el
    // que restar. El `citas ?? []` que había aquí se tragaba las tres primeras
    // —consulta rota, RLS, cuerpo ilegible— y restaba contra el conjunto vacío,
    // que es la duplicación de TODA la agenda de una vez.
    //
    // ⚠️ SE ELIGE NO PINTAR LOS EVENTOS DE GOOGLE, no avisar y seguir. Con el
    // conjunto incompleto no se sabe CUÁLES son las citas que faltan por
    // restar, así que no hay media respuesta correcta que dar: o se pintan
    // todos los eventos crudos —con las duplicadas y su PII dentro— o ninguno.
    // Se contesta 'error_google', que la agenda ya sabe pintar: la banda
    // violeta del bloque 9 dice literalmente «Tus citas se muestran normal;
    // faltan los eventos del calendario», que es exactamente lo que pasa. Las
    // citas propias no se tocan: viajan por /api/appointments, por otra fuente.
    if (errorCitas || citas === null || totalCitas === null || totalCitas > citas.length) {
      registrarFalloGCal(
        { operacion: 'resta de citas (agenda, conjunto incompleto)', userId, calendarId: calendarIdUsado },
        errorCitas ?? new Error(
          `la resta necesita ${totalCitas ?? 'un conteo que no llegó'} citas con google_event_id y llegaron ${citas?.length ?? 0}`,
        ),
      )
      return NextResponse.json({ estado: 'error_google' satisfies EstadoGoogle })
    }

    const yaSonCitas = new Set(citas.map((c) => c.google_event_id))

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
