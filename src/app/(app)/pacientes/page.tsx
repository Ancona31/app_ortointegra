'use client'

import { useState, useEffect, useCallback } from 'react'

import { Users, Plus, Search, ChevronRight, WifiOff } from 'lucide-react'
import { PatientRowSkeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { differenceInYears, parseISO } from 'date-fns'
import { searchPatientsOffline, type CachedPatient } from '@/lib/offlinePatients'
import { secureStorage } from '@/lib/secureStorage'
import { getStatus, subscribe } from '@/lib/connectionMonitor'

type PacienteRow = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  sexo: string | null
  numero_expediente: string | null
}

const CAMPOS = 'id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente'
const PATIENTS_CACHE_KEY = 'offline_patients_cache'

/** Convierte CachedPatient → PacienteRow para la UI */
function cachedToRow(p: CachedPatient): PacienteRow {
  return {
    id: p.id,
    nombre: p.nombre,
    apellidos: p.apellidos,
    fecha_nacimiento: p.fecha_nacimiento ?? null,
    sexo: p.sexo ?? null,
    numero_expediente: p.numero_expediente ?? null,
  }
}

export default function PacientesPage() {
  const PAGE = 20
  const [pacientes, setPacientes] = useState<PacienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [offline, setOffline] = useState(() => getStatus() === 'offline')

  // Monitor conexión para ajustar UI
  useEffect(() => {
    const unsub = subscribe((status) => setOffline(status === 'offline'))
    return unsub
  }, [])

  /** Lee pacientes del cache offline (secureStorage) y los pagina */
  const cargarDesdeCache = useCallback(async (reset = true): Promise<PacienteRow[]> => {
    try {
      const cached = await secureStorage.get<CachedPatient[]>(PATIENTS_CACHE_KEY)
      if (!Array.isArray(cached)) return []
      // Orden consistente con el fetch: por apellido para offline
      const ordenados = [...cached].sort((a, b) =>
        (a.apellidos ?? '').localeCompare(b.apellidos ?? '')
      )
      const rows = ordenados.map(cachedToRow)
      if (reset) {
        setHayMas(rows.length > PAGE)
        setPacientes(rows.slice(0, PAGE))
      }
      return rows
    } catch {
      return []
    }
  }, [])

  const cargarPacientes = useCallback(async (reset = true) => {
    if (reset) setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pacientes')
        .select(CAMPOS)
        .neq('activo', false)
        .order('created_at', { ascending: false })
        .limit(PAGE + 1)

      if (error) throw error
      const items = (data ?? []) as PacienteRow[]
      setHayMas(items.length > PAGE)
      setPacientes(items.slice(0, PAGE))
    } catch {
      // Fallback offline: leer del cache
      await cargarDesdeCache(true)
    } finally {
      setLoading(false)
    }
  }, [cargarDesdeCache])

  // Carga inicial
  useEffect(() => { cargarPacientes() }, [cargarPacientes])

  // Búsqueda server-side con debounce 300 ms + fallback offline
  useEffect(() => {
    if (busqueda.trim().length < 2) return
    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('pacientes')
          .select(CAMPOS)
          .neq('activo', false)
          .or(`nombre.ilike.%${busqueda}%,apellidos.ilike.%${busqueda}%,numero_expediente.ilike.%${busqueda}%`)
          .order('apellidos')
          .limit(PAGE + 1)

        if (error) throw error
        const items = (data ?? []) as PacienteRow[]
        setHayMas(items.length > PAGE)
        setPacientes(items.slice(0, PAGE))
      } catch {
        // Fallback offline: buscar en el cache local
        const cached = await searchPatientsOffline(busqueda)
        const rows = cached.map(cachedToRow)
        setHayMas(false)
        setPacientes(rows)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Al borrar la búsqueda, volver a la lista inicial
  useEffect(() => {
    if (busqueda.trim().length > 0) return
    cargarPacientes()
  }, [busqueda, cargarPacientes])

  async function cargarMasPacientes() {
    if (!pacientes.length) return
    // Offline: paginar desde el cache en memoria
    if (offline) {
      setCargandoMas(true)
      try {
        const all = await cargarDesdeCache(false)
        const start = pacientes.length
        const next = all.slice(start, start + PAGE)
        setPacientes(prev => [...prev, ...next])
        setHayMas(start + PAGE < all.length)
      } finally {
        setCargandoMas(false)
      }
      return
    }

    setCargandoMas(true)
    try {
      const cursor = pacientes[pacientes.length - 1].id
      const supabase = createClient()
      const { data: lastRow } = await supabase
        .from('pacientes')
        .select('created_at')
        .eq('id', cursor)
        .single() as { data: { created_at: string } | null }

      if (!lastRow) return

      let query = supabase.from('pacientes').select(CAMPOS)
        .neq('activo', false)
        .lt('created_at', lastRow.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE + 1)

      if (busqueda.trim().length >= 2) {
        query = query.or(`nombre.ilike.%${busqueda}%,apellidos.ilike.%${busqueda}%,numero_expediente.ilike.%${busqueda}%`)
      }

      const { data, error } = await query
      if (error) throw error
      const items = (data ?? []) as PacienteRow[]
      setHayMas(items.length > PAGE)
      setPacientes(prev => [...prev, ...items.slice(0, PAGE)])
    } catch {
      // Offline sobrevenido durante paginación — no añadir más, marcar fin
      setHayMas(false)
    } finally {
      setCargandoMas(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <Users size={24} /> Pacientes
          </h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            {pacientes.length} pacientes{busqueda.length >= 2 ? ' encontrados' : ' registrados'}
            {offline && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <WifiOff size={10} /> Desde cache local
              </span>
            )}
          </p>
        </div>
        <Link
          href="/pacientes/nuevo"
          data-onboard="nuevo-paciente"
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
        {hayMas && (
          <button onClick={cargarMasPacientes} disabled={cargandoMas}
            className="w-full py-3 text-sm text-[#1e5fa8] font-medium hover:bg-slate-50 transition-colors border-t border-slate-100 disabled:opacity-50">
            {cargandoMas ? 'Cargando...' : 'Cargar más pacientes'}
          </button>
        )}
      </div>
    </div>
  )
}
