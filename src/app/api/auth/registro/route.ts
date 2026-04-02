import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS } from '@/lib/plans'

// Paso 1: solo crea la clínica y devuelve el ID
// El usuario se crea en el cliente con supabase.auth.signUp()
// El perfil se crea en /api/auth/complete-registro tras confirmar el email
export async function POST(req: NextRequest) {
  const {
    email, password, nombre, nombreClinica,
    titulo, especialidad, cedula_profesional, cedula_especialidad,
  } = await req.json()

  if (!email || !password || !nombre || !nombreClinica || !titulo || !especialidad || !cedula_profesional) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()
  const limits = PLAN_LIMITS.free

  // Verificar si el email ya está registrado
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1, page: 1 })
  // Buscar por email de forma más eficiente con un filtro de perfil
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', (await admin.auth.admin.getUserByEmail(email)).data.user?.id ?? '')
    .maybeSingle()

  const { data: existingUser } = await admin.auth.admin.getUserByEmail(email)
  if (existingUser.user) {
    return NextResponse.json({ error: 'Este correo ya está registrado. Inicia sesión.' }, { status: 409 })
  }

  // Crear clínica con plan gratuito
  const { data: clinica, error: clinicaError } = await admin
    .from('clinicas')
    .insert({
      nombre: nombreClinica,
      plan: 'free',
      suscripcion_estado: 'activo',
      max_medicos: limits.max_medicos,
      max_secretarias: limits.max_secretarias,
      max_pacientes: limits.max_pacientes,
    })
    .select('id')
    .single()

  if (clinicaError || !clinica) {
    return NextResponse.json({ error: 'Error al crear el consultorio. Intenta de nuevo.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    clinica_id: clinica.id,
  })
}
