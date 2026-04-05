import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('id, clinica_id, role').eq('id', user.id).single()
  return data ? { ...data, userId: user.id } : null
}

async function verificarOwnership(admin: ReturnType<typeof createAdminClient>, consultaId: string, clinicaId: string) {
  const { data: consulta } = await admin
    .from('consultas')
    .select('id, paciente_id')
    .eq('id', consultaId)
    .single()
  if (!consulta) return null

  const { data: paciente } = await admin
    .from('pacientes')
    .select('id')
    .eq('id', consulta.paciente_id)
    .eq('clinica_id', clinicaId)
    .single()

  return paciente ? consulta : null
}

/* ── PUT /api/consultas/[id] — editar nota médica ──────── */
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/consultas/[id]'>) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const admin = createAdminClient()

    const consulta = await verificarOwnership(admin, id, profile.clinica_id)
    if (!consulta) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    const body = await req.json()
    const allowed = ['motivo_consulta', 'notas_evolucion', 'proxima_cita', 'exploracion_fisica', 'diagnosticos', 'plan_tratamiento', 'medicamentos']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key] ?? null
    }

    const { data, error } = await admin.from('consultas').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ consulta: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── DELETE /api/consultas/[id] — eliminar nota médica ─── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/consultas/[id]'>) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const admin = createAdminClient()

    const consulta = await verificarOwnership(admin, id, profile.clinica_id)
    if (!consulta) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    const { error } = await admin.from('consultas').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
