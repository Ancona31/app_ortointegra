'use client'

import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ReactElement } from 'react'
import type { KpiVariacion } from '@/lib/super-admin/types'

interface KpiCardProps {
  label: string
  icon: LucideIcon
  data: KpiVariacion
  format?: 'number' | 'currency'
  comparativaLabel?: string
}

function formatValue(v: number, format: 'number' | 'currency'): string {
  if (format === 'currency') {
    return v.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    })
  }
  return v.toLocaleString('es-MX')
}

function formatPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export default function KpiCard({
  label,
  icon: Icon,
  data,
  format = 'number',
  comparativaLabel = 'vs mes anterior',
}: KpiCardProps): ReactElement {
  const colorMap = {
    up: 'text-emerald-400',
    down: 'text-rose-400',
    flat: 'text-slate-500',
  } as const
  const bgMap = {
    up: 'bg-emerald-500/10',
    down: 'bg-rose-500/10',
    flat: 'bg-slate-500/10',
  } as const
  const ArrowIcon = data.direccion === 'up' ? ArrowUp : data.direccion === 'down' ? ArrowDown : Minus

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg bg-[#1e5fa8]/10 flex items-center justify-center text-[#1e5fa8]">
          <Icon size={16} />
        </div>
      </div>
      <div className="text-3xl font-bold text-white tracking-tight tabular-nums">
        {formatValue(data.valor, format)}
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${bgMap[data.direccion]} ${colorMap[data.direccion]}`}
        >
          <ArrowIcon size={11} />
          {formatPct(data.variacionPct)}
        </span>
        <span className="text-[11px] text-slate-500">{comparativaLabel}</span>
      </div>
    </div>
  )
}
