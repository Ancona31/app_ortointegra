'use client'

export type SeriesInfo = {
  uid: string
  description: string
  number: number
  modality: string
  count: number
  imageIds: string[]
  isVolumetric: boolean
}

interface Props {
  series: SeriesInfo[]
  activeUid: string | null
  onSelect: (uid: string) => void
}

const MODALITY_COLOR: Record<string, string> = {
  CT: 'bg-blue-700',
  MR: 'bg-purple-700',
  CR: 'bg-slate-600',
  DX: 'bg-slate-600',
  PT: 'bg-orange-700',
  NM: 'bg-green-700',
  US: 'bg-cyan-700',
}

export default function DicomSeriesPanel({ series, activeUid, onSelect }: Props) {
  return (
    <div className="w-48 shrink-0 bg-slate-900 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-700">
        Series ({series.length})
      </p>
      <div className="overflow-y-auto flex-1">
        {series.map(s => {
          const isActive = s.uid === activeUid
          const color = MODALITY_COLOR[s.modality] ?? 'bg-slate-600'
          return (
            <button
              key={s.uid}
              onClick={() => onSelect(s.uid)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-800 transition-colors flex flex-col gap-0.5
                ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${color} shrink-0`}>
                  {s.modality || '?'}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{s.count} img</span>
                {s.isVolumetric && (
                  <span className="text-[9px] text-teal-400 shrink-0">3D</span>
                )}
              </div>
              <p className="text-xs text-slate-200 leading-tight truncate w-full">
                {s.description || `Serie ${s.number || '?'}`}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
