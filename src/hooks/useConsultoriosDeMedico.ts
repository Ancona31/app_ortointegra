'use client'

import useSWR from 'swr'
import { Consultorio } from '@/types'

/**
 * Hook para obtener los consultorios de un médico target (modo operativo).
 * Solo debe usarse desde un contexto donde el usuario sea admin de clínica
 * o secretaria. El endpoint /api/consultorios?medico_id valida autorización.
 *
 * Diferencia con useConsultorios:
 * - useConsultorios: owner-scope. Lista los consultorios del usuario logueado.
 * - useConsultoriosDeMedico: operativo. Lista los consultorios de un médico target.
 *
 * No tiene fallback offline porque el caso es online-only (admin/secretaria
 * agendando para otro médico).
 */
export function useConsultoriosDeMedico(medicoId: string | null) {
  // Key condicional: si no hay medicoId, SWR no fetchea.
  const key = medicoId ? `/api/consultorios?medico_id=${medicoId}` : null

  const { data, isLoading, mutate } = useSWR<{ consultorios: Consultorio[] }>(
    key,
    (url: string) => fetch(url).then(r => r.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  const consultorios = data?.consultorios ?? []
  const consultorioDefault = consultorios.find(c => c.es_default) ?? null

  return {
    consultorios,
    consultorioDefault,
    isLoading,
    mutate,
  }
}
