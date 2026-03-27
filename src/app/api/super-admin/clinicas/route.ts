import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verificarSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return null
  return user
}

export async function GET() {
  const user = await verificarSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const admin = createAdminClient()
  const { data: clinicas } = await admin.from('clinicas').select('*').order('nombre')
  const { data: profiles } = await admin.from('profiles').select('clinica_id, role')

  const result = (clinicas || []).map(c => ({
    ...c,
    count_medicos: (profiles || []).filter(p => p.clinica_id === c.id && p.role === 'medico').length,
    count_secretarias: (profiles || []).filter(p => p.clinica_id === c.id && p.role === 'secretaria').length,
  }))

  return NextResponse.json({ clinicas: result })
}

export async function POST(req: NextRequest) {
  const user = await verificarSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { nombre, max_medicos, max_secretarias } = await req.json()
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('clinicas').insert({ nombre, max_medicos, max_secretarias })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const user = await verificarSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  // Solo actualizar los campos que vienen en el body
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
