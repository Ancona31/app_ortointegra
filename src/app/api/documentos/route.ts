import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ──────────────────────────────────────────────────────────────────────
   POST /api/documentos — crear documento (receta, solicitud lab/imagen,
   consentimiento, escrito médico, internamiento, honorarios, plan
   suplementación, etc.)

   Contrato del body (generado por outbox-engine.syncItem):
     {
       tipo: string              // subtype del documento
       contenido: unknown        // payload JSON con los datos del form
       client_id?: string        // UUID v4 o folio (R-xxx) para idempotencia
       paciente_id?: string      // opcional — FK a pacientes
     }

   Idempotencia:
     Si client_id viene y ya existe un documento con ese client_id,
     devolvemos el id existente sin crear duplicado. Este es el
     contrato que permite al outbox reintentar tras un timeout falso
     sin ensuciar la tabla con duplicados.
   ────────────────────────────────────────────────────────────────────── */
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
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    // Gate Fase 8.1: bloquear creación si la clínica está cancelada,
    // no es VIP y ya tiene >5 pacientes activos (ex-cliente pagado).
    // Free de buena fe (≤5 pacientes) NO se ve afectado. Nota: este
    // endpoint es código zombie (el frontend hace inserts directos
    // desde 9 formularios); la barrera real es la RLS policy
    // documentos_block_post_cancellation. Este gate se mantiene por
    // consistencia y defense in depth si el endpoint vuelve a usarse.
    const { data: clinicaGate } = await supabase
      .from('clinicas')
      .select('suscripcion_estado, es_vip_grant')
      .eq('id', profile.clinica_id)
      .single()
    if (clinicaGate?.suscripcion_estado === 'cancelado' && !clinicaGate?.es_vip_grant) {
      const { count: activosCount } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', profile.clinica_id)
        .or('activo.eq.true,activo.is.null')
      if ((activosCount ?? 0) > 5) {
        return NextResponse.json(
          { error: 'subscription_cancelled', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevos documentos.' },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const { tipo, contenido, client_id, paciente_id } = body as {
      tipo?: string
      contenido?: unknown
      client_id?: string
      paciente_id?: string
    }

    if (!tipo || !contenido) {
      return NextResponse.json(
        { error: 'tipo y contenido son obligatorios' },
        { status: 400 }
      )
    }

    // Idempotencia: si ya existe un documento con ese client_id,
    // devolverlo sin crear duplicado. Razón de ser del client_id —
    // previene duplicación por reintentos tras timeouts falsos.
    if (client_id) {
      const { data: existing } = await supabase
        .from('documentos')
        .select('id')
        .eq('client_id', client_id)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ id: existing.id, deduped: true })
      }
    }

    // Validar paciente si viene (RLS filtra por clinica_id automáticamente)
    if (paciente_id) {
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('id')
        .eq('id', paciente_id)
        .single()
      if (!paciente) {
        return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
      }
    }

    const insertPayload: Record<string, unknown> = {
      tipo,
      contenido,
      client_id: client_id ?? null,
    }
    if (paciente_id) insertPayload.paciente_id = paciente_id

    const { data: doc, error } = await supabase
      .from('documentos')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: doc.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
