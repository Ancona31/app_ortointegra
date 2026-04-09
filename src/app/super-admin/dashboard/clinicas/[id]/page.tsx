'use client'

import { use, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
  RefreshCw,
  Users,
} from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import ChartCard from '@/components/super-admin/charts/ChartCard'
import { LineSeries } from '@/components/super-admin/charts/SerieCharts'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import {
  EstadoClinicaBadge,
  EstadoPagoBadge,
  TipoBadge,
} from '@/components/super-admin/clinicas/Badges'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  clinicaDetalleSchema,
  type ClinicaDetalle,
  type Rol,
} from '@/lib/super-admin/types'

async function fetchDetalle(id: string): Promise<ClinicaDetalle> {
  const res = await fetch(`/api/super-admin/dashboard/clinicas/${id}`, { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = clinicaDetalleSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

const ROL_LABEL: Record<Rol, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  medico: 'Médico',
  secretaria: 'Secretaria',
}

const ROL_CLASSES: Record<Rol, string> = {
  super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  admin: 'bg-[#1e5fa8]/10 text-[#4a9fd4] border-[#1e5fa8]/30',
  medico: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  secretaria: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Nunca'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`
  return `Hace ${Math.floor(dias / 365)} años`
}

function formatMes(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-MX', { month: 'short' })
}

export default function ClinicaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}): ReactElement {
  const { id } = use(params)
  const fetcher = useCallback(() => fetchDetalle(id), [id])
  const { state, reload } = useAsyncResource<ClinicaDetalle>(fetcher, [id])
  const handleReload = useCallback((): void => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <Link
        href="/super-admin/dashboard/clinicas"
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-200 transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Volver a clínicas
      </Link>

      {state.status === 'loading' || state.status === 'idle' ? (
        <LoadingView label="Cargando detalle..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <DetalleContent data={state.data} onReload={handleReload} loading={false} />
      )}
    </div>
  )
}

function DetalleContent({
  data,
  onReload,
  loading,
}: {
  data: ClinicaDetalle
  onReload: () => void
  loading: boolean
}): ReactElement {
  const c = data.resumen
  return (
    <>
      <PageHeader
        title={c.nombreDisplay ?? c.nombre}
        subtitle={c.nombreDisplay && c.nombreDisplay !== c.nombre ? c.nombre : undefined}
        actions={
          <button
            type="button"
            onClick={onReload}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        }
      />

      {/* Tarjeta de identidad */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {c.logoUrl ? (
              <Image src={c.logoUrl} alt={c.nombre} width={56} height={56} className="object-contain" />
            ) : (
              <Building2 size={20} className="text-slate-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <TipoBadge value={c.tipo} />
              <EstadoPagoBadge value={c.estadoPago} />
              <EstadoClinicaBadge value={c.estado} />
              {c.esVip ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10.5px] font-semibold uppercase tracking-wider">
                  VIP
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Médicos</p>
                <p className="text-[15px] font-semibold text-slate-100 tabular-nums mt-0.5">
                  {c.countMedicos}
                  <span className="text-slate-600">/{c.maxMedicos}</span>
                </p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Secretarias</p>
                <p className="text-[15px] font-semibold text-slate-100 tabular-nums mt-0.5">
                  {c.countSecretarias}
                  <span className="text-slate-600">/{c.maxSecretarias}</span>
                </p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Último acceso</p>
                <p className="text-[15px] font-semibold text-slate-100 mt-0.5">
                  {formatRelative(c.ultimoAccesoIso)}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Plan</p>
                <p className="text-[15px] font-semibold text-slate-100 mt-0.5 capitalize">
                  {c.plan ?? 'Free'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas individuales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricSmall icon={Users} label="Pacientes" value={data.metricas.pacientes} />
        <MetricSmall icon={ClipboardList} label="Consultas" value={data.metricas.consultas} />
        <MetricSmall icon={FileText} label="Documentos" value={data.metricas.documentos} />
        <MetricSmall icon={Cpu} label="Llamadas IA" value={data.metricas.iaCalls} />
      </div>

      {/* Gráfica + usuarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Consultas por mes" subtitle="Últimos 12 meses">
            <LineSeries data={data.serieConsultasPorMes} formatLabel={formatMes} />
          </ChartCard>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-slate-100 mb-4">
            Usuarios ({data.usuarios.length})
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {data.usuarios.length === 0 ? (
              <p className="text-[12px] text-slate-500">Sin usuarios registrados.</p>
            ) : (
              data.usuarios.map((u) => (
                <div key={u.id} className="flex items-start gap-2.5 py-2 border-b border-slate-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-100 truncate">
                      {u.nombre || '(sin nombre)'}
                    </p>
                    <p className="text-[10.5px] text-slate-500 truncate">{u.email}</p>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">
                      Último login: {formatRelative(u.ultimoLoginIso)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${ROL_CLASSES[u.rol]}`}
                  >
                    {ROL_LABEL[u.rol]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function MetricSmall({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: number
}): ReactElement {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-[#1e5fa8]" />
        <span className="text-[10.5px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100 tabular-nums">{value.toLocaleString('es-MX')}</p>
    </div>
  )
}
