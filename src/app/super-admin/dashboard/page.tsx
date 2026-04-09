'use client'

import { useCallback } from 'react'
import {
  Building2,
  Stethoscope,
  Users,
  ClipboardList,
  DollarSign,
  CalendarCheck,
  RefreshCw,
} from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import KpiCard from '@/components/super-admin/KpiCard'
import ChartCard from '@/components/super-admin/charts/ChartCard'
import {
  LineSeries,
  BarSeries,
  AreaSeries,
  DonutChart,
} from '@/components/super-admin/charts/SerieCharts'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  resumenEjecutivoSchema,
  type ResumenEjecutivo,
} from '@/lib/super-admin/types'

async function fetchResumen(): Promise<ResumenEjecutivo> {
  const res = await fetch('/api/super-admin/dashboard/resumen', { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err = typeof json === 'object' && json !== null && 'error' in json ? String((json as { error: unknown }).error) : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = resumenEjecutivoSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Respuesta inválida del servidor')
  }
  return parsed.data
}

function formatMes(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-MX', { month: 'short' })
}

function formatDia(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

export default function ResumenPage(): ReactElement {
  const { state, reload } = useAsyncResource<ResumenEjecutivo>(fetchResumen, [])
  const handleReload = useCallback(() => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Resumen ejecutivo"
        subtitle="Vista de alto nivel del estado de la plataforma"
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
        <LoadingView label="Cargando métricas..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <ResumenContent data={state.data} />
      )}
    </div>
  )
}

function ResumenContent({ data }: { data: ResumenEjecutivo }): ReactElement {
  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total clínicas" icon={Building2} data={data.totalClinicas} />
        <KpiCard label="Médicos activos" icon={Stethoscope} data={data.totalMedicosActivos} />
        <KpiCard label="Total pacientes" icon={Users} data={data.totalPacientes} />
        <KpiCard label="Total consultas" icon={ClipboardList} data={data.totalConsultas} />
        <KpiCard label="MRR" icon={DollarSign} data={data.mrr} format="currency" comparativaLabel="Stripe activo" />
        <KpiCard label="Consultas hoy" icon={CalendarCheck} data={data.consultasHoy} comparativaLabel="vs ayer" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Crecimiento de clínicas" subtitle="Últimos 12 meses">
          <LineSeries data={data.serieClinicasPorMes} formatLabel={formatMes} />
        </ChartCard>
        <ChartCard title="Consultas por día" subtitle="Últimos 30 días">
          <BarSeries data={data.serieConsultasPorDia} formatLabel={formatDia} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Ingresos por mes" subtitle="Últimos 12 meses (Stripe)">
          <AreaSeries data={data.serieIngresosPorMes} formatLabel={formatMes} esMoneda />
        </ChartCard>
        <ChartCard title="Uso de IA por día" subtitle="Últimos 30 días">
          <LineSeries data={data.serieIaPorDia} formatLabel={formatDia} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribución de planes" subtitle="Gratuito · Pagando · VIP">
          <DonutChart data={data.distribucionPlanes} />
        </ChartCard>
        <ChartCard title="Documentos por tipo" subtitle="Últimos 90 días">
          <DonutChart data={data.documentosPorTipo} />
        </ChartCard>
      </div>
    </>
  )
}
