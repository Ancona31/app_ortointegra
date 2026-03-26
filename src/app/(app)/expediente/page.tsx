'use client'

import { useState, useEffect } from 'react'
import { Stethoscope, Plus, Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'

export default function ExpedientePage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data } = await supabase.from('pacientes').select('*').order('apellidos')
      setPacientes(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = pacientes.filter(p =>
    `${p.nombre} ${p.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <Stethoscope size={24} /> Expediente Clínico
          </h1>
          <p className="text-slate-500 text-sm mt-1">Selecciona un paciente para ver o crear consultas</p>
        </div>
        <Link href="/pacientes/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors">
          <Plus size={16} /> Nuevo paciente
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar paciente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Stethoscope size={40} className="mx-auto mb-3 opacity-30" />
            <p>No se encontraron pacientes</p>
            <Link href="/pacientes/nuevo" className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">Nuevo paciente →</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtrados.map(p => {
              const edad = p.fecha_nacimiento ? differenceInYears(new Date(), parseISO(p.fecha_nacimiento)) : null
              return (
                <Link key={p.id} href={`/expediente/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-sm">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">{p.nombre} {p.apellidos}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{edad !== null && `${edad} años · `}{p.sexo === 'M' ? 'Masculino' : 'Femenino'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#1e5fa8] bg-blue-50 px-2 py-1 rounded-full">Ver expediente</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#1e5fa8]" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
