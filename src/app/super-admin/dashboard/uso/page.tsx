'use client'

import { useCallback } from 'react'
import { Activity, BrainCircuit, RefreshCw, Users } from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import ChartCard from '@/components/super-admin/charts/ChartCard'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import HeatmapHorarios from '@/components/super-admin/charts/HeatmapHorarios'
import RankingFunciones from '@/components/super-admin/charts/RankingFunciones'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  usoPlataformaResponseSchema,
  type TopMedico,
  type UsoIaItem,
  type UsoPlataformaResponse,
} from '@/lib/super-admin/types'

async function fetchUso(): Promise<UsoPlataformaResponse> {
  const res = await fetch('/api/super-admin/dashboard/uso', { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = usoPlataformaResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

export default function UsoPage(): ReactElement {
  const { state, reload } = useAsyncResource<UsoPlataformaResponse>(fetchUso, [])
  const handleReload = useCallback((): void => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Uso de plataforma"
        subtitle="Funciones más usadas, horarios pico y actividad de IA"
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

      {state.status === 'loading' || state.status === 'idle' ? (
        <LoadingView label="Consultando audit log..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <UsoContent data={state.data} />
      )}
    </div>
  )
}

function UsoContent({ data }: { data: UsoPlataformaResponse }): ReactElement {
  return (
    <>
      {/* Heatmap + Top médicos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-2">
          <ChartCard
            title="Heatmap de actividad"
            subtitle="Últimos 90 días — hora local CDMX × día de la semana"
          >
            <HeatmapHorarios data={data.heatmap} />
          </ChartCard>
        </div>
        <div>
          <ChartCard title="Top médicos activos" subtitle="Últimos 30 días">
            <TopMedicosList items={data.topMedicos} />
          </ChartCard>
        </div>
      </div>

      {/* Ranking funciones + Uso IA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Ranking de funciones"
          subtitle="Top 20 acciones en audit_log (histórico)"
        >
          <RankingFunciones data={data.rankingFunciones} height={360} />
        </ChartCard>
        <ChartCard title="Uso de IA" subtitle="Últimos 30 días">
          <UsoIaList items={data.usoIA} />
        </ChartCard>
      </div>
    </>
  )
}

function TopMedicosList({ items }: { items: ReadonlyArray<TopMedico> }): ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-[12px] text-slate-500 py-8 text-center">
        Sin actividad registrada en los últimos 30 días.
      </p>
    )
  }
  const maxTotal = items[0]?.total ?? 1
  return (
    <ul className="space-y-3">
      {items.map((m, i) => {
        const pct = maxTotal === 0 ? 0 : (m.total / maxTotal) * 100
        return (
          <li key={m.userId}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-slate-100 truncate">{m.nombre}</p>
                  {m.clinicaNombre ? (
                    <p className="text-[10.5px] text-slate-500 truncate">{m.clinicaNombre}</p>
                  ) : null}
                </div>
              </div>
              <span className="text-[12px] font-semibold text-slate-300 tabular-nums ml-2 flex-shrink-0">
                {m.total.toLocaleString('es-MX')}
              </span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1e5fa8] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function UsoIaList({ items }: { items: ReadonlyArray<UsoIaItem> }): ReactElement {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <BrainCircuit size={28} className="text-slate-700" />
        <p className="text-[12px] text-slate-500 text-center">
          Sin acciones de IA registradas en los últimos 30 días.
          <br />
          <span className="text-[11px] text-slate-600">
            Las acciones deben tener prefijo <code className="text-slate-400">ia_</code> en el audit
            log.
          </span>
        </p>
      </div>
    )
  }
  const total = items.reduce((acc, it) => acc + it.total, 0)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={13} className="text-[#4a9fd4]" />
        <span className="text-[12px] text-slate-400">
          Total: <span className="font-semibold text-slate-200">{total.toLocaleString('es-MX')}</span>{' '}
          llamadas
        </span>
      </div>
      {items.map((it) => {
        const pct = total === 0 ? 0 : (it.total / total) * 100
        return (
          <div key={it.accion}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Users size={11} className="text-slate-600 flex-shrink-0" />
                <span className="text-[12px] text-slate-300 truncate max-w-[200px]">{it.accion}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {pct.toFixed(1)}%
                </span>
                <span className="text-[12px] font-semibold text-slate-200 tabular-nums">
                  {it.total.toLocaleString('es-MX')}
                </span>
              </div>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4a9fd4] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

