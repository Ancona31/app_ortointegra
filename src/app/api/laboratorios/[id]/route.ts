import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verificarOwnership(admin: ReturnType<typeof createAdminClient>, labId: string, clinicaId: string) {
  const { data: lab } = await admin.from('laboratorios').select('id, paciente_id').eq('id', labId).single()
  if (!lab) return null
  const { data: paciente } = await admin.from('pacientes').select('id').eq('id', lab.paciente_id).eq('clinica_id', clinicaId).single()
  return paciente ? lab : null
}

/* ── DELETE /api/laboratorios/[id] ─────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/laboratorios/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const admin = createAdminClient()

    const lab = await verificarOwnership(admin, id, profile.clinica_id)
    if (!lab) return NextResponse.json({ error: 'Laboratorio no encontrado' }, { status: 404 })

    const { error } = await admin.from('laboratorios').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
