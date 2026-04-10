'use client'

import useSWR from 'swr'
import { secureStorage } from '@/lib/secureStorage'

export type ClinicaConfig = {
  id: string
  nombre: string
  nombre_display: string | null
  subtitulo: string | null
  color_primario: string | null
  color_secundario: string | null
  logo_url: string | null
}

const CACHE_KEY = 'cache_clinica'

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error('Error al cargar clínica')
    return r.json()
  })

export function useClinica() {
  const { data, error } = useSWR<{ clinica: ClinicaConfig | null }>(
    '/api/me/clinica',
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60_000,
      onSuccess: (d) => {
        if (d.clinica) secureStorage.set(CACHE_KEY, d.clinica)
      },
    },
  )

  // Fallback offline
  const { data: fallback } = useSWR<ClinicaConfig>(
    !data && error ? `${CACHE_KEY}_fallback` : null,
    async () => {
      const cached = await secureStorage.get<ClinicaConfig>(CACHE_KEY)
      if (!cached) throw new Error('Sin cache offline')
      return cached
    },
    { revalidateOnFocus: false },
  )

  const clinica = data?.clinica ?? fallback ?? null

  return {
    clinica,
    colorPrimario:   clinica?.color_primario   ?? '#1a3a5c',
    colorSecundario: clinica?.color_secundario ?? '#1e5fa8',
    nombreDisplay:   clinica?.nombre_display   ?? null,
    subtitulo:       clinica?.subtitulo        ?? null,
    logoUrl:         clinica?.logo_url         ?? null,
    isOfflineData:   !data?.clinica && !!fallback,
  }
}
