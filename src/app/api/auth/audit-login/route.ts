import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logLogin } from '@/lib/audit'

/**
 * POST /api/auth/audit-login — registrar login/logout/fallo
 *
 * NOM-024-SSA3: trazabilidad de accesos al sistema.
 * El frontend llama este endpoint tras login exitoso, fallido o logout.
 */
export async function POST(req: NextRequest) {
  const { action, email } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  if (action === 'login_exitoso') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      logLogin({ userId: user.id, success: true, ip, userAgent })
    }
  } else if (action === 'login_fallido') {
    logLogin({ email: email ?? 'desconocido', success: false, ip, userAgent })
  } else if (action === 'logout') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      logLogin({ userId: user.id, success: true, ip, userAgent })
      // Reusar logAudit con acción logout
      const { logAudit } = await import('@/lib/audit')
      logAudit({ userId: user.id, accion: 'logout', ip })
    }
  }

  return NextResponse.json({ ok: true })
}
