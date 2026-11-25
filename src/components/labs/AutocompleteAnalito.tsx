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
          className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta2 pointer-events-none"
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
          className="k-campo pl-9"
          style={{ transition: 'all 200ms', transitionTimingFunction: IOS_EASING }}
        />
      </div>

      {open && !disabled && (
        <div
          className="absolute z-10 left-0 right-0 top-full mt-1 overflow-hidden rounded-[12px] bg-sup shadow-[var(--sombra-capa)] ring-1 ring-linea"
          style={{ transition: 'opacity 200ms', transitionTimingFunction: IOS_EASING }}
        >
          <div className="max-h-80 overflow-y-auto">
            {resultadosPlanos.length === 0 ? (
              <div className="k-t-sec px-4 py-6 text-center">
                Sin resultados para <span className="font-medium">&ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              grupos.map(([categoria, items]) => (
                <div key={categoria}>
                  <div className="k-t-rotulo bg-sup2 px-3 py-1.5">
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
                        className={`flex min-h-[44px] w-full items-center justify-between border-b border-linea px-3 py-2 text-left text-[15px] last:border-b-0 ih:min-h-[36px] esc:min-h-[36px] ${
                          isHigh ? 'bg-tonal text-tonal-tinta' : 'text-tinta hover:bg-sup2'
                        }`}
                        style={{ transition: 'background 120ms' }}
                      >
                        <span className="truncate">{a.nombre}</span>
                        <span className="ml-2 flex-shrink-0 text-[13px] text-tinta2">
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
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-linea px-3 py-2 text-[14px] font-semibold text-enlace hover:bg-sup2 ih:min-h-[36px] esc:min-h-[36px]"
          >
            <PlusCircle size={13} />
            ¿No encuentras el analito? Crear como custom
          </button>
        </div>
      )}
    </div>
  )
}
