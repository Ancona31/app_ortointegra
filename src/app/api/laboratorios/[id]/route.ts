import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ── DELETE /api/laboratorios/[id] ─────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/laboratorios/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params

    // RLS filtra por clinica_id
    const { data: lab } = await supabase.from('laboratorios').select('id').eq('id', id).single()
    if (!lab) return NextResponse.json({ error: 'Laboratorio no encontrado' }, { status: 404 })

    const { error } = await supabase.from('laboratorios').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
