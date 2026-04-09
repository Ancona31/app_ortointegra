'use client'

/**
 * RankingFunciones
 *
 * Barra horizontal que muestra el top de acciones del audit_log.
 * Usa Recharts BarChart horizontal.
 */

import type { ReactElement } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { RankingFuncion } from '@/lib/super-admin/types'

interface RankingFuncionesProps {
  data: ReadonlyArray<RankingFuncion>
  height?: number
}

const AXIS_TICK = { fill: '#64748b', fontSize: 10 }
const GRID_STROKE = '#1e293b'
const PRIMARY = '#1e5fa8'

interface TooltipPayloadItem {
  value?: number | string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null
  const raw = payload[0]?.value
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 shadow-xl max-w-[220px]">
      <div className="text-[10px] text-slate-400 break-all">{label}</div>
      <div className="text-[13px] font-semibold text-slate-100 tabular-nums">
        {Number.isNaN(value) ? '—' : value.toLocaleString('es-MX')} acciones
      </div>
    </div>
  )
}

export default function RankingFunciones({
  data,
  height = 340,
}: RankingFuncionesProps): ReactElement {
  // Truncar etiquetas largas para el eje Y
  const chartData = [...data].map((d) => ({
    ...d,
    label: d.accion.length > 22 ? `${d.accion.slice(0, 20)}…` : d.accion,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          stroke={GRID_STROKE}
          width={140}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(30, 95, 168, 0.08)' }} />
        <Bar dataKey="total" fill={PRIMARY} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
