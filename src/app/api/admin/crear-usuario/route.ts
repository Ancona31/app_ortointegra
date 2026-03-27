import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verificar que quien hace la petición es médico
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'medico') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { email, password, nombre, role } = await req.json()
  if (!email || !password || !role) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  // Obtener clinica_id del usuario que hace la petición
  const { data: creatorProfile } = await supabase.from('profiles').select('clinica_id').eq('id', user.id).single()

  const admin = createAdminClient()

  // Crear usuario en Supabase Auth
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Crear perfil con rol y clinica_id
  await admin.from('profiles').upsert({
    id: newUser.user.id,
    role,
    nombre,
    clinica_id: creatorProfile?.clinica_id ?? null,
  })

  return NextResponse.json({ ok: true })
}
