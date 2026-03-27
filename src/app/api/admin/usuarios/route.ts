import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id').eq('id', user.id).single()
  if (!profile || !['medico', 'admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Traer todos los usuarios de Auth
  const { data: authUsers } = await admin.auth.admin.listUsers()

  // Traer perfiles de la misma clínica
  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .eq('clinica_id', profile.clinica_id)

  // Combinar auth users con profiles
  const usuarios = (profiles || []).map(p => {
    const authUser = authUsers?.users?.find(u => u.id === p.id)
    return {
      id: p.id,
      role: p.role,
      nombre: p.nombre,
      clinica_id: p.clinica_id,
      email: authUser?.email ?? '—',
    }
  })

  return NextResponse.json({ usuarios })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['medico', 'admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (userId === user.id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)
  await admin.from('profiles').delete().eq('id', userId)

  return NextResponse.json({ ok: true })
}
