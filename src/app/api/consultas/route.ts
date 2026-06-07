import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ── POST /api/consultas — crear nota médica ───────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role, nombre, titulo, especialidad, cedula_profesional, cedula_especialidad')
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
    const { paciente_id } = body
    if (!paciente_id) return NextResponse.json({ error: 'paciente_id requerido' }, { status: 400 })

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

    // RLS filtra por clinica_id automáticamente
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('id', paciente_id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

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
      nota_origen:               notaOrigen,
      medico_nombre:             `${profile.titulo || ''} ${profile.nombre || ''}`.trim() || null,
      medico_especialidad:       profile.especialidad || null,
      medico_cedula_profesional: profile.cedula_profesional || null,
      medico_cedula_especialidad: profile.cedula_especialidad || null,
      medico_logo_url:           clinica?.logo_url || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ consulta })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
