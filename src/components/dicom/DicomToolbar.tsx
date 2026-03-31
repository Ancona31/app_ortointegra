'use client'

import { ZoomIn, Hand, SunMedium, Ruler, Triangle, FlipHorizontal2, RotateCcw } from 'lucide-react'

export type DicomTool = 'Zoom' | 'Pan' | 'WindowLevel' | 'Length' | 'Angle' | 'Reset'

interface Props {
  activeTool: DicomTool
  inverted: boolean
  onToolChange: (tool: DicomTool) => void
  onInvert: () => void
  disabled: boolean
}

const TOOLS: { id: DicomTool; label: string; icon: React.ReactNode }[] = [
  { id: 'Zoom',        label: 'Zoom',      icon: <ZoomIn size={16} /> },
  { id: 'Pan',         label: 'Pan',        icon: <Hand size={16} /> },
  { id: 'WindowLevel', label: 'Ventana',    icon: <SunMedium size={16} /> },
  { id: 'Length',      label: 'Regla',      icon: <Ruler size={16} /> },
  { id: 'Angle',       label: 'Ángulo',     icon: <Triangle size={16} /> },
]

export default function DicomToolbar({ activeTool, inverted, onToolChange, onInvert, disabled }: Props) {
  return (
    <div className="flex items-center gap-1 p-2 bg-slate-900 rounded-lg flex-wrap">
      {TOOLS.map(t => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          disabled={disabled}
          title={t.label}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30
            ${activeTool === t.id
              ? 'bg-[#1e5fa8] text-white'
              : 'text-slate-300 hover:bg-slate-700'}`}
        >
          {t.icon}
          <span className="hidden xl:inline">{t.label}</span>
        </button>
      ))}

      <div className="w-px h-5 bg-slate-600 mx-1" />

      <button
        onClick={onInvert}
        disabled={disabled}
        title="Invertir colores"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30
          ${inverted ? 'bg-slate-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
      >
        <FlipHorizontal2 size={16} />
        <span className="hidden xl:inline">Invertir</span>
      </button>

      <button
        onClick={() => onToolChange('Reset')}
        disabled={disabled}
        title="Restablecer vista"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30"
      >
        <RotateCcw size={16} />
        <span className="hidden xl:inline">Reset</span>
      </button>
    </div>
  )
}
