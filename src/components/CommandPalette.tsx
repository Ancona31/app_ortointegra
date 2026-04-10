'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, ArrowRight, Loader2, UserPlus, ChevronLeft } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'

type Paciente = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  numero_expediente?: string | null
  sexo?: string | null
}

/* Descompone el query en nombre/apellidos si tiene espacio */
function parsearNombre(q: string) {
  const partes = q.trim().split(/\s+/)
  if (partes.length === 1) return { nombre: partes[0], apellidos: '' }
  return { nombre: partes[0], apellidos: partes.slice(1).join(' ') }
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  /* Registro rápido */
  const [modoCrear, setModoCrear] = useState(false)
  const [formNombre, setFormNombre]     = useState('')
  const [formApellidos, setFormApellidos] = useState('')
  const [formFechaNac, setFormFechaNac] = useState('')
  const [formConsentimiento, setFormConsentimiento] = useState(false)
  const [creando, setCreando]       = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Ctrl+K / Cmd+K */
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

  /* Reset al abrir */
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setSelected(0)
      setModoCrear(false)
      setFormNombre(''); setFormApellidos(''); setFormFechaNac('')
      setFormConsentimiento(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  /* Búsqueda con debounce */
  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, fecha_nacimiento, numero_expediente, sexo')
      .neq('activo', false)
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

  /* Total de opciones navegables: resultados + opción "Crear" si aplica */
  const mostrarOpcionCrear = query.trim().length >= 2 && !loading && results.length < 8
  const totalOpciones = results.length + (mostrarOpcionCrear ? 1 : 0)

  function handleKey(e: React.KeyboardEvent) {
    if (modoCrear) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalOpciones - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selected]) { navegar(results[selected].id); return }
      if (mostrarOpcionCrear && selected === results.length) abrirCrear()
    }
  }

  function navegar(id: string) {
    setOpen(false)
    router.push(`/expediente/${id}`)
  }

  function abrirCrear() {
    const { nombre, apellidos } = parsearNombre(query)
    setFormNombre(nombre)
    setFormApellidos(apellidos)
    setModoCrear(true)
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!formNombre.trim()) return
    setCreando(true)
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          apellidos: formApellidos.trim(),
          sexo: null,
          fecha_nacimiento: formFechaNac || null,
          consentimiento_otorgado: formConsentimiento,
        }),
      })
      const data = await res.json()
      if (data.id) {
        setOpen(false)
        router.push(`/expediente/${data.id}`)
      }
    } finally {
      setCreando(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up"
        style={{ animationDuration: '0.2s' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── MODO BÚSQUEDA ───────────────────────────────── */}
        {!modoCrear && (
          <>
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
                placeholder="Buscar paciente por nombre..."
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Resultados */}
            {(results.length > 0 || mostrarOpcionCrear) && (
              <ul className="py-2 max-h-80 overflow-y-auto">
                {results.map((p, i) => {
                  const edad = p.fecha_nacimiento
                    ? differenceInYears(new Date(), parseISO(p.fecha_nacimiento))
                    : null
                  const activo = i === selected
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => navegar(p.id)}
                        onMouseEnter={() => setSelected(i)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activo ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs flex-shrink-0">
                          {p.nombre[0]}{p.apellidos[0]}
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
                        {activo && <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />}
                      </button>
                    </li>
                  )
                })}

                {/* Opción registro rápido */}
                {mostrarOpcionCrear && (
                  <li>
                    <button
                      onClick={abrirCrear}
                      onMouseEnter={() => setSelected(results.length)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-slate-100 ${
                        selected === results.length ? 'bg-emerald-50' : 'hover:bg-emerald-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus size={15} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-emerald-700 text-sm">
                          Crear registro para: <span className="font-bold">"{query}"</span>
                        </p>
                        <p className="text-xs text-emerald-600/70 mt-0.5">Registro rápido — solo nombre, teléfono y motivo</p>
                      </div>
                      {selected === results.length && <ArrowRight size={14} className="text-emerald-500 flex-shrink-0" />}
                    </button>
                  </li>
                )}
              </ul>
            )}

            {/* Sin resultados (sin mostrar la opción de crear, que ya está arriba) */}
            {query && !loading && results.length === 0 && !mostrarOpcionCrear && (
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

            <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-[10px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> abrir</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> cerrar</span>
            </div>
          </>
        )}

        {/* ── MODO REGISTRO RÁPIDO ────────────────────────── */}
        {modoCrear && (
          <form onSubmit={handleCrear}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setModoCrear(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Registro rápido</p>
                <p className="text-[11px] text-slate-400">Puedes completar el expediente después</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
                <X size={16} />
              </button>
            </div>

            {/* Campos */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Nombre <span className="text-red-400">*</span></label>
                  <input
                    autoFocus
                    type="text"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                    placeholder="Juan"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Apellidos</label>
                  <input
                    type="text"
                    value={formApellidos}
                    onChange={e => setFormApellidos(e.target.value)}
                    placeholder="García López"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Fecha de nacimiento <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={formFechaNac}
                  onChange={e => setFormFechaNac(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConsentimiento}
                  onChange={e => setFormConsentimiento(e.target.checked)}
                  className="mt-0.5 accent-[#1e5fa8]"
                />
                <span className="text-[11px] text-slate-500 leading-tight">
                  El paciente ha leído y acepta el{' '}
                  <a href="/privacidad" target="_blank" className="text-[#1e5fa8] underline">Aviso de Privacidad</a>
                  {' '}(LFPDPPP Art. 9) <span className="text-red-400">*</span>
                </span>
              </label>
            </div>

            {/* Botones */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModoCrear(false)}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creando || !formNombre.trim() || !formFechaNac || !formConsentimiento}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1e5fa8] rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creando ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {creando ? 'Creando...' : 'Crear e ir al expediente'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
