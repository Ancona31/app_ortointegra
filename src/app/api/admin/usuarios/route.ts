import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id, es_admin_de_clinica').eq('id', user.id).single()

  // Solo admin de clínica puede gestionar usuarios
  if (!profile || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: authUsers } = await admin.auth.admin.listUsers()

  // Traer perfiles de la misma clínica
  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .eq('clinica_id', profile.clinica_id)

  // Admin de clínica ve a todo su equipo, excepto a sí mismo
  const usuarios = (profiles || [])
    .filter(p => p.id !== user.id)
    .map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      // nombre se COMPONE desde campos estructurados (NOMBRES_PLAN.md, Fase 4).
      // Filas migradas en Fase 2 ya tienen los 3 campos poblados. Se conserva la
      // key `nombre` en la respuesta → page.tsx / type Usuario no cambian.
      return {
        id: p.id,
        role: p.role,
        nombre: componerNombreMedicoCompleto({
          titulo: p.titulo,
          nombres: p.nombres,
          apellido_paterno: p.apellido_paterno,
          apellido_materno: p.apellido_materno,
        }),
        clinica_id: p.clinica_id,
        es_admin_de_clinica: p.es_admin_de_clinica,
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

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id, es_admin_de_clinica').eq('id', user.id).single()

  // Solo admin de clínica puede eliminar
  if (!profile || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (userId === user.id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  // Verificar que el objetivo pertenece a la misma clínica
  const admin = createAdminClient()
  const { data: targetProfile } = await admin.from('profiles').select('role, clinica_id').eq('id', userId).single()

  if (targetProfile?.clinica_id !== profile.clinica_id) {
    return NextResponse.json({ error: 'No puedes eliminar usuarios de otra clínica' }, { status: 403 })
  }

  await admin.auth.admin.deleteUser(userId)
  await admin.from('profiles').delete().eq('id', userId)

  return NextResponse.json({ ok: true })
}
