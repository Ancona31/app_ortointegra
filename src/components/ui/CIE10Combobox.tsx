'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, X } from 'lucide-react'

interface CIE10Item {
  codigo: string
  descripcion: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (item: CIE10Item) => void
  placeholder?: string
  className?: string
}

/**
 * CIE10Combobox — Autocompletado universal para diagnósticos CIE-10.
 *
 * Busca en /api/cie10 al escribir ≥3 caracteres (debounce 300ms).
 * Muestra resultados como: "M48.0 - Estenosis espinal".
 * Permite texto libre si el médico no selecciona del catálogo.
 * Keyboard navigation: ↑↓ para navegar, Enter para seleccionar, Esc para cerrar.
 */
export default function CIE10Combobox({
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar diagnóstico CIE-10 o escribir...',
  className = '',
}: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<CIE10Item[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external value → internal query
  useEffect(() => {
    setQuery(value)
  }, [value])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/cie10?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { resultados: CIE10Item[] }
      setResults(data.resultados)
      setOpen(data.resultados.length > 0)
      setSelected(0)
    } catch {
      setResults([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(val: string) {
    setQuery(val)
    onChange(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  function handleSelect(item: CIE10Item) {
    const formatted = `${item.codigo} - ${item.descripcion}`
    setQuery(formatted)
    onChange(formatted)
    onSelect?.(item)
    setOpen(false)
  }

  function handleClear() {
    setQuery('')
    onChange('')
    setResults([])
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selected]) handleSelect(results[selected])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const inputCls = `w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] ${className}`

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {loading ? (
          <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        ) : (
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={placeholder}
          className={inputCls}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.map((item, i) => (
            <li key={item.codigo}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  i === selected ? 'bg-[#1e5fa8]/5 text-[#1e5fa8]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-semibold text-[#1e5fa8]">{item.codigo}</span>
                <span className="text-slate-400 mx-1.5">—</span>
                <span>{item.descripcion}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && results.length === 0 && !loading && query.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
          Sin resultados. Puedes escribir el diagnóstico manualmente.
        </div>
      )}
    </div>
  )
}
