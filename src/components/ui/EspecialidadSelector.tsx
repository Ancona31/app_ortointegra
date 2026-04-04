'use client'

import { Plus, X } from 'lucide-react'
import { ESPECIALIDADES } from '@/lib/especialidades'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  /** Clases del select. Por defecto estilo macOS sheet */
  selectClassName?: string
}

export default function EspecialidadSelector({ value, onChange, selectClassName }: Props) {
  const base = selectClassName ??
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all'

  function setEsp(idx: number, val: string) {
    const next = [...value]
    next[idx] = val
    onChange(next)
  }

  function agregar() {
    if (value.length < 2) onChange([...value, ''])
  }

  function quitar(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {value.map((esp, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={esp}
            onChange={e => setEsp(idx, e.target.value)}
            required={idx === 0}
            className={base}
          >
            <option value="">Selecciona especialidad</option>
            {ESPECIALIDADES.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => quitar(idx)}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {value.length < 2 && (
        <button
          type="button"
          onClick={agregar}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors py-0.5"
        >
          <Plus size={13} strokeWidth={2.5} />
          Agregar especialidad
        </button>
      )}
    </div>
  )
}
