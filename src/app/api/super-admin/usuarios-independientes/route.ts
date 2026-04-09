import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

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

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_crear_independiente',
    tabla: 'clinicas',
    registroId: clinica.id,
    descripcion: `email=${email}; nombre=${nombre}`,
  })

  return NextResponse.json({ ok: true, clinica_id: clinica.id })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const { clinicaId } = await req.json()
  if (!clinicaId) return NextResponse.json({ error: 'clinicaId requerido' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Obtener el perfil del usuario dueño de esta clínica
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('clinica_id', clinicaId)
    .single()

  // 2. Obtener todos los pacientes de la clínica
  const { data: pacientes } = await admin
    .from('pacientes')
    .select('id')
    .eq('clinica_id', clinicaId)

  const pacienteIds = (pacientes || []).map(p => p.id)

  // 3. Soft delete de pacientes — NOM-004-SSA3: retención mínima 5 años
  // Los expedientes clínicos NO se borran, solo se marcan como inactivos.
  // Los documentos, laboratorios y consultas permanecen intactos.
  if (pacienteIds.length > 0) {
    await admin.from('pacientes').update({
      activo: false,
      fecha_baja: new Date().toISOString(),
    }).in('id', pacienteIds)
  }

  // 4. Eliminar jobs de PDF del usuario
  if (profile?.id) {
    await admin.from('pdf_jobs').delete().eq('user_id', profile.id)
  }

  // 5. Eliminar el perfil
  if (profile?.id) {
    await admin.from('profiles').delete().eq('id', profile.id)
    // 6. Eliminar usuario de Auth
    await admin.auth.admin.deleteUser(profile.id)
  }

  // 7. Eliminar la clínica personal
  const { error } = await admin.from('clinicas').delete().eq('id', clinicaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_eliminar_independiente',
    tabla: 'clinicas',
    registroId: String(clinicaId),
    descripcion: `pacientes_anonimizados=${pacienteIds.length}`,
  })

  return NextResponse.json({ ok: true })
}
