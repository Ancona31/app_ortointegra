/**
 * GET /api/super-admin/dashboard/uso
 *
 * §4 — Uso de plataforma:
 * - Ranking de funciones (top 20 desde audit_log)
 * - Heatmap horario 24×7 (últimos 90 días, hora CDMX)
 * - Top 10 médicos más activos (últimos 30 días)
 * - Uso de IA: acciones ia_* en últimos 30 días
 *
 * Requiere que `supabase_migration_solicitudes_arco.sql` esté aplicado
 * (define las funciones sa_ranking_funciones, sa_heatmap_horarios,
 *  sa_top_medicos y sa_uso_ia).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import type { HeatmapCell, RankingFuncion, TopMedico, UsoIaItem, UsoPlataformaResponse } from '@/lib/super-admin/types'

interface RankingRpcRow {
  accion: string
  total: number | string
}

interface HeatmapRpcRow {
  hora: number | string
  dia_semana: number | string
  total: number | string
}

interface TopMedicoRpcRow {
  user_id: string
  nombre: string
  clinica_nombre: string | null
  total: number | string
}

interface UsoIaRpcRow {
  accion: string
  total: number | string
}

function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : parseInt(v, 10)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_uso',
    descripcion: 'uso de plataforma',
  })

  try {
    const admin = createAdminClient()

    const [rankingRes, heatmapRes, medicosRes, iaRes] = await Promise.all([
      admin.rpc('sa_ranking_funciones', { limite: 20 }),
      admin.rpc('sa_heatmap_horarios', { dias_atras: 90 }),
      admin.rpc('sa_top_medicos', { dias_atras: 30, limite: 10 }),
      admin.rpc('sa_uso_ia', { dias_atras: 30 }),
    ])

    if (rankingRes.error) throw new Error(`ranking: ${rankingRes.error.message}`)
    if (heatmapRes.error) throw new Error(`heatmap: ${heatmapRes.error.message}`)
    if (medicosRes.error) throw new Error(`medicos: ${medicosRes.error.message}`)
    if (iaRes.error) throw new Error(`ia: ${iaRes.error.message}`)

    const rankingFunciones: RankingFuncion[] = ((rankingRes.data ?? []) as RankingRpcRow[]).map(
      (r) => ({ accion: r.accion, total: toNumber(r.total) }),
    )

    const heatmap: HeatmapCell[] = ((heatmapRes.data ?? []) as HeatmapRpcRow[]).map((r) => ({
      hora: toNumber(r.hora),
      diaSemana: toNumber(r.dia_semana),
      total: toNumber(r.total),
    }))

    const topMedicos: TopMedico[] = ((medicosRes.data ?? []) as TopMedicoRpcRow[]).map((r) => ({
      userId: r.user_id,
      nombre: r.nombre,
      clinicaNombre: r.clinica_nombre,
      total: toNumber(r.total),
    }))

    const usoIA: UsoIaItem[] = ((iaRes.data ?? []) as UsoIaRpcRow[]).map((r) => ({
      accion: r.accion,
      total: toNumber(r.total),
    }))

    const body: UsoPlataformaResponse = { rankingFunciones, heatmap, topMedicos, usoIA }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
