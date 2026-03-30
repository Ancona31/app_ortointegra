import useSWR from 'swr'
import { MedicoInfo } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then(r => r.json()).then(d => d.medico as MedicoInfo)

export function useMedicoInfo() {
  const { data, error, isLoading } = useSWR<MedicoInfo>(
    '/api/me/perfil-medico',
    fetcher,
    {
      revalidateOnFocus: false,   // El perfil no cambia entre tabs
      dedupingInterval: 300_000,  // 5 min — no refetch si ya hay datos
    }
  )

  return { medicoInfo: data ?? null, isLoading, error }
}
