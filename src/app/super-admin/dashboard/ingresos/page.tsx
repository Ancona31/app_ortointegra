'use client'

import { useCallback } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  DollarSign,
  ExternalLink,
  Percent,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import KpiCard from '@/components/super-admin/KpiCard'
import ChartCard from '@/components/super-admin/charts/ChartCard'
import { AreaSeries } from '@/components/super-admin/charts/SerieCharts'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  ingresosResumenSchema,
  type EstadoTransaccion,
  type IngresosResumen,
  type KpiVariacion,
  type TransaccionStripe,
} from '@/lib/super-admin/types'

async function fetchIngresos(): Promise<IngresosResumen> {
  const res = await fetch('/api/super-admin/dashboard/ingresos', { cache: 'no-store' })
  const json: unknown = await res.json()
  if (!res.ok) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Error del servidor'
    throw new Error(err)
  }
  const parsed = ingresosResumenSchema.safeParse(json)
  if (!parsed.success) throw new Error('Respuesta inválida del servidor')
  return parsed.data
}

function formatMes(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-MX', { month: 'short' })
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoneda(valor: number, moneda = 'MXN'): string {
  return valor.toLocaleString('es-MX', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  })
}

const ESTADO_INVOICE: Record<EstadoTransaccion, { label: string; classes: string }> = {
  paid: { label: 'Pagada', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  open: { label: 'Abierta', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  void: { label: 'Anulada', classes: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  uncollectible: {
    label: 'Incobrable',
    classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  draft: { label: 'Borrador', classes: 'bg-slate-700/40 text-slate-300 border-slate-600' },
  desconocido: { label: '—', classes: 'bg-slate-700/40 text-slate-300 border-slate-600' },
}

export default function IngresosPage(): ReactElement {
  const { state, reload } = useAsyncResource<IngresosResumen>(fetchIngresos, [])
  const handleReload = useCallback((): void => reload(), [reload])

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Ingresos"
        subtitle="MRR, conversiones y transacciones de Stripe"
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
        <LoadingView label="Consultando Stripe..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <IngresosContent data={state.data} />
      )}
    </div>
  )
}

function makeSimpleKpi(valor: number): KpiVariacion {
  return { valor, variacionPct: null, direccion: 'flat' }
}

function IngresosContent({ data }: { data: IngresosResumen }): ReactElement {
  const conversionKpi: KpiVariacion = {
    valor: data.conversionTrialPct ?? 0,
    variacionPct: null,
    direccion: 'flat',
  }
  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="MRR actual"
          icon={DollarSign}
          data={data.mrrActual}
          format="currency"
          comparativaLabel="vs hace 30 días"
        />
        <KpiCard
          label="Clínicas en trial"
          icon={Sparkles}
          data={makeSimpleKpi(data.clinicasEnTrial)}
          comparativaLabel="trialing"
        />
        <KpiCard
          label="Conversión trial → pago"
          icon={Percent}
          data={conversionKpi}
          comparativaLabel="últimos 60-90 d"
        />
        <KpiCard
          label="Pago fallido"
          icon={AlertTriangle}
          data={makeSimpleKpi(data.clinicasPagoFallido)}
          comparativaLabel="past_due"
        />
        <KpiCard
          label="Vencen en 7 días"
          icon={CalendarClock}
          data={makeSimpleKpi(data.suscripcionesVencen7d)}
          comparativaLabel="cancel_at_period_end"
        />
      </div>

      {/* Gráfica de ingresos */}
      <div className="mb-6">
        <ChartCard title="Ingresos por mes" subtitle="Últimos 12 meses (Stripe invoices pagadas)">
          <AreaSeries data={data.serieIngresosPorMes} formatLabel={formatMes} esMoneda height={260} />
        </ChartCard>
      </div>

      {/* Listas accionables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ListaCompacta
          title="Clínicas en trial"
          icon={Sparkles}
          empty="Sin trials activos"
          items={data.trials.map((t) => ({
            id: t.clinicaId,
            primary: t.nombre,
            secondary: `Termina en ${t.diasRestantes} d`,
          }))}
        />
        <ListaCompacta
          title="Pagos fallidos"
          icon={AlertTriangle}
          tone="rose"
          empty="Ningún pago fallido"
          items={data.pagosFallidos.map((p) => ({
            id: p.clinicaId,
            primary: p.nombre,
            secondary: `${p.diasFallido} d en past_due`,
          }))}
        />
        <ListaCompacta
          title="Vencen en 7 días"
          icon={CalendarClock}
          tone="amber"
          empty="Ninguna por vencer"
          items={data.porVencer.map((v) => ({
            id: v.clinicaId,
            primary: v.nombre,
            secondary: `${v.diasParaVencer} d · ${formatMoneda(v.monto)}/mes`,
          }))}
        />
      </div>

      {/* Tabla de transacciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <CreditCard size={14} className="text-[#1e5fa8]" />
          <h3 className="text-[14px] font-semibold text-slate-100">Transacciones recientes</h3>
          <span className="text-[11px] text-slate-500">
            (últimas {data.transacciones.length})
          </span>
        </div>
        {data.transacciones.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-slate-500">
            No hay transacciones registradas en Stripe.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10.5px]">
                  <th className="text-left font-semibold px-5 py-3">Fecha</th>
                  <th className="text-left font-semibold px-3 py-3">Clínica</th>
                  <th className="text-right font-semibold px-3 py-3">Monto</th>
                  <th className="text-left font-semibold px-3 py-3">Moneda</th>
                  <th className="text-left font-semibold px-3 py-3">Estado</th>
                  <th className="text-right font-semibold px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.transacciones.map((t) => (
                  <TransaccionRow key={t.id} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function TransaccionRow({ t }: { t: TransaccionStripe }): ReactElement {
  const cfg = ESTADO_INVOICE[t.estado]
  return (
    <tr className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <td className="px-5 py-3 text-slate-300">{formatFecha(t.fechaIso)}</td>
      <td className="px-3 py-3 text-slate-100">
        {t.clinicaNombre ?? <span className="text-slate-600">— sin vincular —</span>}
      </td>
      <td className="px-3 py-3 text-right text-slate-100 tabular-nums font-semibold">
        {formatMoneda(t.monto, t.moneda)}
      </td>
      <td className="px-3 py-3 text-slate-400">{t.moneda}</td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${cfg.classes}`}
        >
          {cfg.label}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        {t.hostedInvoiceUrl ? (
          <a
            href={t.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-[#4a9fd4] transition-colors"
          >
            Abrir
            <ExternalLink size={12} />
          </a>
        ) : null}
      </td>
    </tr>
  )
}

interface ListaCompactaItem {
  id: string
  primary: string
  secondary: string
}

interface ListaCompactaProps {
  title: string
  icon: typeof Sparkles
  items: ReadonlyArray<ListaCompactaItem>
  empty: string
  tone?: 'default' | 'rose' | 'amber'
}

function ListaCompacta({
  title,
  icon: Icon,
  items,
  empty,
  tone = 'default',
}: ListaCompactaProps): ReactElement {
  const iconColor =
    tone === 'rose' ? 'text-rose-400' : tone === 'amber' ? 'text-amber-400' : 'text-[#1e5fa8]'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={iconColor} />
        <h3 className="text-[13px] font-semibold text-slate-100">{title}</h3>
        <span className="text-[11px] text-slate-500 ml-auto">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] text-slate-500 py-3 text-center">{empty}</p>
      ) : (
        <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0"
            >
              <span className="text-[12.5px] text-slate-200 truncate flex-1">{it.primary}</span>
              <span className="text-[11px] text-slate-500 flex-shrink-0">{it.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
