import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { conCalendarioSpinus, registrarFalloGCal, GCAL_TIMEZONE } from '@/lib/gcal'
import { APPOINTMENT_SELECT, eventoParaGoogle, type ClinicaEnCita, type PacienteEnCita } from '@/lib/appointments'

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
    const { title, start_time, end_time, paciente_id, notes, status, medico_id, consultorio_id, updated_at: clientUpdatedAt, client_id } = body

    // RLS filtra por clinica_id
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, google_event_id, gcal_sync_status, updated_at, medico_id')
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

    // RLS filtra por clinica_id
    const { data: apt, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select(APPOINTMENT_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Google Calendar sync en background con el cliente admin, espejando al
    // POST de /api/appointments.
    //
    // NO es por las cookies. `after()` SÍ conserva el contexto de la petición
    // y la RLS funciona ahí con normalidad — comprobado en producción el
    // 2026-08-16 creando y arrastrando una cita: Google se actualizó en ambos
    // casos. Si alguien apunta lo contrario en algún comentario, está mal.
    //
    // El motivo real es a QUIÉN se le lee el token. `conCalendarioSpinus`
    // recibe el `user.id` de quien ejecuta la acción, y la RLS de
    // `google_tokens` sólo deja leer `user_id = auth.uid()`. Funciona para el
    // dueño del token; una secretaria que mueve la cita de un médico busca el
    // suyo, no lo tiene, y no sincroniza nada. El cliente admin es el
    // PRERREQUISITO para poder leerle el token a otro usuario, no el arreglo:
    // decidir a quién leérselo es del modelo de cuenta administradora, que va
    // en otra rama. Hasta entonces ese caso sigue sin sincronizar.
    //
    // ÁMBITO CON CLIENTE ADMIN — sin RLS, cada consulta acota a mano:
    //   · el token va por `user_id` (es del usuario, no de la clínica);
    //   · la cita va por `clinica_id` además de por su id.
    // Lo que `conCalendarioSpinus` consulta por dentro ya viene acotado:
    // `google_tokens` y `profiles` por el userId que se le pasa, y el UPDATE de
    // `desvincularCitas` por la `clinica_id` del perfil de ese userId.
    //
    // `paciente_id` entra en la lista porque el título del evento se deriva del
    // paciente: ligar o desligar uno cambia lo que Google debe mostrar aunque
    // no se toque ningún otro campo.
    const gcalFieldChanged = title !== undefined || start_time !== undefined || end_time !== undefined || notes !== undefined || status !== undefined || paciente_id !== undefined
    if (existing.google_event_id && gcalFieldChanged) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      const clinicaId = profile.clinica_id
      const admin = createAdminClient()
      // El titulo del evento sale del paciente ligado; si la cita no tiene
      // paciente, del titulo libre de la cita.
      const pacienteCita: PacienteEnCita = apt.pacientes ?? null
      const clinicaCita:  ClinicaEnCita  = apt.clinicas  ?? null
      after(async () => {
        const STATUS_COLOR: Record<string, string | undefined> = {
          confirmed: '2',
          cancelled: '11',
          no_show:   '11',
          completed: '8',
        }
        let gcal_sync_status: 'synced' | 'pending' | 'failed' = 'pending'
        let calendarIdUsado: string | null = null
        // Título y descripción se recalculan y se reenvían SIEMPRE que la
        // operación toque Google, no sólo cuando venga `title` en el cuerpo:
        // ambos se derivan del paciente, así que ligar uno a una cita ya
        // existente dejaría el evento con el nombre viejo. El fallback sale de
        // `apt.title` (la fila ya actualizada), no del `title` del cuerpo, que
        // puede no venir.
        // La descripción lleva un formato fijo (clínica y paciente) y NADA
        // clínico: ni notes, ni motivo de consulta, ni diagnóstico.
        // `reminders` NO se manda aquí a propósito: es del insert.
        const { summary, description } = eventoParaGoogle(pacienteCita, clinicaCita, apt.title)
        try {
          await conCalendarioSpinus(admin, userId, (calendar, calendarId) => {
            calendarIdUsado = calendarId
            return calendar.events.patch({
              calendarId,
              eventId:    gcalEventId,
              requestBody: {
                summary,
                description,
                ...(start_time !== undefined ? { start: { dateTime: start_time, timeZone: GCAL_TIMEZONE } } : {}),
                ...(end_time   !== undefined ? { end:   { dateTime: end_time,   timeZone: GCAL_TIMEZONE } } : {}),
                ...(status     !== undefined && STATUS_COLOR[status] ? { colorId: STATUS_COLOR[status] }    : {}),
              },
            })
          })
          // null → el médico no tiene Google conectado: nada que sincronizar.
          gcal_sync_status = 'synced'
        } catch (gcalErr) {
          // Corre dentro de after(): nadie ve el fallo del lado del cliente y la
          // cita se queda en 'failed' sin más pista que esta línea.
          registrarFalloGCal(
            { operacion: 'events.patch (edición de cita)', userId, calendarId: calendarIdUsado, eventId: gcalEventId },
            gcalErr,
          )
          gcal_sync_status = 'failed'
        }
        // `clinica_id` no es decorativo aunque `id` sea la clave primaria: con
        // el cliente admin la RLS no acota nada y el id viene de la URL.
        const { error: errEstado } = await admin
          .from('appointments')
          .update({ gcal_sync_status })
          .eq('id', id)
          .eq('clinica_id', clinicaId)
        if (errEstado) {
          registrarFalloGCal(
            { operacion: 'appointments.update(gcal_sync_status)', userId, calendarId: calendarIdUsado },
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
    let gcalSync: 'pending' | 'disconnected' | 'skipped' = 'skipped'
    if (existing.google_event_id && gcalFieldChanged) {
      const { data: tokenGoogle } = await supabase
        .from('google_tokens')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      gcalSync = tokenGoogle ? 'pending' : 'disconnected'
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

    const { data: profile } = await supabase.from('profiles').select('clinica_id').eq('id', user.id).single()
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

    if (existing.google_event_id) {
      const gcalEventId = existing.google_event_id
      const userId = user.id
      // Mismo motivo que en el PUT (ver el comentario largo de arriba): el
      // cliente admin es lo que permitirá leerle el token a alguien que no sea
      // quien ejecuta la baja. No tiene nada que ver con `after()` ni con las
      // cookies. Con el cliente admin, la única consulta propia de esta baja es
      // el borrado del evento en Google, que no toca la base; lo que
      // `conCalendarioSpinus` consulta por dentro ya va acotado por `userId`
      // y, en `desvincularCitas`, por la `clinica_id` de ese perfil.
      const admin = createAdminClient()
      after(async () => {
        let calendarIdUsado: string | null = null
        try {
          await conCalendarioSpinus(admin, userId, (calendar, calendarId) => {
            calendarIdUsado = calendarId
            return calendar.events.delete({ calendarId, eventId: gcalEventId })
          })
        } catch (gcalErr) {
          // Sigue siendo best-effort —la cita ya se borró de Spinus y no hay
          // nada que reintentar—, pero el evento queda vivo en el calendario
          // del médico y hasta hoy no había forma de enterarse.
          registrarFalloGCal(
            { operacion: 'events.delete (baja de cita)', userId, calendarId: calendarIdUsado, eventId: gcalEventId },
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
