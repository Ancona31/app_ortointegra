import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id) return NextResponse.json({ medicos: [] })

  const { data: medicos } = await supabase
    .from('profiles')
    .select('id, nombre, titulo, especialidad')
    .eq('clinica_id', profile.clinica_id)
    .eq('role', 'medico')
    .order('nombre')

  return NextResponse.json({ medicos: medicos || [] })
}
