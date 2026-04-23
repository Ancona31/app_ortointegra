'use client'

import { Trash2, Plus } from 'lucide-react'
import CIE10Combobox from '@/components/ui/CIE10Combobox'
import type { Diagnostico } from '@/types'

interface Props {
  value: Diagnostico[]
  onChange: (diagnosticos: Diagnostico[]) => void
  disabled?: boolean
}

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

function displayValue(d: Diagnostico): string {
  if (!d.descripcion) return ''
  return d.codigo_cie10 ? `${d.codigo_cie10} - ${d.descripcion}` : d.descripcion
}

export default function DiagnosticosEditor({ value, onChange, disabled = false }: Props) {
  const rows: Diagnostico[] = value.length > 0 ? value : [{ descripcion: '' }]

  function updateRow(idx: number, patch: Diagnostico) {
    const next = rows.map((d, i) => (i === idx ? patch : d))
    onChange(next)
  }

  function addRow() {
    onChange([...rows, { descripcion: '' }])
  }

  function removeRow(idx: number) {
    if (rows.length === 1) {
      onChange([{ descripcion: '' }])
      return
    }
    onChange(rows.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((d, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 rounded-xl"
          style={{ transition: `all 200ms ${IOS_EASING}` }}
        >
          <div className="flex-1">
            <CIE10Combobox
              value={displayValue(d)}
              onChange={(val) => updateRow(idx, { descripcion: val })}
              onSelect={(item) =>
                updateRow(idx, { codigo_cie10: item.codigo, descripcion: item.descripcion })
              }
              placeholder={
                idx === 0
                  ? 'Buscar diagnóstico CIE-10 o escribir...'
                  : 'Diagnóstico adicional...'
              }
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(idx)}
            disabled={disabled || (rows.length === 1 && !d.descripcion)}
            aria-label="Eliminar diagnóstico"
            className="mt-1 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
            style={{ transitionTimingFunction: IOS_EASING }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={disabled}
        className="self-start flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
        style={{ transition: `color 200ms ${IOS_EASING}` }}
      >
        <Plus size={13} />
        Agregar diagnóstico
      </button>
    </div>
  )
}
