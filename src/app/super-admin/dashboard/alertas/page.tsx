'use client'

import { useCallback } from 'react'
import { AlertTriangle, CheckCircle, Info, RefreshCw, ShieldAlert } from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import ChartCard from '@/components/super-admin/charts/ChartCard'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  alertasResponseSchema,
  type AlertaItem,
  type AlertasResponse,
  type CohorteRetencion,
  type SeveridadAlerta,
} from '@/lib/super-admin/types'

async function fetchAlertas(): Promise<AlertasResponse> {
  const res = await fetch('/api/super-admin/dashboard/alertas', { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = alertasResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

const SEVERIDAD_CONFIG: Record<
  SeveridadAlerta,
  { label: string; icon: typeof AlertTriangle; bg: string; border: string; text: string; badge: string }
> = {
  critico: {
    label: 'Crítico',
    icon: ShieldAlert,
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  info: {
    label: 'Info',
    icon: Info,
    bg: 'bg-slate-800/50',
    border: 'border-slate-700',
    text: 'text-slate-400',
    badge: 'bg-slate-700/40 text-slate-400 border-slate-600',
  },
}

export default function AlertasPage(): ReactElement {
  const { state, reload } = useAsyncResource<AlertasResponse>(fetchAlertas, [])
  const handleReload = useCallback((): void => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Alertas"
        subtitle="Pagos fallidos, churn, errores y retención"
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
        <LoadingView label="Consultando alertas..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <AlertasContent data={state.data} />
      )}
    </div>
  )
}

function AlertasContent({ data }: { data: AlertasResponse }): ReactElement {
  const criticos = data.alertas.filter((a) => a.severidad === 'critico')
  const warnings = data.alertas.filter((a) => a.severidad === 'warning')
  const infos = data.alertas.filter((a) => a.severidad === 'info')

  return (
    <>
      {/* KPI resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard count={criticos.length} severidad="critico" />
        <SummaryCard count={warnings.length} severidad="warning" />
        <SummaryCard count={infos.length} severidad="info" />
      </div>

      {/* Cohortes de retención */}
      <div className="mb-6">
        <ChartCard title="Retención por cohorte" subtitle="Clínicas con actividad por mes">
          <CohortesList cohortes={data.cohortes} />
        </ChartCard>
      </div>

      {/* Lista de alertas */}
      {data.alertas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={32} className="text-emerald-500" />
          <p className="text-[14px] font-medium text-slate-200">Sin alertas activas</p>
          <p className="text-[12px] text-slate-500">Todo parece estar en orden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.alertas.map((a) => (
            <AlertaCard key={a.id} alerta={a} />
          ))}
        </div>
      )}
    </>
  )
}

function SummaryCard({
  count,
  severidad,
}: {
  count: number
  severidad: SeveridadAlerta
}): ReactElement {
  const cfg = SEVERIDAD_CONFIG[severidad]
  const Icon = cfg.icon
  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5 flex items-center gap-4`}>
      <Icon size={22} className={cfg.text} />
      <div>
        <p className="text-[28px] font-bold text-slate-100 tabular-nums leading-none">{count}</p>
        <p className={`text-[12px] font-medium ${cfg.text} mt-0.5`}>{cfg.label}</p>
      </div>
    </div>
  )
}

function AlertaCard({ alerta }: { alerta: AlertaItem }): ReactElement {
  const cfg = SEVERIDAD_CONFIG[alerta.severidad]
  const Icon = cfg.icon
  const fecha = new Date(alerta.fechaIso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 flex items-start gap-3`}>
      <Icon size={16} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[13px] font-semibold text-slate-100">{alerta.titulo}</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          {alerta.clinicaNombre ? (
            <span className="text-[11px] text-slate-500 truncate">{alerta.clinicaNombre}</span>
          ) : null}
        </div>
        <p className="text-[12px] text-slate-400">{alerta.descripcion}</p>
      </div>
      <span className="text-[11px] text-slate-600 flex-shrink-0 ml-2">{fecha}</span>
    </div>
  )
}

function CohortesList({ cohortes }: { cohortes: ReadonlyArray<CohorteRetencion> }): ReactElement {
  if (cohortes.length === 0) {
    return <p className="text-[12px] text-slate-500 py-4 text-center">Sin datos de cohortes.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cohortes.map((c) => {
        const [year, month] = c.mes.split('-')
        const label = new Date(
          parseInt(year ?? '2024'),
          parseInt(month ?? '1') - 1,
          1,
        ).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
        const pct = c.pct
        return (
          <div key={c.mes} className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 capitalize">
              {label}
            </p>
            <p className="text-[28px] font-bold text-slate-100 tabular-nums leading-none">
              {pct.toFixed(1)}
              <span className="text-[16px] text-slate-400">%</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {c.activas} / {c.totalClinicas} clínicas activas
            </p>
            <div className="h-1 bg-slate-700 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#1e5fa8] rounded-full"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
