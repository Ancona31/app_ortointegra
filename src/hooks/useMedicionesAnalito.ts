'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { MedicionAnalito } from '@/types'

async function fetchMediciones(
  pacienteId: string,
  analitoKey: string,
): Promise<MedicionAnalito[]> {
  const supabase = createClient()

  if (analitoKey.startsWith('a:')) {
    const analitoId = analitoKey.slice(2)
    const { data, error } = await supabase
      .from('mediciones_analitos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('analito_id', analitoId)
      .order('medido_en', { ascending: false })

    if (error) throw error
    return (data ?? []) as MedicionAnalito[]
  }

  if (analitoKey.startsWith('custom:')) {
    const nombreNormalizado = analitoKey.slice('custom:'.length)
    const { data, error } = await supabase
      .from('mediciones_analitos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .is('analito_id', null)
      .order('medido_en', { ascending: false })

    if (error) throw error
    const rows = (data ?? []) as MedicionAnalito[]
    return rows.filter(
      r => (r.nombre_custom ?? '').trim().toLowerCase() === nombreNormalizado,
    )
  }

  return []
}

export function useMedicionesAnalito(
  pacienteId: string | undefined,
  analitoKey: string | null,
) {
  const { data, error, isLoading, mutate } = useSWR<MedicionAnalito[]>(
    pacienteId && analitoKey ? ['mediciones-analito', pacienteId, analitoKey] : null,
    () => fetchMediciones(pacienteId!, analitoKey!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  )

  return {
    mediciones: data ?? [],
    isLoading,
    error,
    mutate,
  }
}
