import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
