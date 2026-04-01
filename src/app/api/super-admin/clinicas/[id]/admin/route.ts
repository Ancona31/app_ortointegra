import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  const { id: clinicaId } = await params
  const { nombre, email, password } = await req.json()

  if (!nombre || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que la clínica exista
  const { data: clinica } = await admin.from('clinicas').select('id').eq('id', clinicaId).single()
  if (!clinica) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })

  // Verificar que no tenga ya un admin
  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('clinica_id', clinicaId)
    .eq('role', 'admin')

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Esta clínica ya tiene un administrador asignado' }, { status: 400 })
  }

  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  await admin.from('profiles').upsert({
    id: newUser.user.id,
    role: 'admin',
    nombre,
    clinica_id: clinicaId,
  })

  return NextResponse.json({ ok: true })
}
