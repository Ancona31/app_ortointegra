import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ clinica: null })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single()

    if (!profile?.clinica_id) return NextResponse.json({ clinica: null })

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('id, nombre, nombre_display, subtitulo, color_primario, color_secundario, logo_url')
      .eq('id', profile.clinica_id)
      .single()

    return NextResponse.json({ clinica })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { color_primario, color_secundario } = await req.json()
  const hexRegex = /^#[0-9A-Fa-f]{6}$/
  if (color_primario && !hexRegex.test(color_primario)) return NextResponse.json({ error: 'Color primario inválido' }, { status: 400 })
  if (color_secundario && !hexRegex.test(color_secundario)) return NextResponse.json({ error: 'Color secundario inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('clinicas')
    .update({ color_primario, color_secundario })
    .eq('id', profile.clinica_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
