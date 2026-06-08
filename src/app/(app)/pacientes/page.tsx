'use client'

import { useEffect, useMemo, useState } from 'react'

import { Users, Plus, Search, ChevronRight } from 'lucide-react'
import { PatientRowSkeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularEdad } from '@/lib/patientUtils'
import type { Paciente } from '@/types'

/**
 * Límite unificado. 200 registros cubren el caseload
 * típico de un médico activo. La búsqueda por nombre cubre el resto
 * de pacientes si alguien tiene más de 200.
 */
const PACIENTES_LIMIT = 200

/** Debounce ms para la búsqueda reactiva */
const SEARCH_DEBOUNCE_MS = 300

export default function PacientesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [data, setData] = useState<Paciente[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Debounce del input → término que efectivamente dispara fetch
  useEffect(() => {
    const id = setTimeout(() => setBusquedaDebounced(busqueda.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [busqueda])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const supabase = createClient()
    let query = supabase
      .from('pacientes')
      .select('*')
      .neq('activo', false)

    if (busquedaDebounced.length >= 2) {
      const busquedaDebouncedNorm = busquedaDebounced.trim().replace(/\s+/g, ' ')
      query = query.or(
        `nombre.ilike.%${busquedaDebouncedNorm}%,apellidos.ilike.%${busquedaDebouncedNorm}%,numero_expediente.ilike.%${busquedaDebouncedNorm}%`,
      )
    }

    query
      .order('created_at', { ascending: false })
      .limit(PACIENTES_LIMIT)
      .then((res: { data: Paciente[] | null; error: unknown }) => {
        if (cancelled) return
        if (res.error) { console.error(res.error); return }
        setData((res.data ?? []) as Paciente[])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [busquedaDebounced])

  /**
   * Orden unificado client-side: created_at DESC (más recientes primero).
   * Costo despreciable para 200 registros.
   */
  const pacientes = useMemo(() => {
    return [...data].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
  }, [data])

  const mostrarNotaLimite = pacientes.length >= PACIENTES_LIMIT
  const hayBusqueda = busquedaDebounced.length > 0

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
              <Users size={24} /> Pacientes
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {pacientes.length} pacientes{hayBusqueda ? ' encontrados' : ' registrados'}
          </p>
        </div>
        <Link
          href="/pacientes/nuevo"
          data-onboard="nuevo-paciente"
          className="flex items-center gap-2 bg-[#1e5fa8] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors shadow-sm flex-shrink-0"
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
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => <PatientRowSkeleton key={i} />)}
          </div>
        ) : pacientes.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {hayBusqueda
                ? 'No se encontraron pacientes'
                : 'No hay pacientes registrados'}
            </p>
            {!hayBusqueda && (
              <Link
                href="/pacientes/nuevo"
                className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline"
              >
                Registrar primer paciente →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pacientes.map(p => {
              const edad = p.fecha_nacimiento
                ? calcularEdad(p.fecha_nacimiento)
                : null
              const apellidosTxt = p.apellidos ?? ''
              return (
                <Link
                  key={p.id}
                  href={`/pacientes/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#e8f4fd] flex items-center justify-center text-[#1e5fa8] font-semibold text-sm">
                      {p.nombre.charAt(0)}{apellidosTxt.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">
                        {p.nombre} {apellidosTxt}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {edad !== null && `${edad.textoElegante} · `}
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

      {/* Nota de límite cuando hay >=200 registros */}
      {mostrarNotaLimite && (
        <p className="text-center text-xs text-slate-400 mt-4">
          Mostrando los {PACIENTES_LIMIT} pacientes más recientes
        </p>
      )}
    </div>
  )
}
