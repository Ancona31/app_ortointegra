'use client'

import { useMemo, type ReactElement } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import type { AnalitoCatalogo, MedicionAnalito, RangoAnalito } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'
import {
  BAND_COLORS,
  getRangoEffective,
  statusLabelDetailed,
  formatFechaChart,
  formatFechaLarga,
  type Sexo,
} from '@/lib/labs/utils'

interface Props {
  analito: AnalitoRastreado
  analitoCatalogo: AnalitoCatalogo | null
  mediciones: MedicionAnalito[]
  sexoPaciente: Sexo
  onResetFiltro?: () => void
}

interface ChartDatum {
  medido_en: string
  valor: number
  id: string
}

function formatValor(v: number, precision: number): string {
  if (precision <= 0) return String(Math.round(v))
  return v.toFixed(precision)
}

interface TooltipPayloadItem {
  payload?: ChartDatum
}

interface TooltipContentProps {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadItem>
}

export default function GraficaAnalito({
  analito,
  analitoCatalogo,
  mediciones,
  sexoPaciente,
  onResetFiltro,
}: Props): ReactElement {
  const rango = useMemo(
    () => getRangoEffective(analitoCatalogo, sexoPaciente),
    [analitoCatalogo, sexoPaciente],
  )

  const chartData = useMemo<ChartDatum[]>(() => {
    return mediciones
      .map(m => ({ medido_en: m.medido_en, valor: Number(m.valor), id: m.id }))
      .sort((a, b) => a.medido_en.localeCompare(b.medido_en))
  }, [mediciones])

  const { yMin, yMax } = useMemo(() => {
    if (chartData.length === 0) return { yMin: 0, yMax: 10 }
    const valores = chartData.map(d => d.valor)
    const extras: number[] = []
    if (rango) {
      if (rango.warn_min !== undefined) extras.push(rango.warn_min)
      else if (rango.ok_min !== undefined) extras.push(rango.ok_min)
      if (rango.warn_max !== undefined) extras.push(rango.warn_max)
      else if (rango.ok_max !== undefined) extras.push(rango.ok_max)
    }
    const all = [...valores, ...extras]
    let minBase = Math.min(...all)
    let maxBase = Math.max(...all)
    if (maxBase === minBase) {
      const delta = Math.abs(minBase) * 0.1 || 1
      minBase -= delta
      maxBase += delta
    }
    const padding = 0.1 * (maxBase - minBase)
    let min = minBase - padding
    const max = maxBase + padding
    if (min < 0) min = 0
    return { yMin: min, yMax: max }
  }, [chartData, rango])

  const precision = analitoCatalogo?.precision_decimales ?? 1

  if (chartData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col items-center text-center py-6">
          <p className="text-[13px] font-medium text-slate-700 mb-1">
            No hay mediciones en este rango
          </p>
          <p className="text-[12px] text-slate-500 mb-3">
            Cambia el rango temporal para ver el histórico completo.
          </p>
          {onResetFiltro && (
            <button
              type="button"
              onClick={onResetFiltro}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-medium text-white shadow-sm active:scale-[0.98] transition-all"
              style={{ background: 'var(--cp)' }}
            >
              Ver todas
            </button>
          )}
        </div>
      </div>
    )
  }

  const bandas = buildBandas(analitoCatalogo, rango, yMin, yMax)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="medido_en"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#e2e8f0"
              tickFormatter={formatFechaChart}
              minTickGap={24}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#e2e8f0"
              width={44}
              tickFormatter={(v: number) => formatValor(v, precision)}
            />
            {bandas.map((b, i) => (
              <ReferenceArea
                key={`band-${i}`}
                y1={b.y1}
                y2={b.y2}
                fill={BAND_COLORS[b.kind].fill}
                fillOpacity={BAND_COLORS[b.kind].opacity}
                stroke="none"
                ifOverflow="visible"
              />
            ))}
            <Tooltip
              content={(props: TooltipContentProps) => {
                const { active, payload } = props
                if (!active || !payload || payload.length === 0) return null
                const datum = payload[0]?.payload
                if (!datum) return null
                const statusText = statusLabelDetailed(
                  datum.valor,
                  analitoCatalogo,
                  sexoPaciente,
                )
                return (
                  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {formatFechaLarga(datum.medido_en)}
                    </div>
                    <div className="text-[13px] font-semibold text-slate-900 tabular-nums mt-0.5">
                      {formatValor(datum.valor, precision)}
                      <span className="text-slate-500 font-normal ml-1">{analito.unidad}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{statusText}</div>
                  </div>
                )
              }}
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke="currentColor"
              style={{ stroke: 'var(--cp)', color: 'var(--cp)' }}
              strokeWidth={2.5}
              dot={{
                r: 4,
                stroke: '#ffffff',
                strokeWidth: 2,
                style: { fill: 'var(--cp)' },
              }}
              activeDot={{
                r: 6,
                stroke: '#ffffff',
                strokeWidth: 2,
                style: { fill: 'var(--cp)' },
              }}
              isAnimationActive
              animationDuration={400}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface Banda {
  y1: number
  y2: number
  kind: 'ok' | 'warn' | 'bad'
}

function buildBandas(
  analito: AnalitoCatalogo | null,
  rango: RangoAnalito | null,
  yMin: number,
  yMax: number,
): Banda[] {
  if (!analito || !rango || analito.bands_type === 'none') return []
  const bands: Banda[] = []

  if (analito.bands_type === 'high-bad') {
    const { ok_max, warn_max } = rango
    if (ok_max === undefined) return []
    bands.push({ y1: yMin, y2: ok_max, kind: 'ok' })
    if (warn_max !== undefined && warn_max > ok_max) {
      bands.push({ y1: ok_max, y2: warn_max, kind: 'warn' })
      bands.push({ y1: warn_max, y2: yMax, kind: 'bad' })
    } else {
      bands.push({ y1: ok_max, y2: yMax, kind: 'bad' })
    }
    return bands
  }

  if (analito.bands_type === 'low-bad') {
    const { ok_min, warn_min } = rango
    if (ok_min === undefined) return []
    if (warn_min !== undefined && warn_min < ok_min) {
      bands.push({ y1: yMin, y2: warn_min, kind: 'bad' })
      bands.push({ y1: warn_min, y2: ok_min, kind: 'warn' })
    } else {
      bands.push({ y1: yMin, y2: ok_min, kind: 'bad' })
    }
    bands.push({ y1: ok_min, y2: yMax, kind: 'ok' })
    return bands
  }

  if (analito.bands_type === 'low-and-high-bad') {
    const { ok_min, ok_max, warn_min, warn_max } = rango
    if (ok_min === undefined || ok_max === undefined) return []

    const lowEdge = warn_min !== undefined && warn_min < ok_min ? warn_min : ok_min
    bands.push({ y1: yMin, y2: lowEdge, kind: 'bad' })
    if (warn_min !== undefined && warn_min < ok_min) {
      bands.push({ y1: warn_min, y2: ok_min, kind: 'warn' })
    }
    bands.push({ y1: ok_min, y2: ok_max, kind: 'ok' })
    if (warn_max !== undefined && warn_max > ok_max) {
      bands.push({ y1: ok_max, y2: warn_max, kind: 'warn' })
    }
    const highEdge = warn_max !== undefined && warn_max > ok_max ? warn_max : ok_max
    bands.push({ y1: highEdge, y2: yMax, kind: 'bad' })
    return bands
  }

  return []
}
