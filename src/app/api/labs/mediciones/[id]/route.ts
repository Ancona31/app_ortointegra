import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/labs/mediciones/[id]'>,
) {
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

    const { id } = await ctx.params

    // RLS de mediciones_analitos filtra por clínica vía paciente.
    const { data: medicion } = await supabase
      .from('mediciones_analitos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!medicion) {
      return NextResponse.json({ error: 'Medición no encontrada' }, { status: 404 })
    }

    const { data: deleted, error: deleteError } = await supabase
      .from('mediciones_analitos')
      .delete()
      .eq('id', id)
      .select('id')

    if (deleteError) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
