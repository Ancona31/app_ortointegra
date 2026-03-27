import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, clinica_id')
    .eq('id', user.id)
    .single()

  if (!creatorProfile || !['medico', 'admin', 'super_admin'].includes(creatorProfile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { email, password, nombre, role, titulo, especialidad, cedula_profesional, cedula_especialidad } = await req.json()
  if (!email || !password || !role) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const clinicaId = creatorProfile.clinica_id
  const admin = createAdminClient()

  // Verificar límites de licencia
  if (clinicaId && (role === 'medico' || role === 'secretaria')) {
    const { data: clinica } = await admin
      .from('clinicas')
      .select('max_medicos, max_secretarias')
      .eq('id', clinicaId)
      .single()

    if (clinica) {
      const { count: countMedicos } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('role', 'medico')

      const { count: countSecretarias } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('role', 'secretaria')

      if (role === 'medico' && clinica.max_medicos !== null && (countMedicos ?? 0) >= clinica.max_medicos) {
        return NextResponse.json({ error: 'Has alcanzado el límite de médicos de tu plan' }, { status: 403 })
      }
      if (role === 'secretaria' && clinica.max_secretarias !== null && (countSecretarias ?? 0) >= clinica.max_secretarias) {
        return NextResponse.json({ error: 'Has alcanzado el límite de secretarias de tu plan' }, { status: 403 })
      }
    }
  }

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
    clinica_id: clinicaId ?? null,
    ...(role === 'medico' ? {
      titulo: titulo || 'Dr.',
      especialidad: especialidad || null,
      cedula_profesional: cedula_profesional || null,
      cedula_especialidad: cedula_especialidad || null,
    } : {}),
  })

  return NextResponse.json({ ok: true })
}
