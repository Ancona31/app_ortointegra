'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Search, ChevronRight } from 'lucide-react'
import { PatientRowSkeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { differenceInYears, parseISO } from 'date-fns'

type PacienteRow = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  sexo: string | null
  numero_expediente: string | null
}

const CAMPOS = 'id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<PacienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  // Carga inicial: 150 más recientes
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pacientes')
      .select(CAMPOS)
      .order('created_at', { ascending: false })
      .limit(150)
      .then(({ data }: { data: any[] | null }) => {
        setPacientes(data ?? [])
        setLoading(false)
      })
  }, [])

  // Búsqueda server-side con debounce 300 ms
  useEffect(() => {
    if (busqueda.trim().length < 2) return
    setLoading(true)
    const timeout = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select(CAMPOS)
        .or(`nombre.ilike.%${busqueda}%,apellidos.ilike.%${busqueda}%,numero_expediente.ilike.%${busqueda}%`)
        .order('apellidos')
        .limit(100)
      setPacientes(data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Al borrar la búsqueda, volver a la lista inicial
  useEffect(() => {
    if (busqueda.trim().length > 0) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('pacientes')
      .select(CAMPOS)
      .order('created_at', { ascending: false })
      .limit(150)
      .then(({ data }: { data: any[] | null }) => {
        setPacientes(data ?? [])
        setLoading(false)
      })
  }, [busqueda])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <Users size={24} /> Pacientes
          </h1>
          <p className="text-slate-500 text-sm mt-1">{pacientes.length} pacientes{busqueda.length >= 2 ? ' encontrados' : ' registrados'}</p>
        </div>
        <Link
          href="/pacientes/nuevo"
          className="flex items-center gap-2 bg-[#1e5fa8] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors shadow-sm"
        >
          <Plus size={16} /> Nuevo Paciente
        </Link>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o número de expediente..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => <PatientRowSkeleton key={i} />)}
          </div>
        ) : pacientes.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {busqueda ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
            </p>
            {!busqueda && (
              <Link href="/pacientes/nuevo" className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
                Registrar primer paciente →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pacientes.map(p => {
              const edad = p.fecha_nacimiento
                ? differenceInYears(new Date(), parseISO(p.fecha_nacimiento))
                : null
              return (
                <Link
                  key={p.id}
                  href={`/pacientes/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#e8f4fd] flex items-center justify-center text-[#1e5fa8] font-semibold text-sm">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">
                        {p.nombre} {p.apellidos}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {edad !== null && `${edad} años · `}
                        {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'}
                        {p.numero_expediente && ` · Exp. ${p.numero_expediente}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-[#1e5fa8]" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
