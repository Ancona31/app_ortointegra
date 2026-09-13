import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logLogin } from '@/lib/audit'
import { checkIpRateLimit } from '@/lib/rateLimit'

/* Bloque B1. Ruta pública (middleware.ts:200) que escribe en audit_log, que es
   INMUTABLE por trigger: lo que entre aquí no se borra ni se corrige jamás.
   El validador se duplica en /api/auth/rate-limit a propósito: este archivo se
   elimina entero en un bloque posterior y no merece una utilidad compartida. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function emailValido(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v)
}

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
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    // Guarda anti-inundación por IP, no regulador de uso: una clínica entera
    // comparte una sola IP pública.
    const limitado = await checkIpRateLimit(ip, 'auth-login-fallido', 100)
    if (limitado) return limitado
    logLogin({ email, success: false, ip, userAgent })
  } else if (action === 'logout') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Reusar logAudit con acción logout
      const { logAudit } = await import('@/lib/audit')
      logAudit({ userId: user.id, accion: 'logout', ip })
    }
  }

  return NextResponse.json({ ok: true })
}
