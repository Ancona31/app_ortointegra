'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'
import type { CategoriaAnalito } from '@/types'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

const CATEGORIA_LABEL: Record<string, string> = {
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

function labelCategoria(c: CategoriaAnalito | string): string {
  return CATEGORIA_LABEL[c] ?? String(c)
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function formatValor(v: number, unidad: string): string {
  const hasDecimal = !Number.isInteger(v)
  return `${hasDecimal ? v.toFixed(2) : v} ${unidad}`.trim()
}

interface Props {
  analitos: AnalitoRastreado[]
  value: AnalitoRastreado | null
  onChange: (a: AnalitoRastreado) => void
}

export default function DropdownSelectorAnalito({ analitos, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  const filtrados = useMemo(() => {
    const q = normalizar(query)
    if (!q) return analitos
    return analitos.filter(a => normalizar(a.nombre).includes(q))
  }, [analitos, query])

  const grupos = useMemo(() => {
    const map = new Map<string, AnalitoRastreado[]>()
    for (const a of filtrados) {
      const cat = String(a.categoria)
      const arr = map.get(cat) ?? []
      arr.push(a)
      map.set(cat, arr)
    }
    return Array.from(map.entries())
  }, [filtrados])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  function seleccionar(a: AnalitoRastreado) {
    onChange(a)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtrados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = filtrados[highlighted]
      if (pick) seleccionar(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  let flatIndex = 0

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] text-left hover:border-slate-300 hover:shadow-sm active:scale-[0.99] transition-all"
        style={{ transitionTimingFunction: IOS_EASING, transitionDuration: '200ms' }}
      >
        {value ? (
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium text-slate-900 truncate">{value.nombre}</span>
            <span className="text-[11px] text-slate-400 flex-shrink-0">
              {labelCategoria(value.categoria)}
            </span>
          </span>
        ) : (
          <span className="text-slate-400">Selecciona un analito</span>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-400 flex-shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ transitionTimingFunction: IOS_EASING }}
        />
      </button>

      {open && (
        <div
          className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          style={{ transition: 'opacity 200ms', transitionTimingFunction: IOS_EASING }}
        >
          <div className="relative border-b border-slate-100">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar analito…"
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-transparent focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-slate-500">
                Sin resultados para <span className="font-medium">&ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              grupos.map(([categoria, items]) => (
                <div key={categoria}>
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    {labelCategoria(categoria)}
                  </div>
                  {items.map(a => {
                    const idx = flatIndex++
                    const isHigh = idx === highlighted
                    const isSelected = value?.clave === a.clave
                    return (
                      <button
                        key={a.clave}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); seleccionar(a) }}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left text-[13px] border-b border-slate-50 last:border-b-0 ${
                          isHigh ? 'bg-[var(--cp)]/10 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        style={{ transition: 'background 120ms' }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`truncate ${isSelected ? 'font-medium' : ''}`}>
                            {a.nombre}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400 ml-2 flex-shrink-0">
                          {formatValor(a.ultimoValor, a.unidad)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
