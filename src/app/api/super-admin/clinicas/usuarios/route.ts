import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'

/* ── DELETE /api/super-admin/clinicas/usuarios ──────────────
   Elimina un usuario (auth + profile) de una clínica.
   No elimina sus registros clínicos (pacientes, notas, etc.)
   para preservar la trazabilidad del expediente.
   Body: { userId: string }
──────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que no sea el único admin de su clínica
  const { data: perfil } = await admin
    .from('profiles')
    .select('role, clinica_id')
    .eq('id', userId)
    .single()

  if (perfil?.role === 'admin' && perfil.clinica_id) {
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', perfil.clinica_id)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'No se puede eliminar al único administrador de la clínica. Asigna otro admin primero.' },
        { status: 409 }
      )
    }
  }

  // Eliminar el perfil primero (la RLS no aplica al admin client)
  const { error: profileError } = await admin
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Eliminar el usuario de Supabase Auth
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
