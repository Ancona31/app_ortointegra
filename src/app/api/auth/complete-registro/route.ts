import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Paso 2: crea el perfil del usuario tras confirmar el email.
// Lee los datos desde user_metadata (guardados durante signUp).
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Si ya tiene perfil, no hacer nada
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true })

  const meta = user.user_metadata ?? {}
  const {
    nombre, titulo, especialidad,
    cedula_profesional, cedula_especialidad, clinica_id,
  } = meta

  if (!clinica_id) {
    return NextResponse.json({ error: 'Datos de registro incompletos' }, { status: 400 })
  }

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    role: 'admin',
    nombre: nombre ?? null,
    clinica_id,
    titulo: titulo ?? 'Dr.',
    especialidad: especialidad ?? null,
    cedula_profesional: cedula_profesional ?? null,
    cedula_especialidad: cedula_especialidad ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
