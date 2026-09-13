import { NextRequest, NextResponse } from 'next/server'
import { checkAuthRateLimit, checkIpRateLimit } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/auth/rate-limit — verificar rate limit antes de acción de auth
 *
 * El frontend llama este endpoint ANTES de intentar login, registro o recovery.
 * Si está bloqueado, responde 429. Si no, registra el intento y permite continuar.
 *
 * Acciones y límites:
 * - login_email: 5 intentos por email en 15 minutos
 * - login_ip: 20 intentos por IP en 15 minutos
 * - registro: 3 por IP en 60 minutos
 * - recovery: 3 por email en 60 minutos
 */

const LIMITS: Record<string, { max: number; windowMin: number }> = {
  login_email: { max: 5, windowMin: 15 },
  login_ip:    { max: 20, windowMin: 15 },
  registro:    { max: 3, windowMin: 60 },
  recovery:    { max: 3, windowMin: 60 },
}

/* Bloque B1. Mismo criterio que /api/auth/audit-login: el email llega de
   internet sin sesión y acaba en audit_log (inmutable) y en la clave de
   ip_rate_limits. Duplicado a propósito: aquel archivo se elimina entero. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function emailValido(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v)
}

export async function POST(req: NextRequest) {
  const { action, email } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Bloque B1: tope por IP para toda la ruta, antes de cualquier escritura
  // (incluidos los logAudit de abajo, que son irreversibles). Va antes de
  // validar `action` porque la inundación con acción basura es el vector.
  // 300/h: guarda anti-inundación, no regulador de uso — una clínica entera
  // comparte una sola IP pública.
  const limitado = await checkIpRateLimit(ip, 'auth-rate-limit', 300)
  if (limitado) return limitado

  if (!action || !LIMITS[action]) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const config = LIMITS[action]

  // Para login: verificar ambos límites (por email Y por IP)
  if (action === 'login_email') {
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const emailCheck = await checkAuthRateLimit(email.toLowerCase(), 'login_email', config.max, config.windowMin)
    if (emailCheck.blocked) {
      logAudit({
        accion: 'acceso_denegado',
        ip,
        descripcion: `Login bloqueado por rate limit (email). Intentos excedidos.`,
      })
      return NextResponse.json(
        { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
        { status: 429 }
      )
    }

    const ipCheck = await checkAuthRateLimit(ip, 'login_ip', LIMITS.login_ip.max, LIMITS.login_ip.windowMin)
    if (ipCheck.blocked) {
      logAudit({
        accion: 'acceso_denegado',
        ip,
        descripcion: `Login bloqueado por rate limit (IP).`,
      })
      return NextResponse.json(
        { error: 'Demasiados intentos desde esta conexión. Espera 15 minutos.' },
        { status: 429 }
      )
    }

    return NextResponse.json({ ok: true, remaining: emailCheck.remaining })
  }

  // Para registro: solo por IP
  if (action === 'registro') {
    const check = await checkAuthRateLimit(ip, 'registro', config.max, config.windowMin)
    if (check.blocked) {
      logAudit({
        accion: 'acceso_denegado',
        ip,
        descripcion: 'Registro bloqueado por rate limit (IP).',
      })
      return NextResponse.json(
        { error: 'Has excedido el límite de registros. Intenta más tarde.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ ok: true })
  }

  // Para recovery: solo por email
  if (action === 'recovery') {
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    const check = await checkAuthRateLimit(email.toLowerCase(), 'recovery', config.max, config.windowMin)
    if (check.blocked) {
      // NO revelar que el rate limit se activó — siempre mostrar el mismo mensaje
      return NextResponse.json({ ok: true, message: 'Si el email existe, recibirás un enlace.' })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
}
