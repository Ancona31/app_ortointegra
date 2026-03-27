import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Límites por ruta: máximo de llamadas permitidas en 24 horas por usuario
const LIMITES: Record<string, number> = {
  'labs-extract':   15,
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
