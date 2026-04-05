import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* ── DELETE /api/documentos/[id] ───────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/documentos/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const admin = createAdminClient()

    // Verificar ownership: doc → paciente → clinica
    const { data: doc } = await admin.from('documentos').select('id, paciente_id').eq('id', id).single()
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    if (doc.paciente_id) {
      const { data: paciente } = await admin.from('pacientes').select('id').eq('id', doc.paciente_id).eq('clinica_id', profile.clinica_id).single()
      if (!paciente) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const { error } = await admin.from('documentos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
