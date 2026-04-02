import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`)
  }

  // Crear perfil si no existe (datos vienen de user_metadata)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existing) {
      const meta = user.user_metadata ?? {}
      await admin.from('profiles').insert({
        id: user.id,
        role: 'admin',
        nombre: meta.nombre ?? null,
        clinica_id: meta.clinica_id ?? null,
        titulo: meta.titulo ?? 'Dr.',
        especialidad: meta.especialidad ?? null,
        cedula_profesional: meta.cedula_profesional ?? null,
        cedula_especialidad: meta.cedula_especialidad ?? null,
      })
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
