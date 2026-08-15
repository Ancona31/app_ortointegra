'use client'

import useSWR from 'swr'
import { secureStorage } from '@/lib/secureStorage'
import { Consultorio } from '@/types'

const CACHE_KEY = 'cache_consultorios'

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error('Error al cargar consultorios')
    return r.json()
  })

/**
 * Hook que devuelve la lista de consultorios activos del usuario autenticado.
 *
 * Patrón replicado de useClinica: SWR primario contra /api/consultorios +
 * SWR de fallback que lee de secureStorage cuando el endpoint falla y no
 * hay data en memoria.
 *
 * El endpoint solo devuelve consultorios activos (filtrado por backend);
 * los archivados no se exponen al usuario por diseño (R1).
 *
 * El consultorio default está garantizado a existir cuando consultorios.length >= 1
 * (triggers BD enforce_consultorio_default_insert + enforce_consultorio_default_existencia).
 * Para médicos recién registrados con 0 consultorios, consultorioDefault será null y el
 * modal de onboarding (Bloque F3-4) los bloqueará hasta crear el primero.
 */
export function useConsultorios() {
  const { data, error, isLoading, mutate } = useSWR<{ consultorios: Consultorio[] }>(
    '/api/consultorios',
    fetcher,
    {
      // revalidateOnFocus se hereda del <SWRConfig> de (app), ya con throttle.
      dedupingInterval: 60_000,
      onSuccess: (d) => {
        if (d.consultorios) secureStorage.set(CACHE_KEY, d.consultorios)
      },
    },
  )

  const { data: fallback } = useSWR<Consultorio[]>(
    !data && error ? `${CACHE_KEY}_fallback` : null,
    async () => {
      const cached = await secureStorage.get<Consultorio[]>(CACHE_KEY)
      if (!cached) throw new Error('Sin cache offline')
      return cached
    },
    { revalidateOnFocus: false },
  )

  const consultorios = data?.consultorios ?? fallback ?? []

  const consultorioDefault = consultorios.find(c => c.es_default) ?? null

  return {
    consultorios,
    consultorioDefault,
    isLoading,
    mutate,
    isOfflineData: !data?.consultorios && !!fallback,
  }
}
