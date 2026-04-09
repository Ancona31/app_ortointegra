import type { ReactElement } from 'react'
import type { EstadoClinica, EstadoPago, RetencionBadge, TipoCuenta } from '@/lib/super-admin/types'

const ESTADO_PAGO_MAP: Record<EstadoPago, { label: string; classes: string }> = {
  gratuito: { label: 'Gratuito', classes: 'bg-slate-700/40 text-slate-300 border-slate-600' },
  trial: { label: 'Trial', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  pagando: { label: 'Pagando', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  vip: { label: 'VIP', classes: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  pago_fallido: { label: 'Pago fallido', classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  cancelado: { label: 'Cancelado', classes: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
}

const ESTADO_CLINICA_MAP: Record<EstadoClinica, { label: string; classes: string }> = {
  activa: { label: 'Activa', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  suspendida: { label: 'Suspendida', classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  inactiva: { label: 'Inactiva', classes: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
}

const TIPO_MAP: Record<TipoCuenta, string> = {
  clinica: 'Clínica',
  independiente: 'Independiente',
}

const RETENCION_MAP: Record<RetencionBadge, { label: string; classes: string }> = {
  activo_7d: { label: 'Activo', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  tibio_14d: { label: '7-14 d', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  frio_30d: { label: '14-30 d', classes: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  inactivo: { label: '30+ d', classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
}

export function EstadoPagoBadge({ value }: { value: EstadoPago }): ReactElement {
  const cfg = ESTADO_PAGO_MAP[value]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

export function EstadoClinicaBadge({ value }: { value: EstadoClinica }): ReactElement {
  const cfg = ESTADO_CLINICA_MAP[value]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

export function TipoBadge({ value }: { value: TipoCuenta }): ReactElement {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800/60 text-slate-300 text-[10.5px] font-semibold uppercase tracking-wider">
      {TIPO_MAP[value]}
    </span>
  )
}

export function RetencionBadgeView({ value }: { value: RetencionBadge }): ReactElement {
  const cfg = RETENCION_MAP[value]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
