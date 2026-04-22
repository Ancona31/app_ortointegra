'use client'

import { memo } from 'react'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

export type RangoTemporal = '1m' | '3m' | '6m' | '1a' | '5a' | 'todo'

const LABELS: Record<RangoTemporal, string> = {
  '1m': '1 mes',
  '3m': '3 meses',
  '6m': '6 meses',
  '1a': '1 año',
  '5a': '5 años',
  'todo': 'Todo',
}

const ORDEN: readonly RangoTemporal[] = ['1m', '3m', '6m', '1a', '5a', 'todo'] as const

interface Props {
  rango: RangoTemporal
  contadores: Record<RangoTemporal, number>
  onChange: (r: RangoTemporal) => void
}

function FiltroTemporalBase({ rango, contadores, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="Rango temporal">
      {ORDEN.map(r => {
        const activo = r === rango
        const count = contadores[r]
        const disabled = !activo && count === 0 && r !== 'todo'
        return (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={activo}
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap ${
              activo
                ? 'text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100'
            }`}
            style={{
              ...(activo ? { background: 'var(--cp)' } : {}),
              transition: 'all 200ms',
              transitionTimingFunction: IOS_EASING,
            }}
          >
            {LABELS[r]}
            <span className={`tabular-nums ${activo ? 'opacity-80' : 'opacity-60'}`}>
              ({count})
            </span>
          </button>
        )
      })}
    </div>
  )
}

const FiltroTemporal = memo(FiltroTemporalBase)
export default FiltroTemporal
