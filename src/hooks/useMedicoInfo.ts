import useSWR from 'swr'
import { useEffect } from 'react'
import { MedicoInfo } from '@/types'
import { secureStorage } from '@/lib/secureStorage'
import { syncDoctorProfile } from '@/lib/offline/doctorProfile'

const CACHE_KEY = 'cache_medico_info'

const fetcher = (url: string) =>
  fetch(url).then(r => r.json()).then(d => d.medico as MedicoInfo)

export function useMedicoInfo() {
  const { data, error, isLoading } = useSWR<MedicoInfo>(
    '/api/me/perfil-medico',
    fetcher,
    {
      // revalidateOnFocus se hereda del <SWRConfig> de (app), ya con throttle.
      dedupingInterval: 300_000,
      onSuccess: (d) => {
        // Cachear en secureStorage como respaldo offline
        secureStorage.set(CACHE_KEY, d)
        // Sincronizar perfil para el módulo Offline-Mode (logo+firma→Base64)
        syncDoctorProfile(d).catch(() => {})
      },
      onError: async () => {
        // Si no se puede hablar con el servidor, no hacer nada aquí —
        // el fallback se maneja abajo
      },
    }
  )

  // Fallback: si SWR no tiene datos y hay error, leer del cache
  const { data: fallback, error: fallbackError, isLoading: fallbackLoading } = useSWR<MedicoInfo>(
    !data && error ? `${CACHE_KEY}_fallback` : null,
    async () => {
      const cached = await secureStorage.get<MedicoInfo>(CACHE_KEY)
      if (!cached) throw new Error('Sin cache offline')
      return cached
    },
    { revalidateOnFocus: false },
  )

  const medicoInfo = data ?? fallback ?? null
  const loading = isLoading || (!data && !error && !fallbackLoading)

  useEffect(() => {
    // Precarga: intentar poblar cache si no existe
    if (!data && !isLoading && !error) return
  }, [data, isLoading, error])

  return {
    medicoInfo,
    isLoading: loading,
    error: data ? undefined : (fallbackError ?? error),
    isOfflineData: !data && !!fallback,
  }
}
