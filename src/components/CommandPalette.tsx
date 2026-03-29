'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, ArrowRight, Loader2 } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'

type Paciente = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  numero_expediente?: string | null
  sexo?: string | null
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ctrl+K / Cmd+K para abrir
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus al abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Búsqueda con debounce
  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, fecha_nacimiento, numero_expediente, sexo')
      .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
      .order('apellidos')
      .limit(8)
    setResults(data || [])
    setLoading(false)
    setSelected(0)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, buscar])

  // Navegación con teclado
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navegar(results[selected].id)
  }

  function navegar(id: string) {
    setOpen(false)
    router.push(`/expediente/${id}`)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          {loading
            ? <Loader2 size={18} className="text-slate-400 animate-spin flex-shrink-0" />
            : <Search size={18} className="text-slate-400 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar paciente..."
            className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
            <X size={16} />
          </button>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map((p, i) => {
              const edad = p.fecha_nacimiento
                ? differenceInYears(new Date(), parseISO(p.fecha_nacimiento))
                : null
              return (
                <li key={p.id}>
                  <button
                    onClick={() => navegar(p.id)}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === selected ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs flex-shrink-0">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{p.nombre} {p.apellidos}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {edad !== null ? `${edad} años` : ''}
                        {edad !== null && p.sexo ? ' · ' : ''}
                        {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}
                        {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                      </p>
                    </div>
                    {i === selected && <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <User size={32} className="opacity-30" />
            <p className="text-sm">Sin resultados para "{query}"</p>
          </div>
        )}

        {!query && (
          <div className="px-4 py-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Escribe el nombre del paciente</span>
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Esc</span>
          </div>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-[10px] text-slate-400">
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> abrir</span>
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
