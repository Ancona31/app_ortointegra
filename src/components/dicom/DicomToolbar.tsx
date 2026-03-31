'use client'

import {
  ZoomIn, Hand, SunMedium, Ruler, Triangle, FlipHorizontal2, RotateCcw,
  Crosshair, Square, Circle, ArrowUpRight, Scan, Download, Info,
  FlipVertical2, Layers, Bone, Trash2, List,
} from 'lucide-react'

export type DicomTool =
  | 'Zoom' | 'Pan' | 'WindowLevel'
  | 'Length' | 'Angle' | 'CobbAngle'
  | 'Probe' | 'EllipticalROI' | 'RectangleROI' | 'ArrowAnnotate'
  | 'Reset'

export type DicomAction =
  | 'Invert' | 'FlipH' | 'FlipV'
  | 'PresetBone' | 'PresetSoftTissue' | 'PresetLung'
  | 'ExportPNG' | 'ToggleMetadata' | 'ToggleMPR'
  | 'ClearAnnotations' | 'ToggleSeries'

export type MprPanels = 'axial' | 'sagittal' | 'coronal' | '3panels'

interface Props {
  activeTool: DicomTool
  inverted: boolean
  mprAvailable: boolean
  mprActive: boolean
  mprPanels: MprPanels
  metadataVisible: boolean
  seriesVisible: boolean
  seriesCount: number
  onToolChange: (tool: DicomTool) => void
  onAction: (action: DicomAction) => void
  onMprPanels: (panels: MprPanels) => void
  disabled: boolean
}

const TOOLS: { id: DicomTool; label: string; icon: React.ReactNode }[] = [
  { id: 'Zoom',          label: 'Zoom',       icon: <ZoomIn size={15} /> },
  { id: 'Pan',           label: 'Pan',         icon: <Hand size={15} /> },
  { id: 'WindowLevel',   label: 'Ventana',     icon: <SunMedium size={15} /> },
  { id: 'Length',        label: 'Regla',       icon: <Ruler size={15} /> },
  { id: 'Angle',         label: 'Ángulo',      icon: <Triangle size={15} /> },
  { id: 'CobbAngle',     label: 'Cobb',        icon: <Scan size={15} /> },
  { id: 'Probe',         label: 'Probe HU',    icon: <Crosshair size={15} /> },
  { id: 'EllipticalROI', label: 'ROI Elipse',  icon: <Circle size={15} /> },
  { id: 'RectangleROI',  label: 'ROI Rect',    icon: <Square size={15} /> },
  { id: 'ArrowAnnotate', label: 'Flecha',       icon: <ArrowUpRight size={15} /> },
]

const SEP = <div className="w-px h-5 bg-slate-600 mx-0.5 shrink-0" />

export default function DicomToolbar({
  activeTool, inverted, mprAvailable, mprActive, mprPanels,
  metadataVisible, seriesVisible, seriesCount,
  onToolChange, onAction, onMprPanels, disabled,
}: Props) {
  const btn = (
    label: string, icon: React.ReactNode, onClick: () => void,
    active = false, extraClass = '',
  ) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30 shrink-0
        ${active ? 'bg-[#1e5fa8] text-white' : `text-slate-300 hover:bg-slate-700 ${extraClass}`}`}
    >
      {icon}
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  )

  return (
    <div className="flex items-center gap-0.5 p-1.5 bg-slate-900 rounded-lg flex-wrap">
      {/* Herramientas activas */}
      {TOOLS.map(t => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          disabled={disabled}
          title={t.label}
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30 shrink-0
            ${activeTool === t.id ? 'bg-[#1e5fa8] text-white' : 'text-slate-300 hover:bg-slate-700'}`}
        >
          {t.icon}
          <span className="hidden 2xl:inline">{t.label}</span>
        </button>
      ))}

      {SEP}

      {/* Presets de ventana */}
      {btn('Hueso',         <Bone size={15} />,            () => onAction('PresetBone'))}
      {btn('Tejido blando', <SunMedium size={15} />,       () => onAction('PresetSoftTissue'))}
      {btn('Pulmón',        <Layers size={15} />,          () => onAction('PresetLung'))}

      {SEP}

      {/* Manipulación */}
      {btn('Invertir', <FlipHorizontal2 size={15} />, () => onAction('Invert'), inverted)}
      {btn('Flip H',   <FlipHorizontal2 size={15} />, () => onAction('FlipH'))}
      {btn('Flip V',   <FlipVertical2 size={15} />,   () => onAction('FlipV'))}

      {SEP}

      {/* Acciones */}
      {seriesCount > 1 && btn(
        `Series (${seriesCount})`, <List size={15} />, () => onAction('ToggleSeries'), seriesVisible,
      )}
      {btn('Metadatos',         <Info size={15} />,     () => onAction('ToggleMetadata'),  metadataVisible)}
      {btn('Exportar PNG',      <Download size={15} />, () => onAction('ExportPNG'))}
      {btn('Borrar anotaciones',<Trash2 size={15} />,   () => onAction('ClearAnnotations'), false, 'hover:text-red-400')}

      {SEP}

      {/* MPR */}
      {mprAvailable && (
        <>
          {btn(mprActive ? 'Vista 2D' : 'MPR', <Layers size={15} />, () => onAction('ToggleMPR'), mprActive, 'text-teal-400')}

          {/* Selectores de plano — solo cuando MPR está activo */}
          {mprActive && (
            <div className="flex items-center gap-0.5 bg-slate-800 rounded px-1 py-0.5">
              {(['axial', 'sagittal', 'coronal', '3panels'] as MprPanels[]).map(p => (
                <button
                  key={p}
                  onClick={() => onMprPanels(p)}
                  title={p === '3panels' ? '3 paneles' : p.charAt(0).toUpperCase() + p.slice(1)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0
                    ${mprPanels === p ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {p === '3panels' ? '3×' : p === 'axial' ? 'Ax' : p === 'sagittal' ? 'Sag' : 'Cor'}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {btn('Reset', <RotateCcw size={15} />, () => onToolChange('Reset'))}
    </div>
  )
}
