import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Límites por ruta: máximo de llamadas permitidas en 24 horas por usuario
const LIMITES: Record<string, number> = {
  'nota-medica':    20,
  'consulta-rapida': 50,
}

/**
 * Verifica si el usuario superó su límite diario para una ruta de IA.
 * Registra la llamada si está dentro del límite.
 *
 * @returns null si está permitido, o un NextResponse 429 si superó el límite
 */
export async function checkRateLimit(userId: string, ruta: string): Promise<NextResponse | null> {
  const supabase = await createClient()
  const limite = LIMITES[ruta] ?? 10
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Contar llamadas del usuario en las últimas 24 horas para esta ruta
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ruta', ruta)
    .gte('created_at', hace24h)

  const total = count ?? 0

  if (total >= limite) {
    return NextResponse.json(
      {
        error: `Límite diario alcanzado. Puedes hacer máximo ${limite} solicitudes cada 24 horas para esta función.`,
        limite,
        usado: total,
        reinicia_en: '24 horas desde tu primera solicitud del día',
      },
      { status: 429 }
    )
  }

  // Registrar esta llamada
  await supabase.from('rate_limits').insert({ user_id: userId, ruta })

  // Limpiar registros antiguos (>24h) del usuario para no crecer infinitamente
  // Lo hacemos sin await para no bloquear la respuesta
  supabase
    .from('rate_limits')
    .delete()
    .eq('user_id', userId)
    .eq('ruta', ruta)
    .lt('created_at', hace24h)
    .then(() => {})

  return null
}

/**
 * Rate limiting para autenticación (login, registro, recovery).
 * Verifica por identificador (email o IP) y acción.
 * Usa ip_rate_limits con service role.
 */
export async function checkAuthRateLimit(
  identifier: string,
  action: string,
  limite: number,
  windowMinutes: number
): Promise<{ blocked: boolean; remaining: number }> {
  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const ruta = `auth:${action}:${identifier}`

  const { count } = await admin
    .from('ip_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip', identifier)
    .eq('ruta', ruta)
    .gte('created_at', windowStart)

  const total = count ?? 0

  if (total >= limite) {
    return { blocked: true, remaining: 0 }
  }

  await admin.from('ip_rate_limits').insert({ ip: identifier, ruta })

  // Limpiar registros viejos sin bloquear
  admin
    .from('ip_rate_limits')
    .delete()
    .eq('ip', identifier)
    .eq('ruta', ruta)
    .lt('created_at', windowStart)
    .then(() => {})

  return { blocked: false, remaining: limite - total - 1 }
}

/**
 * Rate limiting por IP para endpoints públicos (sin autenticación).
 * Usa la tabla ip_rate_limits gestionada con el service role.
 *
 * @param ip       Dirección IP del cliente
 * @param ruta     Nombre de la ruta (ej. 'verificar-receta')
 * @param limite   Máximo de peticiones por hora (default: 30)
 * @returns null si está permitido, o un NextResponse 429 si superó el límite
 */
export async function checkIpRateLimit(
  ip: string,
  ruta: string,
  limite = 30
): Promise<NextResponse | null> {
  const admin = createAdminClient()
  const hace1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('ip_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('ruta', ruta)
    .gte('created_at', hace1h)

  const total = count ?? 0

  if (total >= limite) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta más tarde.' },
      { status: 429 }
    )
  }

  await admin.from('ip_rate_limits').insert({ ip, ruta })

  // Limpiar registros viejos sin bloquear la respuesta
  admin
    .from('ip_rate_limits')
    .delete()
    .eq('ip', ip)
    .eq('ruta', ruta)
    .lt('created_at', hace1h)
    .then(() => {})

  return null
}
