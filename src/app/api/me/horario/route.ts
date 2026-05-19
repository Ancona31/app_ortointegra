import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'

async function getProfileAndClinica(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/* ── GET /api/me/horario ────────────────────────────────── */
export async function GET() {
  try {
    const supabase = await createClient()
    const profile  = await getProfileAndClinica(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('horario_consulta')
      .eq('id', profile.clinica_id)
      .single()

    return NextResponse.json({ horario: clinica?.horario_consulta ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── PUT /api/me/horario ────────────────────────────────── */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile  = await getProfileAndClinica(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!canManageClinica(profile)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { horario } = await req.json()
    if (!horario) return NextResponse.json({ error: 'Horario requerido' }, { status: 400 })

    // clinicas no tiene política UPDATE para authenticated — necesita admin client (service role)
    const admin = createAdminClient()
    const { error } = await admin
      .from('clinicas')
      .update({ horario_consulta: horario })
      .eq('id', profile.clinica_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
