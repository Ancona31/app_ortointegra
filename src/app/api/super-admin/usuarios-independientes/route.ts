import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  const { email, password, nombre, titulo, especialidad, cedula_profesional } = await req.json()

  if (!email || !password || !nombre)
    return NextResponse.json({ error: 'Faltan campos obligatorios: email, password, nombre' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Crear la clínica personal del usuario independiente
  const { data: clinica, error: clinicaError } = await admin
    .from('clinicas')
    .insert({
      nombre,
      tipo: 'independiente',
      max_medicos: 1,
      max_secretarias: 0,
    })
    .select('id')
    .single()

  if (clinicaError || !clinica)
    return NextResponse.json({ error: 'Error al crear la cuenta: ' + clinicaError?.message }, { status: 500 })

  // 2. Crear el usuario en Supabase Auth
  const { data: newUser, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (userError) {
    // Limpiar la clínica creada si falla el usuario
    await admin.from('clinicas').delete().eq('id', clinica.id)
    return NextResponse.json({ error: userError.message }, { status: 400 })
  }

  // 3. Crear el perfil del médico ligado a su clínica personal
  const { error: profileError } = await admin.from('profiles').upsert({
    id: newUser.user.id,
    role: 'medico',
    nombre,
    clinica_id: clinica.id,
    titulo: titulo || 'Dr.',
    especialidad: especialidad || null,
    cedula_profesional: cedula_profesional || null,
  })

  if (profileError) {
    // Limpiar si falla el perfil
    await admin.auth.admin.deleteUser(newUser.user.id)
    await admin.from('clinicas').delete().eq('id', clinica.id)
    return NextResponse.json({ error: 'Error al crear el perfil: ' + profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clinica_id: clinica.id })
}
