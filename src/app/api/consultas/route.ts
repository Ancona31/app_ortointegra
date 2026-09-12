import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { fueraDeLimitesDuros, type SignoVitalKey } from '@/lib/signosVitalesRangos'

/* ── POST /api/consultas — crear nota médica ───────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role, titulo, nombres, apellido_paterno, apellido_materno, especialidad, cedula_profesional, cedula_especialidad')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    // Gate 5.F: replica en TS la lógica de los helpers clinica_no_suspendida()
    // y clinica_tiene_acceso() para devolver HTTP 403 con mensaje claro ANTES
    // de que el INSERT toque la BD. La garantía real vive en la policy
    // RESTRICTIVE consultas_gates_insert (5.F Paso 3); este guard es UX.
    // Tokens reutilizan los que emite el RPC de pacientes post-5.E.
    const { data: clinicaGate } = await supabase
      .from('clinicas')
      .select('suspendida, suscripcion_estado, es_vip_grant, ha_tenido_acceso_premium, stripe_subscription_id')
      .eq('id', profile.clinica_id)
      .single()

    // Check defensivo: si la query falló (BD saturada, FK rota, error
    // transitorio), fail-CLOSED. Alinea el comportamiento con
    // clinica_no_suspendida() en SQL (fail-CLOSED vía COALESCE(..., false)).
    if (!clinicaGate) {
      return NextResponse.json(
        { error: 'clinic_lookup_failed', message: 'Error temporal. Intenta de nuevo en unos segundos.' },
        { status: 503 }
      )
    }

    // Caso A: clínica suspendida (espeja clinica_no_suspendida() = false)
    if (clinicaGate.suspendida === true) {
      return NextResponse.json(
        { error: 'clinic_suspended', message: 'Tu cuenta está suspendida. Contacta a soporte para reactivarla.' },
        { status: 403 }
      )
    }

    // Caso B: clínica sin acceso (espeja clinica_tiene_acceso() = false).
    // Bloquea solo a ex-cliente premium sin VIP-grant y sin suscripción
    // activa. Lógica derivada por De Morgan de las 3 ramas del helper SQL:
    //   tiene_acceso = VIP OR (stripe AND activo) OR no_premium
    //   bloquear = NOT VIP AND NOT (stripe AND activo) AND NOT no_premium
    const tieneVip = clinicaGate.es_vip_grant === true
    const tieneSuscripcionActiva =
      clinicaGate.stripe_subscription_id != null &&
      clinicaGate.suscripcion_estado === 'activo'
    const esFreeDeBuenaFe = clinicaGate.ha_tenido_acceso_premium !== true
    if (!tieneVip && !tieneSuscripcionActiva && !esFreeDeBuenaFe) {
      return NextResponse.json(
        { error: 'subscription_inactive', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevas consultas.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { paciente_id, consultorio_id, appointment_id } = body
    if (!paciente_id) return NextResponse.json({ error: 'paciente_id requerido' }, { status: 400 })

    // Fase 2.6: consultorio_id es obligatorio para nuevas consultas (multiconsultorio).
    if (!consultorio_id) {
      return NextResponse.json(
        { error: 'consultorio_id_required', message: 'Debes seleccionar un consultorio para la consulta.' },
        { status: 400 }
      )
    }

    // Validar formato UUID antes de query (evita 500 con entrada malformada).
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(consultorio_id)) {
      return NextResponse.json(
        { error: 'consultorio_invalido', message: 'consultorio_id no tiene formato UUID válido.' },
        { status: 400 }
      )
    }

    const notaOrigen: 'ia' | 'manual' =
      body.nota_origen === 'manual' ? 'manual' : 'ia'

    // motivo_consulta es la única columna NOT NULL de consultas → obligatoria en
    // ambos modos (en IA es el textarea del caso).
    if (!body.motivo_consulta?.trim()) {
      return NextResponse.json(
        { error: 'Campos obligatorios faltantes: Motivo de consulta' },
        { status: 400 }
      )
    }

    // NOM-004-SSA3: en modo MANUAL el médico captura a mano → exploración,
    // diagnóstico y plan son obligatorios. En modo IA esos van DENTRO de la
    // narrativa (exploración/plan) o pueden no venir (dx); no se exigen aquí.
    // Defensa en profundidad: el endpoint no confía solo en el frontend.
    if (notaOrigen === 'manual') {
      const camposFaltantes: string[] = []
      if (!body.exploracion_fisica?.trim()) camposFaltantes.push('Exploración física')
      if (!body.diagnosticos || (Array.isArray(body.diagnosticos) && body.diagnosticos.length === 0)) camposFaltantes.push('Diagnóstico')
      if (!body.plan_tratamiento?.trim()) camposFaltantes.push('Plan de tratamiento')
      if (camposFaltantes.length > 0) {
        return NextResponse.json(
          { error: `Campos obligatorios faltantes: ${camposFaltantes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Fase 3: validación de signos vitales, ESTRICTAMENTE condicional a su
    // presencia. Ausente/null → null (offline-mode y clientes viejos no lo
    // envían y deben seguir funcionando intactos). Si viene, se valida estricto.
    const VITALES_KEYS = [
      'ta_sistolica', 'ta_diastolica', 'fc', 'fr', 'temp', 'spo2', 'peso_kg', 'talla_cm',
    ] as const
    let signosVitalesValidado: Record<string, number> | null = null
    const svRaw: unknown = body.signos_vitales
    if (svRaw !== undefined && svRaw !== null) {
      if (typeof svRaw !== 'object' || Array.isArray(svRaw)) {
        return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
      }
      const validado: Record<string, number> = {}
      for (const [k, v] of Object.entries(svRaw as Record<string, unknown>)) {
        if (!VITALES_KEYS.includes(k as (typeof VITALES_KEYS)[number])) {
          return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
        }
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
        }
        validado[k] = v
      }
      // fc obligatoria y > 0 dentro del objeto
      if (!(validado.fc > 0)) {
        return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
      }
      // Límites duros para las 6 vitales; peso_kg/talla_cm solo number finito > 0.
      const VITALES_CON_LIMITE: SignoVitalKey[] = ['ta_sistolica', 'ta_diastolica', 'fc', 'fr', 'temp', 'spo2']
      for (const key of VITALES_CON_LIMITE) {
        if (key in validado && fueraDeLimitesDuros(key, validado[key])) {
          return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
        }
      }
      for (const key of ['peso_kg', 'talla_cm'] as const) {
        if (key in validado && !(validado[key] > 0)) {
          return NextResponse.json({ error: 'signos_vitales_invalido' }, { status: 400 })
        }
      }
      signosVitalesValidado = validado
    }

    // RLS filtra por clinica_id automáticamente
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('id', paciente_id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Fase 2.6: validar consultorio y cargar snapshot inmutable.
    // El consultorio debe existir, estar activo, y pertenecer al médico
    // autenticado (que es siempre el dueño de la consulta).
    const { data: consultorio, error: errConsultorio } = await supabase
      .from('consultorios')
      .select('id, nombre, nombre_corto, direccion, telefono, timezone')
      .eq('id', consultorio_id)
      .eq('medico_id', user.id)
      .eq('activo', true)
      .maybeSingle()

    if (errConsultorio) {
      console.error('[POST /api/consultas] error cargando consultorio:', errConsultorio)
      return NextResponse.json({ error: errConsultorio.message }, { status: 500 })
    }
    if (!consultorio) {
      return NextResponse.json(
        { error: 'consultorio_invalido', message: 'El consultorio no existe, está archivado, o no te pertenece.' },
        { status: 400 }
      )
    }

    /* ── ¿DE QUÉ CITA SALIÓ ESTA CONSULTA? (plan §12.13) ────────────────────
       El id llega por el `?cita=` del enlace de «Iniciar consulta» y viaja en
       el cuerpo. Se resuelve AQUÍ, antes del INSERT, porque la columna entra en
       la misma escritura.

       ⚠️ NINGÚN FALLO DE ESTE BLOQUE PUEDE IMPEDIR QUE SE GUARDE LA NOTA. Es la
       decisión de §12.13 llevada a su sitio: bloquear la atención de un paciente
       por un vínculo que no cuadra es peor que una cita con el estado
       desactualizado. Un id malformado, una cita de otra clínica, una cita de
       OTRO paciente o una que no existe caen todas al mismo sitio —se ignora el
       vínculo, se guarda la nota, queda la línea de log— y no a un 400 que
       dejaría al médico sin poder guardar lo que acaba de escribir.

       LA COMPROBACIÓN DEL PACIENTE NO ES CEREMONIA. Sin ella, un id manipulado
       en la barra de direcciones marcaría como atendida cualquier otra cita
       visible para quien escribe. La RLS de `appointments_select` ya acota
       clínica y médico —por eso basta con el cliente de sesión, sin admin—,
       pero no sabe nada del paciente de esta consulta. */
    const UUID_CITA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let citaVinculada: string | null = null
    if (typeof appointment_id === 'string' && appointment_id !== '') {
      if (!UUID_CITA.test(appointment_id)) {
        console.error('[POST /api/consultas] appointment_id con formato inválido; se guarda la nota sin vincular')
      } else {
        const { data: cita } = await supabase
          .from('appointments')
          .select('id')
          .eq('id', appointment_id)
          .eq('clinica_id', profile.clinica_id)
          .eq('paciente_id', paciente_id)
          .maybeSingle()
        if (cita) citaVinculada = cita.id
        else console.error('[POST /api/consultas] la cita no existe, no es de esta clínica o es de otro paciente; se guarda la nota sin vincular')
      }
    }

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('logo_url')
      .eq('id', profile.clinica_id)
      .single()

    const { data: consulta, error } = await supabase.from('consultas').insert({
      paciente_id,
      medico_id: user.id,
      fecha: new Date().toISOString(),
      motivo_consulta:           body.motivo_consulta || null,
      exploracion_fisica:        body.exploracion_fisica || null,
      diagnosticos:              body.diagnosticos || null,
      plan_tratamiento:          body.plan_tratamiento || null,
      notas_evolucion:           body.notas_evolucion || null,
      proxima_cita:              body.proxima_cita || null,
      medicamentos:              body.medicamentos || null,
      signos_vitales:            signosVitalesValidado ?? null,
      nota_origen:               notaOrigen,
      medico_nombre:             componerNombreMedicoCompleto({
        titulo: profile.titulo,
        nombres: profile.nombres,
        apellido_paterno: profile.apellido_paterno,
        apellido_materno: profile.apellido_materno,
      }) || null,
      medico_especialidad:       profile.especialidad || null,
      medico_cedula_profesional: profile.cedula_profesional || null,
      medico_cedula_especialidad: profile.cedula_especialidad || null,
      medico_logo_url:           clinica?.logo_url || null,
      // Snapshot inmutable del consultorio (Fase 2.6).
      consultorio_id:            consultorio.id,
      consultorio_nombre:        consultorio.nombre,
      consultorio_nombre_corto:  consultorio.nombre_corto,
      consultorio_direccion:     consultorio.direccion,
      consultorio_telefono:      consultorio.telefono,
      consultorio_timezone:      consultorio.timezone,
      // De qué cita salió. NULL cuando el paciente llegó sin agendar, que es un
      // caso corriente y no una carencia.
      appointment_id:            citaVinculada,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    /* ── MARCAR LA CITA COMO ATENDIDA (plan §12.13) ─────────────────────────
       Va DESPUÉS del INSERT y a propósito: si la nota no se guardó, no hay
       nada que atestiguar.

       ── POR QUÉ AQUÍ Y NO EN EL BOTÓN ────────────────────────────────────
       §12.13 decía que lo escribiera «Iniciar consulta» al pulsarlo. No se
       puede: los tres botones son enlaces de navegación, así que una petición
       disparada en el clic compite con la navegación y el navegador puede
       abortarla — «el estado no se guarda» sería el caso normal, no el raro. Y
       el «se reintenta» que aquel texto prometía no tenía dónde vivir.
       Aquí no hay petición que abortar, no hace falta reintento, y da igual
       desde cuál de los tres botones se haya llegado. Efecto secundario y
       buscado: quien pulsa y se arrepiente sin escribir nada NO deja la cita
       marcada.

       ── LA IDEMPOTENCIA SALE DEL `WHERE`, NO DE UNA LECTURA PREVIA ────────
       El `.in(...)` es a la vez la transición permitida y la idempotencia. Una
       segunda consulta sobre la misma cita no casa ninguna fila y no hace nada.
       Sin leer antes de escribir no hay carrera entre las dos cosas.

       ── 'cancelled' Y 'no_show' NO SE TOCAN, Y ES DELIBERADO ──────────────
       Machacarlos borraría una afirmación que alguien hizo a propósito. Y en
       'cancelled' hay una segunda razón: su evento de Google lleva el prefijo
       «CANCELADA — » en el título, así que la base diría «atendida» mientras el
       calendario del paciente sigue diciendo lo contrario. Si el caso ocurre de
       verdad, se corrige a mano en el modal, que es donde se afirmó.

       ── CERO FILAS NO ES UN ERROR, Y UN FALLO TAMPOCO ABORTA NADA ─────────
       La nota ya está guardada y es lo que importa. Como mucho, la línea de log.

       ── COSTE ACEPTADO: GOOGLE NO SE ENTERA ──────────────────────────────
       Esto no pasa por `PUT /api/appointments/[id]`, así que el evento conserva
       su color y no recibe el colorId de 'attended'. Replicarlo aquí metería un
       `events.get` + `events.patch` en el camino crítico de guardar una nota
       clínica, a cambio de un matiz de color en un evento que ya pasó. El
       colorId sí funciona cuando alguien marca el estado a mano desde el modal.

       `clinica_id` explícito aunque el cliente sea el de sesión y la RLS ya
       acote: deja la barrera escrita para quien mañana cambie el cliente. */
    if (citaVinculada) {
      const { error: errCita } = await supabase
        .from('appointments')
        .update({ status: 'attended', updated_at: new Date().toISOString() })
        .eq('id', citaVinculada)
        .eq('clinica_id', profile.clinica_id)
        .in('status', ['scheduled', 'confirmed'])
      if (errCita) console.error('[POST /api/consultas] no se pudo marcar la cita como atendida:', errCita.message)
    }

    return NextResponse.json({ consulta })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
