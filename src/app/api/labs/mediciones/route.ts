import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CrearMedicionSchema } from '@/lib/labs/schemas'
import { fechaHoraLocalAInstante, TZ_CLINICA } from '@/lib/dates'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asociada' }, { status: 403 })
    }

    // 5.I Paso 1: Gate de suscripción (D-5.I-GATES, replicado de /api/consultas)
    const { data: clinicaGate } = await supabase
      .from('clinicas')
      .select('suspendida, suscripcion_estado, es_vip_grant, ha_tenido_acceso_premium, stripe_subscription_id')
      .eq('id', profile.clinica_id)
      .single()

    if (!clinicaGate) {
      return NextResponse.json(
        { error: 'clinic_lookup_failed', message: 'Error temporal. Intenta de nuevo en unos segundos.' },
        { status: 503 }
      )
    }

    if (clinicaGate.suspendida === true) {
      return NextResponse.json(
        { error: 'clinic_suspended', message: 'Tu cuenta está suspendida. Contacta a soporte para reactivarla.' },
        { status: 403 }
      )
    }

    const tieneVip = clinicaGate.es_vip_grant === true
    const tieneSuscripcionActiva =
      clinicaGate.stripe_subscription_id != null &&
      clinicaGate.suscripcion_estado === 'activo'
    const esFreeDeBuenaFe = clinicaGate.ha_tenido_acceso_premium !== true

    if (!tieneVip && !tieneSuscripcionActiva && !esFreeDeBuenaFe) {
      return NextResponse.json(
        { error: 'subscription_inactive', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevas mediciones.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const pacienteId = typeof body?.pacienteId === 'string' ? body.pacienteId : null
    if (!pacienteId) {
      return NextResponse.json({ error: 'pacienteId requerido' }, { status: 400 })
    }

    const parsed = CrearMedicionSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos' },
        { status: 400 },
      )
    }
    const input = parsed.data

    // RLS valida clínica, pero defensa en profundidad: verificar paciente.
    const { data: paciente, error: pacError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('id', pacienteId)
      .maybeSingle()
    if (pacError) return NextResponse.json({ error: pacError.message }, { status: 500 })
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // DEUDA CONSCIENTE — `TZ_CLINICA` aquí es un apaño, no la respuesta.
    //
    // `input.fecha` e `input.hora` son hora DE PARED: el médico tecleó "las
    // 9:00" en `ModalAgregarMedicion`, así que el huso correcto para
    // convertirlas a instante es el de SU DISPOSITIVO, no el del Centro. En
    // Sonora esta línea guarda la medición una hora tarde.
    //
    // No se cableó porque el huso no viaja por el cable: haría falta un campo
    // nuevo en las tres variantes de `CrearMedicionSchema`, mandarlo desde el
    // modal y validarlo aquí contra `Intl.supportedValuesOf('timeZone')`.
    // Cinco archivos y una validación nueva para un dato que no es una hora
    // de cita. Se dejó anotado en vez de arreglado (commit B de husos,
    // agosto de 2026). Hasta ese commit la zona del Centro llegaba sola, por
    // el valor por defecto de `fechaHoraLocalAInstante`; ahora al menos se ve.
    const medidoEn = fechaHoraLocalAInstante(input.fecha, input.hora, TZ_CLINICA)
    const notas = input.notas?.trim() || null

    if (input.tipo === 'catalogo') {
      const { data: analito, error: analitoError } = await supabase
        .from('analitos_catalogo')
        .select('id, activo')
        .eq('id', input.analitoId)
        .maybeSingle()
      if (analitoError) return NextResponse.json({ error: analitoError.message }, { status: 500 })
      if (!analito || !analito.activo) {
        return NextResponse.json({ error: 'Analito no disponible' }, { status: 404 })
      }

      const { error } = await supabase.from('mediciones_analitos').insert({
        paciente_id: pacienteId,
        analito_id: input.analitoId,
        nombre_custom: null,
        unidad_custom: null,
        categoria_custom: null,
        valor: input.valor,
        medido_en: medidoEn,
        notas,
        creado_por: profile.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, insertados: 1 })
    }

    if (input.tipo === 'custom') {
      const { error } = await supabase.from('mediciones_analitos').insert({
        paciente_id: pacienteId,
        analito_id: null,
        nombre_custom: input.nombreCustom,
        unidad_custom: input.unidadCustom,
        categoria_custom: input.categoriaCustom,
        valor: input.valor,
        medido_en: medidoEn,
        notas,
        creado_por: profile.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, insertados: 1 })
    }

    // TA pareada — 2 INSERTs en un solo array, mismo medido_en
    const { data: analitosTA, error: taError } = await supabase
      .from('analitos_catalogo')
      .select('id, clave')
      .in('clave', ['ta_sistolica', 'ta_diastolica'])
    if (taError) return NextResponse.json({ error: taError.message }, { status: 500 })

    const sistolica = analitosTA?.find(a => a.clave === 'ta_sistolica')
    const diastolica = analitosTA?.find(a => a.clave === 'ta_diastolica')
    if (!sistolica || !diastolica) {
      return NextResponse.json(
        { error: 'Catálogo TA incompleto (ta_sistolica/ta_diastolica no encontrados)' },
        { status: 500 },
      )
    }

    const { error } = await supabase.from('mediciones_analitos').insert([
      {
        paciente_id: pacienteId,
        analito_id: sistolica.id,
        nombre_custom: null,
        unidad_custom: null,
        categoria_custom: null,
        valor: input.valorSistolica,
        medido_en: medidoEn,
        notas,
        creado_por: profile.id,
      },
      {
        paciente_id: pacienteId,
        analito_id: diastolica.id,
        nombre_custom: null,
        unidad_custom: null,
        categoria_custom: null,
        valor: input.valorDiastolica,
        medido_en: medidoEn,
        notas,
        creado_por: profile.id,
      },
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, insertados: 2 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
