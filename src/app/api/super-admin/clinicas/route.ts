import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'

export async function GET() {
  const { user, error } = await requireSuperAdmin()
  if (error) return error

  const admin = createAdminClient()
  const { data: clinicas } = await admin.from('clinicas').select('*').order('nombre')
  const { data: profiles } = await admin.from('profiles').select('id, clinica_id, role, nombre')
  const { data: authData } = await admin.auth.admin.listUsers()
  const authUsers = authData?.users ?? []

  const result = (clinicas || []).map(c => {
    const adminProfile = (profiles || []).find(p => p.clinica_id === c.id && p.role === 'admin')
    const adminEmail = adminProfile
      ? (authUsers.find(u => u.id === adminProfile.id)?.email ?? null)
      : null

    return {
      ...c,
      count_medicos:     (profiles || []).filter(p => p.clinica_id === c.id && p.role === 'medico').length,
      count_secretarias: (profiles || []).filter(p => p.clinica_id === c.id && p.role === 'secretaria').length,
      admin: adminProfile
        ? { id: adminProfile.id, nombre: adminProfile.nombre, email: adminEmail }
        : null,
    }
  })

  return NextResponse.json({ clinicas: result })
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  const { nombre, max_medicos, max_secretarias, adminNombre, adminEmail, adminPassword } = await req.json()
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })

  // Validar datos del admin si se proporcionaron
  if (adminEmail || adminPassword || adminNombre) {
    if (!adminNombre || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Para crear el admin se requieren nombre, email y contraseña' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminEmail)) return NextResponse.json({ error: 'Email del admin inválido' }, { status: 400 })
    if (adminPassword.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Crear clínica y recuperar el ID
  const { data: nuevaClinica, error } = await admin
    .from('clinicas')
    .insert({ nombre, max_medicos, max_secretarias })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Crear admin si se proporcionaron datos
  if (adminNombre && adminEmail && adminPassword) {
    const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })

    if (authErr) {
      // Revertir la clínica si falla la creación del admin
      await admin.from('clinicas').delete().eq('id', nuevaClinica.id)
      return NextResponse.json({ error: `Error al crear admin: ${authErr.message}` }, { status: 400 })
    }

    await admin.from('profiles').upsert({
      id: newUser.user.id,
      role: 'admin',
      nombre: adminNombre,
      clinica_id: nuevaClinica.id,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const campos: Record<string, unknown> = {}
  if ('max_medicos' in body) campos.max_medicos = body.max_medicos
  if ('max_secretarias' in body) campos.max_secretarias = body.max_secretarias
  if ('nombre_display' in body) campos.nombre_display = body.nombre_display
  if ('subtitulo' in body) campos.subtitulo = body.subtitulo
  if ('color_primario' in body) campos.color_primario = body.color_primario
  if ('color_secundario' in body) campos.color_secundario = body.color_secundario

  const admin = createAdminClient()
  const { error } = await admin.from('clinicas').update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
