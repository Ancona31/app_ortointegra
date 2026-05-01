'use client'

import { useCallback, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import ClinicasFilters from '@/components/super-admin/clinicas/ClinicasFilters'
import ClinicasTable from '@/components/super-admin/clinicas/ClinicasTable'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  clinicasListResponseSchema,
  type ClinicasFilter,
  type ClinicasListResponse,
} from '@/lib/super-admin/types'

async function fetchClinicas(filter: ClinicasFilter): Promise<ClinicasListResponse> {
  const params = new URLSearchParams()
  if (filter.q) params.set('q', filter.q)
  if (filter.tipo !== 'todos') params.set('tipo', filter.tipo)
  if (filter.plan !== 'todos') params.set('plan', filter.plan)
  if (filter.estado !== 'todos') params.set('estado', filter.estado)
  const res = await fetch(`/api/super-admin/dashboard/clinicas?${params.toString()}`, {
    cache: 'no-store',
  })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = clinicasListResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

export default function ClinicasDashboardPage(): ReactElement {
  const [filter, setFilter] = useState<ClinicasFilter>({
    q: '',
    tipo: 'todos',
    plan: 'todos',
    estado: 'todos',
  })
  const [vipOverrides, setVipOverrides] = useState<Record<string, boolean>>({})

  const fetcher = useCallback(() => fetchClinicas(filter), [filter])
  const { state, reload } = useAsyncResource<ClinicasListResponse>(
    fetcher,
    [filter.q, filter.tipo, filter.plan, filter.estado],
  )

  const handleVipChange = useCallback((id: string, esVip: boolean): void => {
    setVipOverrides((prev) => ({ ...prev, [id]: esVip }))
  }, [])

  const items = useMemo(() => {
    if (state.status !== 'success') return []
    return state.data.items.map((c) => {
      const override = vipOverrides[c.id]
      if (override === undefined) return c
      return { ...c, esVip: override, estadoPago: override ? 'vip' as const : 'gratuito' as const }
    })
  }, [state, vipOverrides])

  const handleReload = useCallback((): void => {
    setVipOverrides({})
    reload()
  }, [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Clínicas y usuarios"
        subtitle={
          state.status === 'success'
            ? `${state.data.items.length} cuentas listadas`
            : 'Lista completa de clínicas e independientes'
        }
        actions={
          <button
            type="button"
            onClick={handleReload}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <RefreshCw size={13} className={state.status === 'loading' ? 'animate-spin' : ''} />
            Actualizar
          </button>
        }
      />

      <ClinicasFilters value={filter} onChange={setFilter} />

      {state.status === 'loading' || state.status === 'idle' ? (
        <LoadingView label="Cargando clínicas..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <ClinicasTable items={items} onVipChange={handleVipChange} />
      )}
    </div>
  )
}
