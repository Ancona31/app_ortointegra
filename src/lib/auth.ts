import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canManageClinica } from '@/lib/permissions'

type AuthResult =
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse }

/**
 * Verifica que el usuario autenticado sea super_admin.
 * Retorna { user } si está autorizado, o { error: NextResponse } si no.
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile || profile.role !== 'super_admin') {
    return { user: null, error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { user, error: null }
}

/**
 * Verifica que el usuario autenticado sea admin o super_admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (error || !profile || !canManageClinica(profile)) {
    return { user: null, error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { user, error: null }
}
