import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { CrearUsuarioSchema } from '@/lib/perfil/schemas'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, clinica_id, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (!creatorProfile || !canManageClinica(creatorProfile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const parsed = CrearUsuarioSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  // Campos presentes en AMBAS variantes → desestructuración directa segura.
  const { email, password, role, nombres, apellido_paterno, apellido_materno } = parsed.data

  // C2 — campos exclusivos de médico: estrechar SOBRE parsed.data (la discriminante
  // se lee del objeto, no de una copia desestructurada) para que TS narre la unión.
  // Para secretaria → null EXPLÍCITO (el upsert escribe la columna con NULL y anula
  // el DEFAULT 'Dr.' de 02_tables.sql:406; omitirla dejaría actuar el default).
  const titulo = parsed.data.role === 'medico' ? (parsed.data.titulo || 'Dr.') : null
  const especialidad = parsed.data.role === 'medico' ? (parsed.data.especialidad || null) : null
  const cedula_profesional = parsed.data.role === 'medico' ? (parsed.data.cedula_profesional || null) : null
  const cedula_especialidad = parsed.data.role === 'medico' ? (parsed.data.cedula_especialidad || null) : null

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

  // Crear perfil. Nombre en 3 campos estructurados (NO `nombre` legacy).
  // C1 — nombre_confirmado condicional al rol: secretaria→true (el admin captura
  // su nombre y no hay onboarding que lo reconfirme); médico invitado→false (lo
  // confirmará en su onboarding, 3.C).
  // titulo/especialidad/cédulas ya vienen resueltos arriba (null para secretaria).
  await admin.from('profiles').upsert({
    id: newUser.user.id,
    role,
    nombres,
    apellido_paterno,
    apellido_materno,
    nombre_confirmado: parsed.data.role === 'secretaria',
    clinica_id: clinicaId ?? null,
    titulo,
    especialidad,
    cedula_profesional,
    cedula_especialidad,
  })

  return NextResponse.json({ ok: true })
}
