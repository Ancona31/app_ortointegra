'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { ReactElement } from 'react'
import type { DistribucionItem, SeriePunto } from '@/lib/super-admin/types'

const AXIS_TICK = { fill: '#64748b', fontSize: 11 }
const GRID_STROKE = '#1e293b'
const PRIMARY = '#1e5fa8'
const PRIMARY_LIGHT = '#4a9fd4'

interface SeriePropsBase {
  data: ReadonlyArray<SeriePunto>
  height?: number
  formatLabel?: (fecha: string) => string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number | string | undefined }>
  label?: string | number
  formatLabel?: (fecha: string) => string
  esMoneda?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
  formatLabel,
  esMoneda,
}: CustomTooltipProps): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null
  const raw = payload[0]?.value
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (Number.isNaN(value)) return null
  const formatted = esMoneda
    ? value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
    : value.toLocaleString('es-MX')
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
        {formatLabel ? formatLabel(String(label)) : String(label)}
      </div>
      <div className="text-[13px] font-semibold text-slate-100 tabular-nums">{formatted}</div>
    </div>
  )
}

export function LineSeries({ data, height = 220, formatLabel }: SeriePropsBase): ReactElement {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="fecha" tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={formatLabel} />
        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} width={32} />
        <Tooltip
          content={<CustomTooltip formatLabel={formatLabel} />}
          cursor={{ stroke: PRIMARY, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={PRIMARY_LIGHT}
          strokeWidth={2}
          dot={{ fill: PRIMARY, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function BarSeries({ data, height = 220, formatLabel }: SeriePropsBase): ReactElement {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="fecha" tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={formatLabel} />
        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} width={32} />
        <Tooltip
          content={<CustomTooltip formatLabel={formatLabel} />}
          cursor={{ fill: 'rgba(30, 95, 168, 0.1)' }}
        />
        <Bar dataKey="valor" fill={PRIMARY} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface AreaSeriesProps extends SeriePropsBase {
  esMoneda?: boolean
}

export function AreaSeries({
  data,
  height = 220,
  formatLabel,
  esMoneda,
}: AreaSeriesProps): ReactElement {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.6} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="fecha" tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={formatLabel} />
        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} width={50} />
        <Tooltip
          content={<CustomTooltip formatLabel={formatLabel} esMoneda={esMoneda} />}
          cursor={{ stroke: PRIMARY, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke={PRIMARY_LIGHT}
          strokeWidth={2}
          fill="url(#gradArea)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface DonutChartProps {
  data: ReadonlyArray<DistribucionItem>
  height?: number
}

export function DonutChart({ data, height = 220 }: DonutChartProps): ReactElement {
  const total = data.reduce((acc, d) => acc + d.valor, 0)
  return (
    <div className="flex items-center gap-6">
      <div className="flex-shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[...data]}
              dataKey="valor"
              nameKey="etiqueta"
              cx="50%"
              cy="50%"
              innerRadius={height / 2 - 38}
              outerRadius={height / 2 - 8}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {data.map((d) => {
          const pct = total === 0 ? 0 : (d.valor / total) * 100
          return (
            <div key={d.etiqueta} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[12px] text-slate-300 flex-1 truncate">{d.etiqueta}</span>
              <span className="text-[12px] font-semibold text-slate-100 tabular-nums">
                {d.valor.toLocaleString('es-MX')}
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums w-10 text-right">
                {pct.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
