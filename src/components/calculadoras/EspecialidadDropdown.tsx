'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { ESPECIALIDADES } from '@/lib/calculadoras/categorias'
import type { EspecialidadSlug } from '@/lib/calculadoras/types'

export type EspecialidadFilter = EspecialidadSlug | 'todas'

type Props = {
  value: EspecialidadFilter
  onChange: (value: EspecialidadFilter) => void
}

export default function EspecialidadDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const seleccionada = value === 'todas' ? null : ESPECIALIDADES.find(e => e.slug === value) ?? null
  const Icon = seleccionada?.icon ?? LayoutGrid
  const color = seleccionada?.color ?? '#64748b'
  const label = seleccionada?.nombre ?? 'Todas las especialidades'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 transition-all duration-200 min-w-[220px]"
        style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}14`, color }}
        >
          <Icon size={14} strokeWidth={2.2} />
        </span>
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform duration-200"
          style={{
            transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[280px] max-h-[360px] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-lg z-30 p-1.5"
          style={{
            boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            animation: 'modalEnter 0.22s cubic-bezier(0.32, 0.72, 0, 1) both',
          }}
        >
          <button
            type="button"
            onClick={() => { onChange('todas'); setOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
              value === 'todas' ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
              <LayoutGrid size={14} strokeWidth={2.2} />
            </span>
            <span className="flex-1 text-left">Todas las especialidades</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {ESPECIALIDADES.map(esp => {
            const EspIcon = esp.icon
            const activa = value === esp.slug
            return (
              <button
                key={esp.slug}
                type="button"
                onClick={() => { onChange(esp.slug); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  activa ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${esp.color}14`, color: esp.color }}
                >
                  <EspIcon size={14} strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-left truncate">{esp.nombre}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
