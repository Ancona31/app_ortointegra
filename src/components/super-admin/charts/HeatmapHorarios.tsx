'use client'

/**
 * HeatmapHorarios
 *
 * Renderiza un heatmap 24 horas × 7 días de la semana usando SVG puro.
 * No requiere dependencias adicionales — Recharts no tiene heatmap nativo.
 */

import type { ReactElement } from 'react'
import type { HeatmapCell } from '@/lib/super-admin/types'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CELL_W = 22
const CELL_H = 18
const LABEL_W = 28
const LABEL_H = 20
const GAP = 2

interface HeatmapHorariosProps {
  data: ReadonlyArray<HeatmapCell>
}

function colorForRatio(ratio: number): string {
  // Escala de azul: de slate-900 (0) a #1e5fa8 (0.5) a #4a9fd4 (1)
  if (ratio <= 0) return '#0f172a'
  if (ratio < 0.3) {
    const t = ratio / 0.3
    const r = Math.round(15 + t * (30 - 15))
    const g = Math.round(23 + t * (95 - 23))
    const b = Math.round(42 + t * (168 - 42))
    return `rgb(${r},${g},${b})`
  }
  const t = Math.min(1, (ratio - 0.3) / 0.7)
  const r = Math.round(30 + t * (74 - 30))
  const g = Math.round(95 + t * (159 - 95))
  const b = Math.round(168 + t * (212 - 168))
  return `rgb(${r},${g},${b})`
}

export default function HeatmapHorarios({ data }: HeatmapHorariosProps): ReactElement {
  // Build lookup map: `${hora}-${diaSemana}` → total
  const map = new Map<string, number>()
  let maxVal = 0
  for (const cell of data) {
    const key = `${cell.hora}-${cell.diaSemana}`
    map.set(key, cell.total)
    if (cell.total > maxVal) maxVal = cell.total
  }

  const totalW = LABEL_W + 24 * (CELL_W + GAP)
  const totalH = LABEL_H + 7 * (CELL_H + GAP)

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={totalH}
        role="img"
        aria-label="Heatmap de actividad por hora y día de la semana"
      >
        {/* Hour labels (top) */}
        {Array.from({ length: 24 }, (_, h) => (
          <text
            key={h}
            x={LABEL_W + h * (CELL_W + GAP) + CELL_W / 2}
            y={LABEL_H - 4}
            textAnchor="middle"
            fill="#475569"
            fontSize={8}
          >
            {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
          </text>
        ))}

        {/* Day labels (left) */}
        {DIAS.map((dia, d) => (
          <text
            key={d}
            x={LABEL_W - 4}
            y={LABEL_H + d * (CELL_H + GAP) + CELL_H / 2 + 3}
            textAnchor="end"
            fill="#475569"
            fontSize={9}
          >
            {dia}
          </text>
        ))}

        {/* Cells */}
        {Array.from({ length: 7 }, (_, d) =>
          Array.from({ length: 24 }, (_, h) => {
            const key = `${h}-${d}`
            const val = map.get(key) ?? 0
            const ratio = maxVal === 0 ? 0 : val / maxVal
            return (
              <rect
                key={key}
                x={LABEL_W + h * (CELL_W + GAP)}
                y={LABEL_H + d * (CELL_H + GAP)}
                width={CELL_W}
                height={CELL_H}
                rx={3}
                fill={colorForRatio(ratio)}
              >
                <title>
                  {DIAS[d]} {String(h).padStart(2, '0')}:00 — {val.toLocaleString('es-MX')} acciones
                </title>
              </rect>
            )
          }),
        )}
      </svg>

      {/* Leyenda */}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
        <span>Menos</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => (
          <div
            key={r}
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: colorForRatio(r) }}
          />
        ))}
        <span>Más</span>
      </div>
    </div>
  )
}
