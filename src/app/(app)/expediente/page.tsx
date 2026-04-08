'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, ChevronRight, FileText, Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'

const PAGE_SIZE = 20

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

function PacienteSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-3 w-36 bg-slate-100 rounded-full" />
          <div className="h-2.5 w-24 bg-slate-100 rounded-full" />
        </div>
      </div>
      <div className="h-5 w-16 bg-slate-100 rounded-full" />
    </div>
  )
}

export default function ExpedientePage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function cargar(busq: string, pag: number, acumular: boolean) {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('pacientes')
      .select('*', { count: 'exact' })
      .neq('activo', false)
      .order('apellidos')
      .range(pag * PAGE_SIZE, pag * PAGE_SIZE + PAGE_SIZE)

    if (busq.trim()) {
      query = query.or(`nombre.ilike.%${busq}%,apellidos.ilike.%${busq}%`)
    }

    const { data, count } = await query
    const resultado = data || []
    const hayMasResultados = resultado.length > PAGE_SIZE
    if (hayMasResultados) resultado.pop()

    if (!busq.trim() && pag === 0) setTotal(count ?? null)
    setHayMas(hayMasResultados)
    setPacientes(prev => acumular ? [...prev, ...resultado] : resultado)
    setLoading(false)
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPagina(0)
      cargar(busqueda, 0, false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function cargarMas() {
    const siguiente = pagina + 1
    setPagina(siguiente)
    cargar(busqueda, siguiente, true)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Clínica</p>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Expediente Clínico</h1>
          {total !== null && (
            <p className="text-sm text-[#86868b] mt-0.5">
              {total} paciente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/pacientes/nuevo"
          data-onboard="nuevo-paciente-exp"
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} /> Nuevo paciente
        </Link>
      </div>

      {/* Buscador macOS */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {loading && pacientes.length === 0 ? (
          <div className="divide-y divide-slate-100">
            {[1,2,3,4,5].map(i => <PacienteSkeleton key={i} />)}
          </div>
        ) : pacientes.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Stethoscope size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-[#3d3d3f]">No se encontraron pacientes</p>
            <p className="text-xs text-[#86868b] mt-1 mb-4">
              {busqueda ? 'Intenta con otro nombre' : 'Registra tu primer paciente'}
            </p>
            {!busqueda && (
              <Link href="/pacientes/nuevo" className="text-sm text-[#1e5fa8] font-medium hover:underline">
                + Nuevo paciente
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {pacientes.map((p, i) => {
                const edad = p.fecha_nacimiento ? differenceInYears(new Date(), parseISO(p.fecha_nacimiento)) : null
                const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/80 transition-colors group">
                    <Link href={`/expediente/${p.id}`} className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                        {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                          {p.nombre} {p.apellidos}
                        </p>
                        <p className="text-[11px] text-[#86868b] mt-0.5">
                          {edad !== null ? `${edad} años · ` : ''}
                          {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'}
                          {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <Link
                        href={`/expediente/${p.id}/nueva-nota`}
                        title="Nueva nota"
                        className="hidden sm:flex items-center gap-1 text-[11px] text-[#86868b] hover:text-[#1e5fa8] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <FileText size={12} /> Nueva nota
                      </Link>
                      <Link href={`/expediente/${p.id}`}>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-[#86868b] transition-colors" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
            {hayMas && (
              <div className="px-5 py-3.5 border-t border-slate-100 text-center">
                <button
                  onClick={cargarMas}
                  disabled={loading}
                  className="text-sm text-[#1e5fa8] hover:text-[#1a3a5c] font-medium disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Cargando...' : 'Cargar más pacientes'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
