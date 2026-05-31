import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ── POST /api/consultas/[id]/addendum — agregar nota aclaratoria ── */
export async function POST(req: NextRequest, ctx: RouteContext<'/api/consultas/[id]/addendum'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, nombre, titulo')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

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
        { error: 'subscription_inactive', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevas notas aclaratorias.' },
        { status: 403 }
      )
    }

    const { id } = await ctx.params
    const { contenido } = await req.json()

    if (!contenido?.trim()) {
      return NextResponse.json({ error: 'El addendum no puede estar vacío' }, { status: 400 })
    }

    // Verificar que la consulta existe y pertenece a la clínica (RLS)
    const { data: consulta } = await supabase
      .from('consultas')
      .select('id')
      .eq('id', id)
      .single()
    if (!consulta) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    const medicoNombre = `${profile.titulo || ''} ${profile.nombre || ''}`.trim()

    const { data: addendum, error } = await supabase.from('addendums').insert({
      consulta_id: id,
      contenido: contenido.trim(),
      medico_id: user.id,
      medico_nombre: medicoNombre,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ addendum })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── GET /api/consultas/[id]/addendum — listar addendums ─────────── */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/consultas/[id]/addendum'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params

    const { data, error } = await supabase
      .from('addendums')
      .select('id, contenido, medico_nombre, created_at')
      .eq('consulta_id', id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ addendums: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
