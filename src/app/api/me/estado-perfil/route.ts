import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nombre, especialidad, cedula_profesional, cedula_especialidad, firma_url, clinica_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const role = profile.role as string

  // Calcular porcentaje de completitud del perfil (médicos y admins)
  let porcentaje = 0
  if (role !== 'secretaria') {
    if (profile.nombre) porcentaje += 25
    if (profile.especialidad) porcentaje += 25
    if (profile.cedula_profesional) porcentaje += 25
    if (profile.cedula_especialidad) porcentaje += 10
    if (profile.firma_url) porcentaje += 15
  } else {
    porcentaje = 100
  }

  const requiereOnboarding = porcentaje < 85 && role !== 'secretaria'

  // Determinar modo del grid
  let gridMode: 'sin_pacientes' | 'nuevo' | 'activo' = 'sin_pacientes'

  const { count: pacientesCount } = await supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })

  if ((pacientesCount ?? 0) === 0) {
    gridMode = 'sin_pacientes'
  } else {
    const { count: consultasCount } = await supabase
      .from('consultas')
      .select('id', { count: 'exact', head: true })

    gridMode = (consultasCount ?? 0) >= 5 ? 'activo' : 'nuevo'
  }

  // Plan de la clínica
  let plan: PlanKey = 'free'
  let suscripcion_estado = 'free'
  if (profile.clinica_id) {
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('plan, suscripcion_estado')
      .eq('id', profile.clinica_id as string)
      .single()
    if (clinica) {
      plan = (clinica.plan as PlanKey) ?? 'free'
      suscripcion_estado = (clinica.suscripcion_estado as string) ?? 'free'
    }
  }

  return NextResponse.json({
    porcentaje,
    requiereOnboarding,
    gridMode,
    role,
    nombre: profile.nombre ?? null,
    plan,
    planNombre: PLANS[plan]?.nombre ?? 'Free',
    suscripcion_estado,
  })
}
