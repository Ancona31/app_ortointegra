import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('id, clinica_id, role').eq('id', user.id).single()
  return data ? { ...data, userId: user.id } : null
}

/* ── PUT /api/pacientes/[id] — actualizar paciente ─────── */
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/pacientes/[id]'>) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const body = await req.json()

    // Verificar que el paciente pertenece a la clínica del usuario (RLS filtra por clinica_id)
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id, clinica_id')
      .eq('id', id)
      .single()

    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Campos permitidos (whitelist)
    const allowed = [
      'nombre', 'apellidos', 'fecha_nacimiento', 'sexo', 'telefono', 'email',
      'direccion', 'peso_kg', 'talla_cm', 'imc',
      'ant_patologicos', 'ant_quirurgicos', 'ant_familiares',
      'alergias', 'medicamentos_actuales',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key] ?? null
    }

    // Validaciones
    if (updates.email && typeof updates.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updates.email)) return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }
    if (updates.telefono && typeof updates.telefono === 'string') {
      const digits = (updates.telefono as string).replace(/\D/g, '')
      if (digits.length !== 10) return NextResponse.json({ error: 'El teléfono debe tener 10 dígitos' }, { status: 400 })
    }
    if (updates.peso_kg !== undefined && updates.peso_kg !== null) {
      const peso = parseFloat(String(updates.peso_kg))
      if (isNaN(peso) || peso < 0.5 || peso > 400) return NextResponse.json({ error: 'Peso inválido' }, { status: 400 })
      updates.peso_kg = Math.round(peso * 10) / 10
    }

    const { data, error } = await supabase.from('pacientes').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ paciente: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── DELETE /api/pacientes/[id] — soft delete ──────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/pacientes/[id]'>) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params

    // Verificar ownership (RLS filtra por clinica_id)
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id, clinica_id')
      .eq('id', id)
      .single()

    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Soft delete — NOM-004-SSA3: retención mínima 5 años, no se borra físicamente
    const { error } = await supabase.from('pacientes').update({
      activo: false,
      fecha_baja: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
