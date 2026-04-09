'use client'

import { useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  FileCheck,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  legalResponseSchema,
  type ConsentimientoClinica,
  type EstadoArco,
  type LegalResponse,
  type SolicitudArco,
  type TipoArco,
} from '@/lib/super-admin/types'

async function fetchLegal(): Promise<LegalResponse> {
  const res = await fetch('/api/super-admin/dashboard/legal', { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = legalResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

const TIPO_ARCO_LABEL: Record<TipoArco, string> = {
  acceso: 'Acceso',
  rectificacion: 'Rectificación',
  cancelacion: 'Cancelación',
  oposicion: 'Oposición',
}

const ESTADO_ARCO_CONFIG: Record<
  EstadoArco,
  { label: string; classes: string }
> = {
  pendiente: {
    label: 'Pendiente',
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  en_proceso: {
    label: 'En proceso',
    classes: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  completada: {
    label: 'Completada',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  rechazada: {
    label: 'Rechazada',
    classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
}

export default function LegalPage(): ReactElement {
  const { state, reload } = useAsyncResource<LegalResponse>(fetchLegal, [])
  const handleReload = useCallback((): void => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Legal / ARCO"
        subtitle="Solicitudes ARCO, consentimientos y anonimizaciones"
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
        <LoadingView label="Cargando datos legales..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <LegalContent data={state.data} />
      )}
    </div>
  )
}

function LegalContent({ data }: { data: LegalResponse }): ReactElement {
  const pendientes = data.solicitudesArco.filter(
    (s) => s.estado === 'pendiente' || s.estado === 'en_proceso',
  )

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={Scale}
          label="Solicitudes ARCO activas"
          value={pendientes.length}
          tone={pendientes.length > 0 ? 'warning' : 'ok'}
        />
        <KpiCard
          icon={UserX}
          label="Pacientes anonimizados"
          value={data.totalAnonimizados}
          tone="neutral"
        />
        <KpiCard
          icon={FileCheck}
          label="Clínicas con consentimiento <100%"
          value={data.consentimientos.filter((c) => c.pct < 100).length}
          tone={data.consentimientos.some((c) => c.pct < 80) ? 'warning' : 'ok'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Solicitudes ARCO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Scale size={14} className="text-[#1e5fa8]" />
            <h3 className="text-[14px] font-semibold text-slate-100">Solicitudes ARCO</h3>
            <span className="text-[11px] text-slate-500 ml-auto">
              {data.solicitudesArco.length} total
            </span>
          </div>
          {data.solicitudesArco.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle size={24} className="text-emerald-500" />
              <p className="text-[12px] text-slate-500">
                Sin solicitudes ARCO registradas.
                {/* If table missing, the endpoint returns empty array */}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="text-left font-semibold px-5 py-3">Clínica</th>
                    <th className="text-left font-semibold px-3 py-3">Tipo</th>
                    <th className="text-left font-semibold px-3 py-3">Estado</th>
                    <th className="text-left font-semibold px-3 py-3">Fecha</th>
                    <th className="text-left font-semibold px-3 py-3">Límite</th>
                  </tr>
                </thead>
                <tbody>
                  {data.solicitudesArco.map((s) => (
                    <ArcoRow key={s.id} solicitud={s} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Consentimientos por clínica */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#1e5fa8]" />
            <h3 className="text-[14px] font-semibold text-slate-100">
              Consentimientos informados
            </h3>
            <span className="text-[11px] text-slate-500 ml-auto">por clínica</span>
          </div>
          {data.consentimientos.length === 0 ? (
            <p className="px-5 py-12 text-center text-[12px] text-slate-500">
              Sin datos de consentimiento.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800 max-h-[420px] overflow-y-auto">
              {data.consentimientos.map((c) => (
                <ConsentimientoRow key={c.clinicaId} data={c} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Scale
  label: string
  value: number
  tone: 'ok' | 'warning' | 'neutral'
}): ReactElement {
  const color =
    tone === 'ok'
      ? 'text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-400'
        : 'text-[#4a9fd4]'
  const bg =
    tone === 'ok'
      ? 'bg-emerald-500/5 border-emerald-500/20'
      : tone === 'warning'
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-slate-800/50 border-slate-700'

  return (
    <div className={`${bg} border rounded-xl p-5 flex items-center gap-4`}>
      <Icon size={20} className={color} />
      <div>
        <p className="text-[26px] font-bold text-slate-100 tabular-nums leading-none">{value}</p>
        <p className="text-[11.5px] text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function ArcoRow({ solicitud: s }: { solicitud: SolicitudArco }): ReactElement {
  const cfg = ESTADO_ARCO_CONFIG[s.estado]
  const fechaSolicitud = new Date(s.fechaSolicitudIso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const fechaLimite = s.fechaLimiteIso
    ? new Date(s.fechaLimiteIso).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      })
    : '—'

  // Warn if past deadline and not resolved
  const isOverdue =
    s.fechaLimiteIso &&
    new Date(s.fechaLimiteIso).getTime() < Date.now() &&
    (s.estado === 'pendiente' || s.estado === 'en_proceso')

  return (
    <tr className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <td className="px-5 py-3 text-slate-200 truncate max-w-[140px]">
        {s.clinicaNombre ?? s.clinicaId.slice(0, 8) + '…'}
      </td>
      <td className="px-3 py-3 text-slate-400">{TIPO_ARCO_LABEL[s.tipo]}</td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${cfg.classes}`}
        >
          {cfg.label}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{fechaSolicitud}</td>
      <td className={`px-3 py-3 whitespace-nowrap ${isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
        {fechaLimite}
        {isOverdue ? (
          <AlertTriangle size={11} className="inline ml-1 text-rose-400" />
        ) : null}
      </td>
    </tr>
  )
}

function ConsentimientoRow({ data: c }: { data: ConsentimientoClinica }): ReactElement {
  const isLow = c.pct < 80
  const barColor = isLow ? 'bg-amber-500' : c.pct === 100 ? 'bg-emerald-500' : 'bg-[#1e5fa8]'

  return (
    <li className="px-5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-slate-200 truncate flex-1">
          {c.clinicaNombre}
        </span>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {isLow ? <AlertTriangle size={11} className="text-amber-400" /> : null}
          <span className="text-[12px] font-semibold tabular-nums text-slate-200">
            {c.pct.toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-500">
            ({c.conConsentimiento}/{c.totalPacientes})
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${Math.min(100, c.pct)}%` }}
        />
      </div>
    </li>
  )
}
