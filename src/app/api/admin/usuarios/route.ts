import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ROLE_LEVEL: Record<string, number> = {
  secretaria: 1,
  medico: 2,
  admin: 3,
  super_admin: 4,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id').eq('id', user.id).single()

  // Solo admin y super_admin pueden gestionar usuarios
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: authUsers } = await admin.auth.admin.listUsers()

  // Traer perfiles de la misma clínica
  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .eq('clinica_id', profile.clinica_id)

  const callerLevel = ROLE_LEVEL[profile.role] ?? 0

  // Solo mostrar usuarios con rol MENOR al del solicitante
  const usuarios = (profiles || [])
    .filter(p => (ROLE_LEVEL[p.role] ?? 0) < callerLevel)
    .map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      return {
        id: p.id,
        role: p.role,
        nombre: p.nombre,
        clinica_id: p.clinica_id,
        email: authUser?.email ?? '—',
      }
    })

  // Info de licencia
  let licencia = null
  if (profile.clinica_id) {
    const { data: clinica } = await admin
      .from('clinicas')
      .select('max_medicos, max_secretarias')
      .eq('id', profile.clinica_id)
      .single()
    if (clinica) licencia = { max_medicos: clinica.max_medicos, max_secretarias: clinica.max_secretarias }
  }

  return NextResponse.json({ usuarios, licencia })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Solo admin y super_admin pueden eliminar
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (userId === user.id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  // Verificar que el objetivo tiene un rol menor al del solicitante
  const admin = createAdminClient()
  const { data: targetProfile } = await admin.from('profiles').select('role').eq('id', userId).single()

  const callerLevel = ROLE_LEVEL[profile.role] ?? 0
  const targetLevel = ROLE_LEVEL[targetProfile?.role ?? ''] ?? 0

  if (targetLevel >= callerLevel) {
    return NextResponse.json({ error: 'No puedes eliminar a un usuario con igual o mayor rango' }, { status: 403 })
  }

  await admin.auth.admin.deleteUser(userId)
  await admin.from('profiles').delete().eq('id', userId)

  return NextResponse.json({ ok: true })
}
