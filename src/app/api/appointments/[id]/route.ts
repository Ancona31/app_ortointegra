import type { calendar_v3 } from 'googleapis'
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, registrarFalloGCal } from '@/lib/gcal'
import { resolverConexionClinica, type ConexionGoogle } from '@/lib/gcalConexion'
import { canManageClinica } from '@/lib/permissions'
import { APPOINTMENT_SELECT, eventoParaGoogle, puntasParaGoogle, componerAsistentes, INTERRUPTORES_INVITADOS,
         ICONOS_EVENTO, COLORES_EVENTO, pintaValida,
         type ClinicaEnCita, type PacienteEnCita } from '@/lib/appointments'
import { correoDelMedico } from '@/lib/medicoCorreo'
import { TZ_CLINICA, desplazarFecha, fechaHoraLocalAInstante, renderEnTZ } from '@/lib/dates'

/* Una fecha-solo `YYYY-MM-DD` QUE ADEMÁS EXISTE EN EL CALENDARIO: la forma no
   basta, porque `2026-02-30` la pasa y el motor la DESBORDA al 2 de marzo en vez
   de rechazarla, así que llegaría viva hasta `fechaHoraLocalAInstante` y saldría
   como 500. De ahí el ida y vuelta por `toISOString`.
   Espejo del POST; el razonamiento entero está allí. */
const FECHA_SOLA = /^\d{4}-\d{2}-\d{2}$/

function esFechaDeCalendario(valor: string): boolean {
  if (!FECHA_SOLA.test(valor)) return false
  const instante = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(instante.getTime()) && instante.toISOString().startsWith(valor)
}

/**
 * FIJA EL EVENTO RECIÉN CREADO POR LA REPARACIÓN — O LO DESHACE SI PERDIÓ.
 *
 * ⚠️ EL `.is('google_event_id', null)` ES UN CANDADO, NO UN FILTRO DE ADORNO.
 * La reparación corre dentro de `after()`, o sea DESPUÉS de responder, así que
 * dos ediciones seguidas de la misma fila huérfana pueden solaparse: las dos
 * leen `google_event_id` en null, las dos crean, y el médico acaba con la cita
 * DUPLICADA en su calendario. El chequeo de concurrencia del PUT no lo cubre —
 * lo dispara `updated_at`, que el modal manda pero el arrastre NO
 * (`agenda/page.tsx`, «Sin updated_at — drag & drop no requiere chequeo»).
 *
 * Así que la escritura del identificador es un COMPARE-AND-SWAP: sólo entra si
 * la columna sigue vacía. Quien llega segundo no pisa nada, se entera por el
 * conteo de filas y borra el evento que acababa de crear. Gana el primero, y
 * en Google queda uno.
 *
 * `select('id')` no es curiosidad: sin él PostgREST no dice cuántas filas tocó,
 * y perder la carrera es indistinguible de ganarla.
 *
 * El borrado va con `sendUpdates: 'none'` y `puedeReparar: false`: es basura
 * nuestra de hace un segundo, nadie ha tenido tiempo de verla y desde luego no
 * hay que avisar a nadie de que se cancela. Y si el borrado falla, se registra
 * y se sigue: el duplicado en Google es feo, perder la respuesta buena sería
 * peor.
 */
async function fijarEventoCreado(
  admin: ReturnType<typeof createAdminClient>,
  conexion: ConexionGoogle,
  datos: {
    appointmentId: string
    clinicaId: string
    userId: string
    googleEventId: string | null
    estado: 'synced' | 'failed'
    calendarId: string | null
  },
): Promise<void> {
  const { data: fijadas, error } = await admin
    .from('appointments')
    .update({
      google_event_id:  datos.googleEventId,
      gcal_sync_status: datos.estado,
      gcal_calendar_id: datos.calendarId,
    })
    .eq('id', datos.appointmentId)
    .eq('clinica_id', datos.clinicaId)
    .is('google_event_id', null)
    .select('id')

  if (error) {
    registrarFalloGCal(
      { operacion: 'appointments.update(reparación gcal)', userId: datos.userId, conexionId: conexion.id, calendarId: datos.calendarId },
      error,
    )
    return
  }
  if ((fijadas?.length ?? 0) > 0 || !datos.googleEventId) return

  // Perdimos la carrera: otra escritura ya dejó su identificador en la fila.
  const eventId = datos.googleEventId
  try {
    await conCalendarioSpinus(conexion, admin, (calendar, calendarId) =>
      calendar.events.delete({ calendarId, eventId, sendUpdates: 'none' }),
      { puedeReparar: false, actorId: datos.userId },
    )
  } catch (err) {
    registrarFalloGCal(
      { operacion: 'events.delete (duplicado de reparación)', userId: datos.userId, conexionId: conexion.id, calendarId: datos.calendarId, eventId },
      err,
    )
  }
}

/* Formato UUID. A nivel de módulo porque lo usan el PUT (consultorio y
   client_id) y el GET; antes vivía dentro del bloque de consultorio del PUT. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ── GET /api/appointments/[id] ─────────────────────────────
 * Una cita, con la MISMA forma que devuelven el GET del rango, el POST y el
 * PUT (`APPOINTMENT_SELECT`). Esa forma única es el punto: la agenda arma sus
 * tarjetas a partir de ella, y un segundo camino para leer una cita acabaría
 * produciendo tarjetas sutilmente distintas según por dónde llegó el dato.
 *
 * Quien la consume es el canal de Realtime: el payload de `postgres_changes`
 * trae sólo columnas de `appointments`, sin el join del paciente que la
 * tarjeta necesita para el nombre. Una cita, no un rango.
 *
 * Sin filtro explícito de clínica: la RLS de `appointments_select` ya acota
 * por `clinica_id` (y por médico, para el invitado). Si la cita no es visible
 * para quien pregunta, no llega fila y esto responde 404 — que es justo lo que
 * debe ver.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/appointments/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'id_invalido' }, { status: 400 })
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error)       return NextResponse.json({ error: error.message },   { status: 500 })
    if (!appointment) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    return NextResponse.json({ appointment })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── PUT /api/appointments/[id] ─────────────────────────── */
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/appointments/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id, role, es_admin_de_clinica').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json()
    const { title, start_time, end_time, all_day, all_day_desde, all_day_hasta, paciente_id, notes, status, medico_id, consultorio_id, updated_at: clientUpdatedAt, client_id, icono, color } = body

    // RLS filtra por clinica_id
    /* `status`, `start_time`, `end_time` y `paciente_id` no se leían aquí y ahora
       hacen falta: son el ANTES contra el que se decide si Google tiene que
       avisar a alguien. Sin `status`, editar las notas de una cita ya cancelada
       volvería a mandarle la cancelación al paciente en cada guardado.

       ⚠️ `consultorio_timezone` ES LA ZONA CON LA QUE SE COMPONE LA MEDIANOCHE
       de un evento de todo el día, y viene de AQUÍ y no del bloque de
       consultorio de más abajo: ese bloque sólo corre cuando el cuerpo trae
       `consultorio_id`, y el modal sólo lo manda cuando el consultorio CAMBIÓ.
       Sin esta columna, mover la fecha de un evento de todo el día sin tocar el
       consultorio dejaba al servidor sin huso.

       ⚠️ `all_day` ES EL ANTES DEL INTERRUPTOR, y hace falta por lo mismo que
       `paciente_id` —que ya estaba—: en un PUT los dos campos VIAJAN POR
       SEPARADO, así que la comprobación de que no coincidan tiene que hacerse
       sobre los valores EFECTIVOS, y el que no venga en el cuerpo sale de aquí.
       Sin esta columna, un PUT que sólo mandara `paciente_id` sobre una fila que
       ya es de todo el día no vería el conflicto. */
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id, gcal_sync_status, updated_at, medico_id, status, start_time, end_time, paciente_id, consultorio_timezone, all_day')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    if (clientUpdatedAt && existing.updated_at !== clientUpdatedAt) {
      return NextResponse.json(
        { error: 'Esta cita fue modificada por otro usuario recientemente. Recarga para ver los cambios.' },
        { status: 409 }
      )
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title       !== undefined) updates.title       = title
    if (start_time  !== undefined) updates.start_time  = start_time
    if (end_time    !== undefined) updates.end_time    = end_time
    if (paciente_id !== undefined) updates.paciente_id = paciente_id || null
    if (notes       !== undefined) updates.notes       = notes || null
    if (status      !== undefined) updates.status      = status

    /* ── EL INTERRUPTOR SE ANOTA AQUÍ; LAS DOS PUNTAS SE COMPONEN ABAJO ──────
       La bandera es un booleano suelto y no depende de nada, así que va con el
       resto de campos. La composición de la medianoche NO puede estar aquí, y
       estuvo: necesita la zona horaria EFECTIVA de la fila, y ésa no se conoce
       hasta que el bloque de consultorio haya decidido si esta edición cambia
       de consultorio —lo que ocurre 190 líneas más abajo—. Compuesta aquí, un
       cuerpo con `all_day: true` Y `consultorio_id` dejaba las puntas en la
       zona VIEJA y la columna `consultorio_timezone` en la NUEVA, y el CHECK
       de la base las compara entre sí: 23514 y 500 crudo.

       Vive ahora justo después de ese bloque, con el porqué entero al lado.
       NO LA SUBAS DE VUELTA. */
    if (all_day !== undefined) updates.all_day = all_day === true

    /* ── TODO EL DÍA Y PACIENTE NO PUEDEN IR JUNTOS ──────────────────────────
       El razonamiento entero está en el POST, y es el mismo: la regla es de
       producto —«todo el día» sólo existe para EVENTOS, y una cita siempre lleva
       hora—, la interfaz ya la impone deshabilitando el conmutador «Cita», y
       esto es el segundo cerrojo porque la base no la conoce: el CHECK de la
       columna mira las puntas y el huso, no `paciente_id`. Una fila con las dos
       cosas entraría sin romper nada, que es justo por lo que nadie la vería.

       ⚠️ AQUÍ SE COMPARAN LOS VALORES EFECTIVOS Y NO LO QUE TRAE EL CUERPO. En
       un PUT cada campo viaja por su cuenta, así que hay tres formas de llegar a
       la fila incoherente y sólo una manda las dos cosas juntas: encender
       `all_day` sobre una cita sin nombrar al paciente, o colgarle un paciente a
       un evento de todo el día sin nombrar el interruptor. Lo que no viene en el
       cuerpo sale de `existing`, y `paciente_id` se normaliza con el MISMO
       `|| null` que usa el `updates` de arriba para que la cadena vacía no
       cuente como paciente en un sitio y sí en el otro. */
    const todoElDiaEfectivo = all_day !== undefined ? all_day === true : existing.all_day === true
    const pacienteEfectivo  = paciente_id !== undefined ? (paciente_id || null) : existing.paciente_id
    if (todoElDiaEfectivo && pacienteEfectivo) {
      return NextResponse.json(
        { error: 'todo_el_dia_con_paciente', message: 'Un evento de todo el día no puede ser una cita: una cita siempre lleva hora.' },
        { status: 400 }
      )
    }

    /* EL FIN DESPUÉS DEL INICIO, sobre los valores EFECTIVOS. `start_time` y
       `end_time` viajan por separado, así que un PUT que sólo mande el fin se
       compara contra el inicio que ya hay en la fila. Se comprueba aquí y no en
       la base porque `appointments` no tiene `CHECK (end_time > start_time)`
       incondicional: sin esto, el fin adelantado entraría sin más.

       ⚠️ ESTO NO CUBRE LAS FILAS DE TODO EL DÍA, Y NO HACE FALTA QUE LO CUBRA.
       Sus dos puntas se componen MÁS ABAJO —después del bloque de consultorio,
       que es donde se sabe el huso efectivo; el porqué entero está allí—, así
       que cuando esta línea corre `updates` todavía no las tiene y lo que
       compara es lo que la fila ya tenía. El caso lo valida la guarda
       `hasta < desde` de aquel bloque, y lo valida MEJOR: habla de días, que es
       lo que el cliente manda, en vez de instantes que aún no existen.
       Bajar esta comprobación para «alcanzarlas» sólo la haría redundante. */
    const inicioEfectivo = typeof updates.start_time === 'string' ? updates.start_time : existing.start_time
    const finEfectivo    = typeof updates.end_time   === 'string' ? updates.end_time   : existing.end_time
    if (!(new Date(finEfectivo) > new Date(inicioEfectivo))) {
      return NextResponse.json(
        { error: 'rango_invalido', message: 'El fin de la cita tiene que ir después del inicio.' },
        { status: 400 }
      )
    }

    /* La pinta del evento genérico (§12.14). Mismo criterio que el resto: sólo
       se toca la columna si el campo VINO, así que una edición que no hable de
       pinta la deja como está.

       §12.7 las clasifica del lado PERMITIDO: un médico invitado sin permiso de
       escritura puede cambiarlas. No mueven una hora, no cambian de paciente y
       no reasignan a nadie — sólo cómo se ve el evento. Queda dicho aquí porque
       el trigger del commit 7 se escribe con una lista cerrada, y lo que no esté
       nombrado se decide por omisión. */
    if (icono !== undefined) {
      const v = pintaValida(icono, ICONOS_EVENTO)
      if (v === undefined) {
        return NextResponse.json(
          { error: 'pinta_invalida', message: 'El icono del evento no está en la lista permitida.' },
          { status: 400 }
        )
      }
      updates.icono = v
    }
    if (color !== undefined) {
      const v = pintaValida(color, COLORES_EVENTO)
      if (v === undefined) {
        return NextResponse.json(
          { error: 'pinta_invalida', message: 'El color del evento no está en la lista permitida.' },
          { status: 400 }
        )
      }
      updates.color = v
    }

    // `client_id` en la EDICIÓN no es lo mismo que en el alta, aunque sea la
    // misma columna. Aquí no hay idempotencia que ganar: el PUT ya es
    // idempotente por naturaleza (escribe campos, no crea entidades) y además
    // trae su propio control de concurrencia con `updated_at`. Reenviar el
    // mismo PUT dos veces deja la fila igual; no hay duplicado posible.
    //
    // Lo que sí hace falta es FIRMAR la escritura, para que la pestaña que
    // editó reconozca su eco en Realtime y no lo vuelva a aplicar. Por eso el
    // cliente manda un UUID nuevo en cada edición y aquí se sobrescribe.
    //
    // CONSECUENCIA ACEPTADA: al sobrescribirlo se pierde la clave de
    // idempotencia con que nació la cita. Sólo importaría si un reintento
    // rezagado del POST original llegara DESPUÉS de que alguien ya editó esa
    // misma cita —segundos, y con una edición humana en medio—; en ese hueco
    // el alta duplicada volvería a ser posible. Se prefiere eso a dejar las
    // ediciones sin firma, que es un eco mal aplicado en cada movimiento.
    if (client_id !== undefined && client_id !== null) {
      if (typeof client_id !== 'string' || !UUID_REGEX.test(client_id)) {
        return NextResponse.json(
          { error: 'client_id_invalido', message: 'client_id no tiene formato UUID válido.' },
          { status: 400 }
        )
      }
      updates.client_id = client_id
    }
    // 5.H Paso 1: Validar cambio de medico_id según rol (D-5.H-3).
    // Médico invitado NO puede transferir su cita a otro médico (defense in depth
    // con la policy de Paso 3; mensaje claro al usuario en lugar de RLS 42501).
    if (medico_id !== undefined) {
      const esMedicoInvitado = profile.role === 'medico' && !profile.es_admin_de_clinica
      const esAdminOSecretaria = (profile.role === 'medico' && profile.es_admin_de_clinica) || profile.role === 'secretaria'

      if (esMedicoInvitado) {
        // Médico invitado: solo puede mantener su propio UUID
        if (medico_id !== null && medico_id !== profile.id) {
          return NextResponse.json(
            { error: 'forbidden_transfer', message: 'No puedes transferir tu cita a otro médico.' },
            { status: 403 }
          )
        }
        updates.medico_id = profile.id
      } else if (esAdminOSecretaria) {
        // Admin/secretaria: medico_id es obligatorio, validar pertenencia a clínica
        if (!medico_id) {
          return NextResponse.json(
            { error: 'medico_id_required', message: 'Debes seleccionar un médico para la cita.' },
            { status: 400 }
          )
        }
        const { data: medicoValido } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', medico_id)
          .eq('clinica_id', profile.clinica_id)
          .eq('role', 'medico')
          .maybeSingle()
        if (!medicoValido) {
          return NextResponse.json(
            { error: 'medico_invalido', message: 'El médico seleccionado no pertenece a tu clínica.' },
            { status: 400 }
          )
        }
        updates.medico_id = medico_id
      } else {
        return NextResponse.json(
          { error: 'forbidden', message: 'Tu rol no puede modificar citas.' },
          { status: 403 }
        )
      }
    }

    // Fase 2.6: snapshot de consultorio.
    // Si el cliente está cambiando medico_id (admin/secretaria), DEBE enviar
    // consultorio_id también — el consultorio del médico viejo no es válido
    // para el médico nuevo. Esto preserva el invariante "consultorio pertenece
    // al médico de la cita" que el POST garantiza.
    const cambiaMedico =
      updates.medico_id !== undefined &&
      updates.medico_id !== existing.medico_id

    if (cambiaMedico && consultorio_id === undefined) {
      return NextResponse.json(
        {
          error: 'consultorio_id_required',
          message: 'Al cambiar de médico, debes seleccionar el consultorio del nuevo médico.',
        },
        { status: 400 }
      )
    }

    // Si el cliente envía consultorio_id, validar y actualizar snapshot.
    // Si NO viene Y el médico no cambia, la cita conserva su snapshot actual.
    if (consultorio_id !== undefined) {
      // null o string vacío → rechazar (N3).
      if (consultorio_id === null || consultorio_id === '') {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'consultorio_id no puede ser nulo o vacío. Si no quieres cambiar el consultorio, omite el campo.' },
          { status: 400 }
        )
      }

      // Validar formato UUID (la constante vive a nivel de módulo).
      if (!UUID_REGEX.test(consultorio_id)) {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'consultorio_id no tiene formato UUID válido.' },
          { status: 400 }
        )
      }

      // Determinar el medico_id efectivo del dueño de la cita después del UPDATE.
      // Si el cliente está cambiando medico_id, usar el nuevo; si no, el actual de BD.
      const medicoIdEfectivo = (updates.medico_id as string | undefined) ?? existing.medico_id

      if (!medicoIdEfectivo) {
        return NextResponse.json(
          { error: 'cita_sin_medico', message: 'La cita no tiene médico asignado. No se puede asignar consultorio.' },
          { status: 400 }
        )
      }

      // Cargar consultorio y validar ownership/activo.
      // F3-6a+c.1: validar consultorio con admin client (espejo del POST).
      // Tras la migración 06 (RLS consultorios owner-only), un admin de
      // clínica NO ve los consultorios de invitados vía RLS. medicoIdEfectivo
      // ya quedó validado contra la clínica del caller (rama de cambio de
      // médico L101-122 o vía RLS de appointments L63-67), así que el bypass
      // de RLS es seguro. Defensa en profundidad: filtramos por clinica_id.
      const adminConsultorio = createAdminClient()
      const { data: consultorio, error: errConsultorio } = await adminConsultorio
        .from('consultorios')
        .select('id, nombre, nombre_corto, direccion, telefono, timezone')
        .eq('id', consultorio_id)
        .eq('medico_id', medicoIdEfectivo)
        .eq('clinica_id', profile.clinica_id)
        .eq('activo', true)
        .maybeSingle()

      if (errConsultorio) {
        console.error('[PUT /api/appointments/[id]] error cargando consultorio:', errConsultorio)
        return NextResponse.json({ error: errConsultorio.message }, { status: 500 })
      }
      if (!consultorio) {
        return NextResponse.json(
          { error: 'consultorio_invalido', message: 'El consultorio no existe, está archivado, o no pertenece al médico de la cita.' },
          { status: 400 }
        )
      }

      // Agregar los 6 campos snapshot al updates.
      updates.consultorio_id            = consultorio.id
      updates.consultorio_nombre        = consultorio.nombre
      updates.consultorio_nombre_corto  = consultorio.nombre_corto
      updates.consultorio_direccion     = consultorio.direccion
      updates.consultorio_telefono      = consultorio.telefono
      updates.consultorio_timezone      = consultorio.timezone
    }

    /* ── TODO EL DÍA: LAS DOS PUNTAS SE COMPONEN AQUÍ, Y AQUÍ ES ABAJO ───────
       Mismo trato que en el POST y por el mismo motivo: el cliente manda dos
       FECHAS y el servidor las convierte en medianoche, porque la zona que vale
       es la del consultorio de la fila y el navegador compondría con la suya.
       `all_day_hasta` es el ÚLTIMO DÍA INCLUIDO; el `+1 día` de aquí es el paso
       a fin exclusivo, y es el único del servidor en esta ruta.

       ⚠️ ESTÁ DESPUÉS DEL BLOQUE DE CONSULTORIO A PROPÓSITO, Y ESTUVO ANTES.
       El huso que hay que usar es el que la fila va a TENER cuando termine este
       PUT, no el que traía: si esta misma edición cambia de consultorio, el
       snapshot de arriba ya escribió el nuevo en `updates`. Compuesta antes,
       una edición con `all_day: true` Y `consultorio_id` dejaba las puntas en
       la zona vieja y la columna en la nueva, y el CHECK
       `appointments_all_day_medianoche_check` compara justamente esas dos cosas
       ENTRE SÍ: rechazaba con 23514. Se llegaba desde la interfaz sin nada
       raro —editar un evento de todo el día y moverlo a un consultorio de otra
       zona—, así que no era teórico.

       De ahí el `typeof`, que es el mismo `??` de siempre escrito con la
       guarda que obliga el `Record<string, unknown>` de `updates` (idéntico al
       de `inicioEfectivo` más arriba): si el bloque de consultorio corrió,
       manda su huso; si no, el que la fila ya tenía. `consultorios.timezone` es
       NOT NULL, así que cuando ese bloque corre siempre hay cadena.

       ⚠️ Y NO SUBAS EL BLOQUE DE CONSULTORIO EN SU LUGAR: depende de
       `updates.medico_id`, que se decide más arriba, y habría que subir los dos.

       ⚠️ LO QUE ESTE ORDEN DEJA FUERA, Y NO ES UN DESCUIDO. La comprobación de
       «el fin después del inicio» vive ARRIBA y lee `updates.start_time` /
       `updates.end_time`, así que ya no ve estas dos puntas: para una fila de
       todo el día compara las que la fila ya tenía. No abre ningún hueco —el
       caso lo valida la guarda `hasta < desde` de aquí abajo, que es la que
       habla el idioma de este camino (días, no instantes)— y bajar aquella
       comprobación sólo la volvería a hacer redundante. Si vas a «arreglarlo»,
       lee antes esta línea: ya está arreglado. */
    /* LAS DOS FECHAS DEL EVENTO, VIVAS FUERA DEL BLOQUE, para que el `after()`
       de Google las alcance. Son las MISMAS cadenas con las que se compone la
       fila —`hasta` ya con su dia sumado—, y Google las quiere tal cual: su
       `end` tambien es exclusivo. Sacarlas aqui es lo que evita un CUARTO `+1`
       del convenio alla abajo.

       En null significa «este PUT no deja la fila como evento de todo el dia»,
       que es tambien la senal de que a Google hay que mandarle instantes. */
    let fechasDelEvento: { desde: string; hastaExclusivo: string } | null = null

    if (all_day === true) {
      const tz = typeof updates.consultorio_timezone === 'string'
        ? updates.consultorio_timezone
        : existing.consultorio_timezone
      const desde = typeof all_day_desde === 'string' ? all_day_desde : ''
      const hasta = typeof all_day_hasta === 'string' ? all_day_hasta : ''
      if (!tz) {
        return NextResponse.json(
          { error: 'consultorio_sin_huso', message: 'Esta cita no tiene zona horaria de consultorio, y un evento de todo el día no se puede guardar sin ella.' },
          { status: 400 }
        )
      }
      /* Dos comprobaciones con dos mensajes, como en el POST: que las fechas
         EXISTAN y que estén en orden. Y el mismo día es VÁLIDO —un evento de una
         sola jornada—, así que la guarda es `hasta < desde` y el texto dice «no
         puede ir antes», no «tiene que ir después», que prometía una regla más
         estricta que la que el código aplica. */
      if (!esFechaDeCalendario(desde) || !esFechaDeCalendario(hasta)) {
        return NextResponse.json(
          { error: 'fecha_invalida', message: 'Las fechas del evento no existen en el calendario. Se espera un día real, en formato AAAA-MM-DD.' },
          { status: 400 }
        )
      }
      if (hasta < desde) {
        return NextResponse.json(
          { error: 'rango_invalido', message: 'El último día del evento no puede ir antes del primero.' },
          { status: 400 }
        )
      }
      const hastaExclusivo = desplazarFecha(hasta, { dias: 1 })
      fechasDelEvento = { desde, hastaExclusivo }
      updates.start_time = fechaHoraLocalAInstante(desde, '00:00', tz)
      updates.end_time   = fechaHoraLocalAInstante(hastaExclusivo, '00:00', tz)
    }

    // RLS filtra por clinica_id
    const { data: apt, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select(APPOINTMENT_SELECT)
      .single()

    /* 23514 = check_violation. La vía conocida hasta este commit era el desfase
       entre las puntas de todo el día y `consultorio_timezone`, y el reordenado
       de arriba la cierra — pero `appointments` tiene varios CHECK (la
       medianoche, `icono`, `color`) y cualquiera de ellos sube por aquí. Sin
       esto el usuario lee el texto del constraint dentro de un 500, que no le
       dice nada y a nosotros nos oculta que aquel 500 era en realidad un dato
       rechazado. Mismo criterio que `consultorio_sin_huso` y `rango_invalido`:
       la base es la barrera que no se puede saltar, esto es el mensaje que se
       entiende.

       Es 400 y no 500 a propósito: lo que falló es el cuerpo de la petición, no
       el servidor. El texto de Postgres NO viaja al cliente —nombra columnas y
       constraints— pero sí queda en el log del servidor, que es donde hace
       falta para diagnosticar. */
    if (error?.code === '23514') {
      console.error('[PUT /api/appointments/[id]] CHECK rechazado:', error.message)
      return NextResponse.json(
        {
          error: 'datos_invalidos',
          message: 'La base rechazó estos datos por incoherentes. Si es un evento de todo el día, revisa las fechas y el consultorio; si no, vuelve a intentarlo.',
        },
        { status: 400 }
      )
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Google Calendar sync en background con el cliente admin, espejando al
    // POST de /api/appointments.
    //
    // NO es por las cookies. `after()` SÍ conserva el contexto de la petición
    // y la RLS funciona ahí con normalidad — comprobado en producción el
    // 2026-08-16 creando y arrastrando una cita: Google se actualizó en ambos
    // casos. Si alguien apunta lo contrario en algún comentario, está mal.
    //
    // EL CASO QUE ESTE COMMIT ARREGLA, y que el párrafo anterior describía como
    // pendiente de otra rama: ésta es esa rama. Antes se le leía el token a
    // QUIEN EJECUTA la acción, así que una secretaria que movía la cita de un
    // médico buscaba el suyo, no lo tenía, y no sincronizaba nada — en
    // silencio. Ahora la conexión se resuelve por CLÍNICA y quién mueva la cita
    // deja de importar. El cliente admin sigue siendo el prerrequisito, porque
    // los tokens sólo se alcanzan por el puente y eso exige service role.
    //
    // ÁMBITO CON CLIENTE ADMIN — sin RLS, cada consulta acota a mano:
    //   · la conexión va por `clinica_id` (es de la clínica, no del usuario);
    //   · la cita va por `clinica_id` además de por su id.
    // Lo que `conCalendarioSpinus` consulta por dentro ya viene acotado: el
    // puente filtra por `clinica_id`, la lectura de `profiles` va por `id` Y
    // `clinica_id`, y el UPDATE de `desvincularCitas` por la clínica del dueño
    // de la conexión.
    //
    // `paciente_id` entra en la lista porque el título del evento se deriva del
    // paciente: ligar o desligar uno cambia lo que Google debe mostrar aunque
    // no se toque ningún otro campo.
    /* ⚠️ LAS TRES CLAVES DE TODO EL DIA ENTRAN AQUI, Y SIN ELLAS NO SE
       SINCRONIZABA NADA. En una fila de todo el dia el cuerpo NUNCA trae
       `start_time` ni `end_time` —el cliente manda fechas, y las puntas las
       compone el servidor—, asi que sin nombrar estas tres, ni encender el
       interruptor ni cambiar los dias de un evento llegaban a Google: la
       edicion se guardaba en la base y el calendario se quedaba como estaba,
       en silencio.

       Basta con la lista: el escalon siguiente ya estaba bien. `seMovio` compara
       `existing` contra `apt` —la fila YA ESCRITA, no el cuerpo— asi que en
       cuanto se deja pasar el caso, el `sendUpdates: 'all'` sale solo. */
    const gcalFieldChanged = title !== undefined || start_time !== undefined || end_time !== undefined || notes !== undefined || status !== undefined || paciente_id !== undefined || all_day !== undefined || all_day_desde !== undefined || all_day_hasta !== undefined
    // Se resuelve una sola vez y sólo si hay algo que sincronizar; la usan el
    // after() de abajo y el veredicto de la respuesta. Con el cliente de sesión
    // y antes de responder, como manda el plan §1: dentro de `after()` no se
    // resuelve nada.
    /* ⚠️ YA NO SE EXIGE `google_event_id` PARA RESOLVER LA CONEXIÓN, y ése es
       el cambio que repara las filas huérfanas. Una fila puede no tener
       identificador porque su evento NUNCA se creó —el alta falló, o la clínica
       no tenía Google conectado entonces— y con la condición vieja esa fila no
       volvía a intentarlo JAMÁS: el PUT sólo sabía parchear, y no hay nada que
       parchear. Quedaba huérfana para siempre, sin evento en el calendario del
       médico y sin nadie que la recuperara.

       Lo que decide ahora es sólo `gcalFieldChanged`. Con la conexión resuelta,
       el bloque de abajo elige verbo: `patch` si hay identificador, `insert` si
       no. */
    const conexion = gcalFieldChanged
      ? await resolverConexionClinica(supabase, profile.clinica_id)
      : null

    /* ── LA FILA HUÉRFANA: NO SE PARCHEA, SE CREA ────────────────────────
       Una fila sin `google_event_id` no tiene evento que actualizar, así que
       aquí el verbo es `insert` y no `patch`. Con esto, CUALQUIER edición
       posterior repara la fila: escribe el identificador que le faltaba y la
       deja sincronizada. No es cosa de los eventos de todo el día — a una cita
       normal le pasa igual si Google falla en el momento del alta.

       ⚠️ LA CONDICIÓN ES LA AUSENCIA DEL IDENTIFICADOR, Y NO EL
       `gcal_sync_status`. Ese estado NO sirve para decidir, porque hay TRES
       formas de quedarse sin evento y sólo una se llama 'failed':
         · 'pending' — la fila nace así (`POST`), y ahí se queda si la clínica
           no tenía Google conectado: el `after()` del alta ni siquiera corre.
           Conectarlo después no repara nada por su cuenta; esta rama sí.
         · 'failed'  — el alta lo intentó y no salió.
         · 'unbound' — el médico borró el calendario y `desvincularCitas`
           (`lib/gcal.ts`) soltó los vínculos. El evento existió y ya no.
       Las tres dicen lo mismo —«no hay evento en Google para esta fila»— y las
       tres se reparan igual. Mirar el estado dejaría fuera a dos de ellas.

       ⚠️ AL PACIENTE NO SE LE INVITA AQUÍ, Y NO ES UN OLVIDO. Espeja al alta,
       que sólo mete al MÉDICO (`nuevos: []` en su `componerAsistentes`): al
       paciente se le invita a mano, desde el botón del modal, que es la única
       ruta que le manda correo. Así que reparar una cita de hace meses NO le
       escribe al paciente de golpe — no puede, no hay camino. Y tampoco había
       nada que conservar: si la fila nunca tuvo evento, nunca tuvo invitados,
       por eso `componerAsistentes` arranca de `[]` y no de un `events.get`
       como el patch. */
    if (!existing.google_event_id && gcalFieldChanged && conexion) {
      const userId = user.id
      const clinicaId = profile.clinica_id
      const puedeReparar = canManageClinica(profile)
      const admin = createAdminClient()
      const pacienteCita: PacienteEnCita = apt.pacientes ?? null
      const clinicaCita:  ClinicaEnCita  = apt.clinicas  ?? null
      const tzCita: string = apt.consultorio_timezone ?? TZ_CLINICA
      const esTodoElDia = apt.all_day === true
      // `typeof` y no un `as`: `apt` llega sin tipar de PostgREST, y una
      // aserción aquí sería creerle a la fila en vez de comprobarla.
      const medicoDeLaCita = typeof apt.medico_id === 'string' ? apt.medico_id : null

      /* LAS DOS PUNTAS SALEN DE `apt`, LA FILA YA GUARDADA, Y NUNCA DEL CUERPO.
         El `patch` manda sólo lo que cambió porque el evento ya tiene el resto;
         un `insert` necesita el estado COMPLETO, y esta edición pudo no tocar
         las fechas —reparar una fila huérfana cambiándole el título es el caso
         normal—.

         En todo el día se vuelve de instante a fecha-sola en la zona del
         consultorio, que es la única en la que esa fila significa algo. SIN
         `±1`: `apt.end_time` YA es el fin exclusivo, y el `end.date` de Google
         también lo es, así que la fecha se pasa tal cual. Si te ves sumando un
         día aquí, sobra. */
      const puntasDelAlta = esTodoElDia
        ? puntasParaGoogle(
            { todoElDia: true, inicio: renderEnTZ(apt.start_time, 'yyyy-MM-dd', tzCita), fin: renderEnTZ(apt.end_time, 'yyyy-MM-dd', tzCita), timezone: tzCita },
            { limpiarLaOtraForma: false },
          )
        : puntasParaGoogle(
            { todoElDia: false, inicio: apt.start_time, fin: apt.end_time, timezone: tzCita },
            { limpiarLaOtraForma: false },
          )

      after(async () => {
        let google_event_id: string | null = null
        let calendarIdUsado: string | null = null
        try {
          // `null` apaga el ancla de hora en un evento de todo el día, igual que
          // en el alta y en el patch.
          const instanteParaAncla = esTodoElDia ? null : apt.start_time
          const { summary, description, reminders } =
            eventoParaGoogle(pacienteCita, clinicaCita, apt.title, instanteParaAncla, tzCita, apt.status)

          /* El médico entra en el mismo `insert`, como en el alta: si tiene la
             cita asignada, tiene que tenerla en su calendario. Si su correo no
             se resuelve, el evento se crea igual y sin asistentes — el mismo
             criterio del POST, y sigue quedando el botón de invitación. */
          let asistentes: calendar_v3.Schema$EventAttendee[] = []
          if (medicoDeLaCita) {
            const r = await correoDelMedico(admin, medicoDeLaCita, clinicaId)
            if (r.ok) {
              asistentes = componerAsistentes([], {
                medicoActual: r.correo, medicoSaliente: null, pacienteSaliente: null, nuevos: [],
              })
            } else {
              registrarFalloGCal(
                { operacion: `events.insert (reparación, médico sin invitar: ${r.motivo})`, userId, conexionId: conexion.id },
                new Error('no se pudo resolver el correo del médico asignado'),
              )
            }
          }

          const creado = await conCalendarioSpinus(conexion, admin, (calendar, calendarId) => {
            calendarIdUsado = calendarId
            /* `sendUpdates: 'all'` como en el alta, y por lo mismo: esto ES el
               alta que no llegó a ocurrir. El médico invitado con su propia
               cuenta no tiene esta cita en ninguna parte, que es justo lo que
               se está arreglando. Al dueño de la cuenta conectada Google no le
               escribe —no notifica al organizador de su propio evento—. */
            return calendar.events.insert({
              calendarId,
              sendUpdates: 'all',
              requestBody: {
                summary, description, attendees: asistentes,
                ...INTERRUPTORES_INVITADOS, reminders, ...puntasDelAlta,
              },
            })
          }, { puedeReparar, actorId: userId })

          google_event_id = creado?.data.id ?? null
          if (!google_event_id) {
            registrarFalloGCal(
              { operacion: 'events.insert (reparación, sin respuesta)', userId, conexionId: conexion.id, calendarId: calendarIdUsado },
              new Error('no se resolvió calendario de clínica (¿modo estricto?)'),
            )
          }
        } catch (gcalErr) {
          registrarFalloGCal(
            { operacion: 'events.insert (reparación de cita sin evento)', userId, conexionId: conexion.id, calendarId: calendarIdUsado },
            gcalErr,
          )
        }

        await fijarEventoCreado(admin, conexion, {
          appointmentId: id,
          clinicaId,
          userId,
          googleEventId: google_event_id,
          estado:        google_event_id ? 'synced' : 'failed',
          calendarId:    calendarIdUsado,
        })
      })
    }

    if (existing.google_event_id && gcalFieldChanged && conexion) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      const clinicaId = profile.clinica_id
      // Modo estricto para quien no administra: ante un 404 del calendario, ni
      // desvincula citas ajenas ni crea nada en la cuenta de Google del
      // administrador. Se calcula aquí y viaja por closure.
      const puedeReparar = canManageClinica(profile)
      const admin = createAdminClient()
      // El titulo del evento sale del paciente ligado; si la cita no tiene
      // paciente, del titulo libre de la cita.
      const pacienteCita: PacienteEnCita = apt.pacientes ?? null
      const clinicaCita:  ClinicaEnCita  = apt.clinicas  ?? null
      // EL HUSO DEL EVENTO ES EL DEL CONSULTORIO, NO EL DEL CENTRO. Espeja al
      // POST: antes se etiquetaba con una constante fija (Ciudad de Mexico) y
      // la invitacion de una cita en Hermosillo decia "hora estandar central".
      // El instante siempre viajo bien; lo que estaba mal era la etiqueta.
      //
      // SALE DE `apt`, LA FILA YA ACTUALIZADA, Y NO DEL `consultorio` DE ARRIBA.
      // Aquel `const` vive dentro del `if (consultorio_id !== undefined)` y no
      // llega hasta aqui. Ademas `apt` es la fuente correcta: si esta edicion
      // cambio de consultorio, ya trae el snapshot nuevo; si no lo toco, trae el
      // que la cita tenia congelado.
      //
      // AQUI EL NULL SI PASA. `consultorio_timezone` se anadio sin rellenar las
      // filas existentes, asi que una cita anterior a esa migracion llega sin
      // huso y cae a `TZ_CLINICA` — exactamente lo que Google ya muestra hoy
      // para ella. No se rompe nada y no hace falta migracion.
      const tzCita: string = apt.consultorio_timezone ?? TZ_CLINICA

      /* ── QUÉ CAMBIÓ DE VERDAD, Y QUIÉN TIENE QUE ENTERARSE ─────────────────
         Todo esto compara `existing` (el ANTES) contra `apt` (la fila ya
         actualizada). NO se mira si el campo vino en el cuerpo: el modal manda
         siempre el lote completo, así que «vino» no distingue nada.

         ⚠️ LAS HORAS SE COMPARAN POR INSTANTE, NUNCA POR CADENA. `existing`
         llega de PostgREST como `2026-08-22T09:00:00+00:00` y el cuerpo trae
         `2026-08-22T09:00:00.000Z`: son el mismo instante escrito de dos formas
         y `!==` diría que cambió SIEMPRE, notificando al paciente en cada
         guardado. */
      const mismoInstante = (a: string | null, b: string | null): boolean =>
        a !== null && b !== null && new Date(a).getTime() === new Date(b).getTime()

      const seMovio =
        !mismoInstante(existing.start_time, apt.start_time) ||
        !mismoInstante(existing.end_time,   apt.end_time)

      const estabaCancelada = existing.status === 'cancelled'
      const estaCancelada   = apt.status      === 'cancelled'
      /* La TRANSICIÓN, no el estado. Sin esto, editar las notas de una cita ya
         cancelada le volvería a mandar la cancelación al paciente. */
      const cambioCancelacion = estabaCancelada !== estaCancelada

      const medicoAnteriorId = existing.medico_id as string | null
      const medicoActualId   = apt.medico_id as string | null
      const huboReasignacion = medicoAnteriorId !== medicoActualId

      /* QUITAR AL PACIENTE DE UNA CITA **ES** BORRARLA, y por eso no hay aquí
         ninguna rama que lo trate: no es una edición. La X del paciente en el
         modal lleva al DELETE de la cita entera, con su alerta delante, y ese
         camino ya borra el evento con `sendUpdates: 'all'`.

         Lo que sí es una edición es cambiar de un paciente a OTRO. */
      const cambioPaciente   = existing.paciente_id !== null
                            && apt.paciente_id !== null
                            && existing.paciente_id !== apt.paciente_id
      const pacienteAnteriorId = existing.paciente_id as string | null

      /* Cuándo Google manda correo. `'none'` es el silencio de hoy y sigue
         siendo el caso por omisión: cambiar las notas o pasar a «Confirmada» no
         molesta a nadie. */
      const sendUpdates: 'all' | 'none' =
        (seMovio || cambioCancelacion || huboReasignacion || cambioPaciente) ? 'all' : 'none'

      /* ── LAS DOS PUNTAS PARA EL `patch` ──────────────────────────────────
         Dos formas, y la de todo el dia manda cuando esta edicion deja la fila
         como evento de todo el dia — que es exactamente lo que significa que
         `fechasDelEvento` no sea null. Sus dos cadenas son las MISMAS con las
         que se compuso la fila, y Google las quiere tal cual: su `end` tambien
         es exclusivo, asi que no hay `+1` nuevo por ninguna parte.

         ⚠️ `limpiarLaOtraForma: true` EN LAS DOS RAMAS, Y NO ES SIMETRIA
         DECORATIVA. `events.patch` FUSIONA: mandar `{ date }` sobre un evento
         que hoy tiene `dateTime` dejaria los dos puestos, y Google exige que
         las dos puntas sean del mismo tipo. Hay que borrar la vieja con un
         `null` explicito, y hace falta EN LOS DOS SENTIDOS: encender el
         interruptor (sobra `dateTime`) y apagarlo (sobra `date`). El porque
         entero, con la referencia, esta en `puntasParaGoogle`.

         ⚠️ Y CADA PUNTA SE MANDA SOLO SI CAMBIO, que es como estaba antes y
         hay que conservarlo: un PUT que solo mueva el fin no debe reescribir el
         inicio. En todo el dia las dos van juntas siempre —se componen juntas—,
         asi que ahi la condicion es la misma para ambas. */
      const puntasDelPatch = fechasDelEvento !== null
        ? puntasParaGoogle(
            { todoElDia: true, inicio: fechasDelEvento.desde, fin: fechasDelEvento.hastaExclusivo, timezone: tzCita },
            { limpiarLaOtraForma: true },
          )
        : puntasParaGoogle(
            { todoElDia: false, inicio: start_time, fin: end_time, timezone: tzCita },
            { limpiarLaOtraForma: true },
          )
      const mandaInicio = fechasDelEvento !== null || start_time !== undefined
      const mandaFin    = fechasDelEvento !== null || end_time   !== undefined

      after(async () => {
        /* El color del evento en Google, por estado.
           `completed: '8'` vivía aquí y ERA UNA RAMA MUERTA: la base rechazaba
           ese valor, así que nunca se evaluó. Se retira y su colorId (grafito)
           pasa a `attended`, que es el nombre que el concepto tiene de verdad
           (plan §12.13). No pueden convivir dos nombres para lo mismo: un
           `completed` en el código y un `attended` en la base es el desajuste
           que sobrevive años porque las dos mitades «funcionan».

           ⚠️ `scheduled` NO ESTÁ, Y NO ES UN OLVIDO ESTE — es un defecto viejo
           que sigue aquí a propósito de no ampliar el alcance: sin entrada, el
           patch no manda `colorId` y Google CONSERVA el que tuviera. O sea que
           reactivar una cita cancelada le quita el prefijo «CANCELADA — » del
           título pero la deja roja en el calendario. Está reportado; arreglarlo
           es tocar el color de citas que ya existen y no entra por arrastre. */
        const STATUS_COLOR: Record<string, string | undefined> = {
          confirmed: '2',
          cancelled: '11',
          no_show:   '11',
          attended:  '8',
        }
        let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
        let calendarIdUsado: string | null = null

        /* El estado va al compositor del título: una cita cancelada estrena el
           prefijo «CANCELADA — » y una reactivada lo pierde, sin código de
           vuelta — se recompone desde cero, así que el prefijo no se acumula.
           Ver `PREFIJO_CANCELADA` en `lib/appointments.ts`. */
        /* `null` APAGA EL ANCLA DE HORA en un evento de todo el dia, cuyo
           `start_time` es medianoche: sin esto la descripcion decia «Hora de la
           cita: 12:00 a.m.» sobre algo que no tiene hora. Sale de `apt` —la fila
           ya actualizada— y no del cuerpo, por lo mismo que el instante: una
           edicion que solo cambie el `status` no trae `all_day` y la fila puede
           serlo igual. */
        const instanteParaAncla = apt.all_day === true ? null : apt.start_time
        const { summary, description } = eventoParaGoogle(pacienteCita, clinicaCita, apt.title, instanteParaAncla, tzCita, apt.status)

        /* ── LOS CORREOS DE LOS MÉDICOS — SÓLO AL REASIGNAR ───────────────
           Los dos se resuelven únicamente cuando cambia `medico_id`, que es la
           única vez que hay alguien a quien meter y alguien a quien sacar. En
           cualquier otra edición no se pregunta nada y el médico que ya estaba
           en la lista se conserva solo: viene en `previos` y `componerAsistentes`
           no quita a nadie que no se le nombre.

           ⚠️ SE CONSIDERÓ RESOLVER EL ACTUAL SIEMPRE, Y SE DESCARTÓ POR COSTE.
           No es un olvido. Hacerlo repararía un caso que casi nunca ocurre —una
           cita cuyo evento nació sin el médico porque la API de Auth falló aquel
           día— a cambio de una llamada a la API de Admin de Auth en TODA edición
           que toque Google: mover una hora, cambiar el estado, corregir una
           nota. Latencia permanente por un beneficio marginal.

           Qué pasa entonces con una cita rota así: se repara el día que alguien
           la reasigne, y si nunca se reasigna, el médico no tiene ese evento en
           su calendario — que es exactamente lo que le pasa hoy.

           Un fallo al resolver NO cancela la edición: se parchea sin tocar a ese
           asistente y queda la línea de log. */
        let correoMedicoActual: string | null = null
        let correoMedicoSaliente: string | null = null
        if (huboReasignacion) {
          if (medicoActualId) {
            const r = await correoDelMedico(admin, medicoActualId, clinicaId)
            if (r.ok) correoMedicoActual = r.correo
            else registrarFalloGCal(
              { operacion: `events.patch (médico entrante sin resolver: ${r.motivo})`, userId, conexionId: conexion.id, eventId: gcalEventId },
              new Error('no se pudo resolver el correo del médico que recibe la cita'),
            )
          }
          if (medicoAnteriorId) {
            const r = await correoDelMedico(admin, medicoAnteriorId, clinicaId)
            if (r.ok) correoMedicoSaliente = r.correo
            else registrarFalloGCal(
              { operacion: `events.patch (médico saliente sin resolver: ${r.motivo})`, userId, conexionId: conexion.id, eventId: gcalEventId },
              new Error('no se pudo resolver el correo del médico que deja la cita'),
            )
          }
        }

        /* El paciente saliente sólo se puede sacar cuando cambia el PACIENTE de
           la cita: entonces su ficha sigue existiendo y su correo se puede leer.
           Si lo que cambió fue el correo dentro de una misma ficha, la dirección
           anterior no está en ninguna parte de Spinus y no hay a quién sacar —
           coste aceptado, explicado en `AsistentesDeseados.pacienteSaliente`.

           `clinica_id` explícito: es cliente admin y la RLS no acota nada. */
        let correoPacienteSaliente: string | null = null
        if (cambioPaciente && pacienteAnteriorId) {
          const { data: anterior } = await admin
            .from('pacientes')
            .select('email')
            .eq('id', pacienteAnteriorId)
            .eq('clinica_id', clinicaId)
            .maybeSingle<{ email: string | null }>()
          correoPacienteSaliente = anterior?.email?.trim().toLowerCase() || null
        }

        try {
          const parcheado = await conCalendarioSpinus(conexion, admin, async (calendar, calendarId) => {
            calendarIdUsado = calendarId

            /* ⚠️⚠️ EL `get` ES LA MITAD DE LA OPERACIÓN, NO UNA COMPROBACIÓN.
               `events.patch` con `attendees` PISA LA LISTA ENTERA. Sin leer lo
               que hay, este patch borraría al paciente invitado y Google le
               mandaría una cancelación de una cita que sigue en pie.

               Y va DENTRO del callback, como todo lo demás: `conCalendarioSpinus`
               reejecuta la operación entera ante un 404. */
            const { data: evento } = await calendar.events.get({ calendarId, eventId: gcalEventId })
            const asistentes = componerAsistentes(evento.attendees ?? [], {
              medicoActual:     correoMedicoActual,
              medicoSaliente:   correoMedicoSaliente,
              pacienteSaliente: correoPacienteSaliente,
              nuevos:           [],
            })

            return calendar.events.patch({
              calendarId,
              eventId:    gcalEventId,
              sendUpdates,
              requestBody: {
                summary,
                description,
                attendees: asistentes,
                ...INTERRUPTORES_INVITADOS,
                ...(mandaInicio ? { start: puntasDelPatch.start } : {}),
                ...(mandaFin    ? { end:   puntasDelPatch.end   } : {}),
                ...(status     !== undefined && STATUS_COLOR[status] ? { colorId: STATUS_COLOR[status] }    : {}),
              },
            })
          }, { puedeReparar, actorId: userId })
          // EL 'synced' DEJA DE SER OPTIMISTA (H4). `conCalendarioSpinus`
          // devuelve null cuando no hay calendario que resolver o cuando el
          // modo estricto se niega a repararlo, y eso NO es «sincronizado».
          if (parcheado) {
            gcal_sync_status = 'synced'
          } else {
            gcal_sync_status = 'failed'
            registrarFalloGCal(
              { operacion: 'events.patch (edición de cita, sin respuesta)', userId, conexionId: conexion.id, calendarId: calendarIdUsado, eventId: gcalEventId },
              new Error('no se resolvió calendario de clínica (¿modo estricto?)'),
            )
          }
        } catch (gcalErr) {
          // Corre dentro de after(): nadie ve el fallo del lado del cliente y la
          // cita se queda en 'failed' sin más pista que esta línea.
          registrarFalloGCal(
            { operacion: 'events.patch (edición de cita)', userId, conexionId: conexion.id, calendarId: calendarIdUsado, eventId: gcalEventId },
            gcalErr,
          )
          gcal_sync_status = 'failed'
        }
        // `clinica_id` no es decorativo aunque `id` sea la clave primaria: con
        // el cliente admin la RLS no acota nada y el id viene de la URL.
        //
        // `gcal_calendar_id` se estampa también aquí. F8 lo condicionaba a
        // «cuando el evento se cree ahí», y ese caso NO EXISTE: este bloque
        // sólo entra si la cita ya tenía `google_event_id`, así que el PUT
        // nunca crea, siempre parchea. Se estampa igual porque el objetivo de
        // la columna es saber en qué calendario vive el evento, y el patch lo
        // sabe — es además el único camino que la actualiza cuando el
        // calendario se recreó a mitad de la operación.
        const { error: errEstado } = await admin
          .from('appointments')
          .update({ gcal_sync_status, gcal_calendar_id: calendarIdUsado })
          .eq('id', id)
          .eq('clinica_id', clinicaId)
        if (errEstado) {
          registrarFalloGCal(
            { operacion: 'appointments.update(gcal_sync_status)', userId, conexionId: conexion.id, calendarId: calendarIdUsado },
            errEstado,
          )
        }
      })
    }

    // Mismo criterio que el alta (POST /api/appointments): el after() de arriba
    // corre después de responder, así que 'pending' es una promesa y no un
    // hecho. 'skipped' es que no había nada que mandar —la cita nunca tuvo
    // evento en Google, o no cambió ningún campo que Google vea—, y entonces la
    // agenda no dice nada.
    // El veredicto sale de la conexión ya resuelta arriba, sin segunda
    // consulta, y la pregunta es por CLÍNICA: antes miraba la fila propia de
    // quien editaba, así que a la secretaria le contestaba 'disconnected' con
    // la clínica perfectamente conectada.
    // `skipped` sigue queriendo decir «no había nada que mandar», pero eso ya no
    // incluye a la fila sin evento: ahora hay algo que mandar —el alta que le
    // faltaba— así que contesta 'pending' como cualquier otra, o 'disconnected'
    // si la clínica no tiene Google. La condición pierde el `google_event_id`
    // por el mismo motivo que la conexión de arriba.
    let gcalSync: 'pending' | 'disconnected' | 'skipped' = 'skipped'
    if (gcalFieldChanged) {
      gcalSync = conexion ? 'pending' : 'disconnected'
    }

    return NextResponse.json({ appointment: apt, gcalSync })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── DELETE /api/appointments/[id] ──────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/appointments/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // `role` y `es_admin_de_clinica` no se leían aquí: hacen falta para el
    // modo estricto de `conCalendarioSpinus` (plan §3.3).
    const { data: profile } = await supabase.from('profiles').select('clinica_id, role, es_admin_de_clinica').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params

    // RLS filtra por clinica_id
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id')
      .eq('id', id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Se resuelve antes de responder, con el cliente de sesión, y sólo si la
    // cita tenía evento que borrar.
    const conexion = existing.google_event_id
      ? await resolverConexionClinica(supabase, profile.clinica_id)
      : null

    if (existing.google_event_id && conexion) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      // Mismo motivo que en el PUT (ver el comentario largo de arriba): el
      // cliente admin es lo que permite alcanzar los tokens de la conexión de
      // la clínica, por el puente. No tiene nada que ver con `after()` ni con
      // las cookies. Con el cliente admin, la única consulta propia de esta
      // baja es el borrado del evento en Google, que no toca la base; lo que
      // `conCalendarioSpinus` consulta por dentro ya va acotado por
      // `clinica_id`.
      const puedeReparar = canManageClinica(profile)
      const admin = createAdminClient()
      after(async () => {
        let calendarIdUsado: string | null = null
        try {
          await conCalendarioSpinus(conexion, admin, (calendar, calendarId) => {
            calendarIdUsado = calendarId
            /* `sendUpdates: 'all'` — la cita desaparecía del calendario del
               paciente EN SILENCIO. Quien la tuviera aceptada se quedaba con el
               hueco reservado y sin enterarse de nada.

               Sin asistentes no manda nada: las citas que nadie invitó se
               siguen borrando calladas, igual que hasta hoy. Y al médico que es
               dueño de la cuenta conectada tampoco le llega correo —Google no
               notifica al organizador—, pero el evento sí se le va del
               calendario, que es lo que necesita ver. */
            return calendar.events.delete({ calendarId, eventId: gcalEventId, sendUpdates: 'all' })
          }, { puedeReparar, actorId: userId })
        } catch (gcalErr) {
          // Sigue siendo best-effort —la cita ya se borró de Spinus y no hay
          // nada que reintentar—, pero el evento queda vivo en el calendario
          // del médico y hasta hoy no había forma de enterarse.
          registrarFalloGCal(
            { operacion: 'events.delete (baja de cita)', userId, conexionId: conexion.id, calendarId: calendarIdUsado, eventId: gcalEventId },
            gcalErr,
          )
        }
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
