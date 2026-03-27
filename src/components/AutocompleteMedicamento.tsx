'use client'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'

export type MedicamentoDB = {
  nombre_comercial: string
  principio_activo: string
  presentacion: string
  dosis_sugerida: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (med: MedicamentoDB) => void
  placeholder?: string
  className?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AutocompleteMedicamento({ value, onChange, onSelect, placeholder = 'Ej: VOLTAREN', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const query = value.trim()
  const shouldFetch = query.length >= 2

  const { data, isLoading } = useSWR<MedicamentoDB[]>(
    shouldFetch ? `/api/medicamentos?q=${encodeURIComponent(query)}` : null,
    fetcher,
    { keepPreviousData: false }
  )

  const resultados: MedicamentoDB[] = Array.isArray(data) ? data : []

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || resultados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(resultados[highlighted]) }
    if (e.key === 'Escape') setOpen(false)
  }

  function handleSelect(med: MedicamentoDB) {
    onChange(med.nombre_comercial)
    onSelect(med)
    setOpen(false)
  }

  const showDropdown = open && shouldFetch && (isLoading || resultados.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (shouldFetch) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 ${className}`}
      />
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {isLoading && resultados.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">Buscando...</p>
          ) : (
            resultados.map((med, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSelect(med)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-0 transition-colors ${i === highlighted ? 'bg-[#1e5fa8]/10' : 'hover:bg-slate-50'}`}
              >
                <p className="text-sm font-semibold text-slate-800">{med.nombre_comercial} <span className="font-normal text-slate-400 text-xs">· {med.presentacion}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">{med.principio_activo} — <span className="text-slate-400">{med.dosis_sugerida}</span></p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
