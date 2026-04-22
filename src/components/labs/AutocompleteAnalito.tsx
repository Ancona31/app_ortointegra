'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, PlusCircle } from 'lucide-react'
import type { AnalitoCatalogo, CategoriaAnalito } from '@/types'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

const CATEGORIA_LABEL: Record<CategoriaAnalito, string> = {
  antropometria: 'Antropometría',
  signos_vitales: 'Signos vitales',
  hematologia: 'Hematología',
  quimica: 'Química',
  hueso: 'Hueso',
  endocrino: 'Endocrino',
  inmunologia: 'Inmunología',
  coagulacion: 'Coagulación',
  cardiaco: 'Cardíaco',
  marcador_tumoral: 'Marcadores tumorales',
  vitaminas_minerales: 'Vitaminas y minerales',
  otros: 'Otros',
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface Props {
  analitos: AnalitoCatalogo[]
  value: AnalitoCatalogo | null
  onChange: (analito: AnalitoCatalogo | null) => void
  onCustomClick: () => void
  disabled?: boolean
}

export default function AutocompleteAnalito({
  analitos,
  value,
  onChange,
  onCustomClick,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) setQuery(value.nombre)
    else setQuery('')
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const resultadosPlanos = useMemo(() => {
    const q = normalizar(query)
    const base = value && query === value.nombre ? analitos : analitos.filter(a => {
      if (!q) return true
      if (normalizar(a.nombre).includes(q)) return true
      return a.nombres_alternativos.some(alt => normalizar(alt).includes(q))
    })
    return base
  }, [analitos, query, value])

  const grupos = useMemo(() => {
    const map = new Map<CategoriaAnalito, AnalitoCatalogo[]>()
    for (const a of resultadosPlanos) {
      const arr = map.get(a.categoria) ?? []
      arr.push(a)
      map.set(a.categoria, arr)
    }
    return Array.from(map.entries())
  }, [resultadosPlanos])

  useEffect(() => {
    setHighlighted(0)
  }, [query, open])

  function seleccionar(a: AnalitoCatalogo) {
    onChange(a)
    setQuery(a.nombre)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, resultadosPlanos.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = resultadosPlanos[highlighted]
      if (pick) seleccionar(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  let flatIndex = 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            if (value && e.target.value !== value.nombre) onChange(null)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Buscar analito (ej. HbA1c, creatinina, peso)..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50 disabled:text-slate-500"
          style={{ transition: 'all 200ms', transitionTimingFunction: IOS_EASING }}
        />
      </div>

      {open && !disabled && (
        <div
          className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          style={{ transition: 'opacity 200ms', transitionTimingFunction: IOS_EASING }}
        >
          <div className="max-h-80 overflow-y-auto">
            {resultadosPlanos.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-slate-500">
                Sin resultados para <span className="font-medium">&ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              grupos.map(([categoria, items]) => (
                <div key={categoria}>
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    {CATEGORIA_LABEL[categoria]}
                  </div>
                  {items.map(a => {
                    const idx = flatIndex++
                    const isHigh = idx === highlighted
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); seleccionar(a) }}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left text-[13px] border-b border-slate-50 last:border-b-0 ${
                          isHigh ? 'bg-[var(--cp)]/10 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        style={{ transition: 'background 120ms' }}
                      >
                        <span className="truncate">{a.nombre}</span>
                        <span className="text-[11px] text-slate-400 ml-2 flex-shrink-0">
                          {a.unidad}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onCustomClick(); setOpen(false) }}
            className="w-full px-3 py-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--cp)] border-t border-slate-100 bg-slate-50/50 hover:bg-slate-100 transition-colors"
          >
            <PlusCircle size={13} />
            ¿No encuentras el analito? Crear como custom
          </button>
        </div>
      )}
    </div>
  )
}
