import useSWR from 'swr'
import { useEffect } from 'react'
import { MedicoInfo } from '@/types'
import { secureStorage } from '@/lib/secureStorage'

const CACHE_KEY = 'cache_medico_info'

const fetcher = (url: string) =>
  fetch(url).then(r => r.json()).then(d => {
    // CRÍTICO: si el server retorna { medico: null } (típicamente porque
    // getUser() server-side falló en gray zone, cookies ausentes o Vercel
    // no pudo reach Supabase Auth), tratamos esto como ERROR para que
    // SWR active el fallback al cache de secureStorage.
    //
    // Sin este throw, SWR consideraba el null como "success", seteaba
    // data = null, disparaba onSuccess con d=null, y el cache válido era
    // sobrescrito con null (bug de canibalización del cache detectado en
    // QA del Sprint 3). Los PDFs perdían logos y firmas.
    if (!d.medico) throw new Error('Perfil médico no disponible en servidor')
    return d.medico as MedicoInfo
  })

export function useMedicoInfo() {
  const { data, error, isLoading } = useSWR<MedicoInfo>(
    '/api/me/perfil-medico',
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 300_000,
      onSuccess: (d) => {
        // Cachear en secureStorage como respaldo offline SOLO si la
        // data es no-null/no-undefined. CRÍTICO: sin este guard, una
        // respuesta { medico: null } del servidor (gray zone, cookies
        // ausentes, etc.) sobrescribiría el cache válido con null y
        // rompería todos los PDFs subsecuentes.
        //
        // El fetcher ya lanza error si d.medico es null, así que este
        // guard es defensa en profundidad — si el fetcher cambia en
        // el futuro, el cache sigue protegido.
        if (d) secureStorage.set(CACHE_KEY, d).catch(() => {})
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
