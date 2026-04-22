'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export type StatsLabs = {
  analitosTracked: number
  ultimaMedicionISO: string | null
}

type Row = { analito_id: string | null; nombre_custom: string | null }

async function fetchStatsLabs(pacienteId: string): Promise<StatsLabs> {
  const supabase = createClient()

  const [rowsRes, lastRes] = await Promise.all([
    supabase
      .from('mediciones_analitos')
      .select('analito_id, nombre_custom')
      .eq('paciente_id', pacienteId),
    supabase
      .from('mediciones_analitos')
      .select('medido_en')
      .eq('paciente_id', pacienteId)
      .order('medido_en', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (rowsRes.error) throw rowsRes.error
  if (lastRes.error) throw lastRes.error

  const rows = (rowsRes.data ?? []) as Row[]
  const tracked = new Set<string>()
  for (const r of rows) {
    if (r.analito_id) tracked.add(`a:${r.analito_id}`)
    else if (r.nombre_custom) tracked.add(`c:${r.nombre_custom.trim().toLowerCase()}`)
  }

  const last = (lastRes.data ?? null) as { medido_en: string } | null

  return {
    analitosTracked: tracked.size,
    ultimaMedicionISO: last?.medido_en ?? null,
  }
}

export function useStatsLabs(pacienteId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<StatsLabs>(
    pacienteId ? ['stats-labs', pacienteId] : null,
    () => fetchStatsLabs(pacienteId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  )

  return {
    stats: data ?? { analitosTracked: 0, ultimaMedicionISO: null },
    isLoading,
    error,
    mutate,
  }
}
