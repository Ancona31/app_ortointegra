'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { AnalitoCatalogo } from '@/types'

async function fetchCatalogo(): Promise<AnalitoCatalogo[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('analitos_catalogo')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw error
  return (data ?? []) as AnalitoCatalogo[]
}

export function useCatalogoAnalitos() {
  const { data, error, isLoading } = useSWR<AnalitoCatalogo[]>(
    'catalogo-analitos',
    fetchCatalogo,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 3_600_000,
    },
  )

  return {
    analitos: data ?? [],
    isLoading,
    error,
  }
}
