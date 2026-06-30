'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, ChevronRight, FileText, Stethoscope, ArrowUp, ArrowDown } from 'lucide-react'
import Link from 'next/link'
import { calcularEdad } from '@/lib/patientUtils'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { fetchPacientesExpediente, type PacienteExpediente, type OrdenColumna, type OrdenDireccion } from '@/lib/expediente/fetchPacientes'
import { ListaChipsMedicos } from '@/components/expediente/ChipMedico'
import { TablaPacientesExpediente } from '@/components/expediente/TablaPacientesExpediente'
import { useProfile } from '@/hooks/useProfile'
import { isMedicoInvitado } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

type MedicoOpcion = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null }

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
  const [pacientes, setPacientes] = useState<PacienteExpediente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<OrdenColumna>('created_at')
  const [direccion, setDireccion] = useState<OrdenDireccion>('desc')
  const [medicoId, setMedicoId] = useState<string>('')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [medicos, setMedicos] = useState<MedicoOpcion[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const { profile } = useProfile()

  // Fase 8.2: handler reutilizable para intercept de creación
  function interceptIfBlocked(e: React.MouseEvent) {
    if (subState.isBlocked) {
      e.preventDefault()
      openBloqueoModal()
    }
  }

  async function cargar(
    busq: string,
    pag: number,
    acumular: boolean,
    ordenArg: OrdenColumna = orden,
    dirArg: OrdenDireccion = direccion,
    medicoArg: string = medicoId,
    desdeArg: string = fechaDesde,
    hastaArg: string = fechaHasta,
  ) {
    setLoading(true)
    setError(null)

    try {
      const resp = await fetchPacientesExpediente({
        q: busq, pag, orden: ordenArg, direccion: dirArg,
        medicoId: medicoArg || null,
        fechaDesde: desdeArg || null,
        fechaHasta: hastaArg || null,
      })

      // El route solo devuelve total en la carga inicial sin búsqueda; en el
      // resto de cargas total=null y se conserva el contador previo.
      if (resp.total !== null) setTotal(resp.total)
      setHayMas(resp.hayMas)
      setPacientes(prev => acumular ? [...prev, ...resp.pacientes] : resp.pacientes)
    } catch (e) {
      // No borramos los pacientes ya mostrados (caso "Cargar más"); solo
      // registramos el error para que el render decida cómo mostrarlo.
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de pacientes')
    } finally {
      setLoading(false)
    }
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
    cargar(busqueda, siguiente, true, orden, direccion, medicoId, fechaDesde, fechaHasta)
  }

  // Clic en columna (header o dropdown): misma columna alterna dirección; otra
  // columna salta a 'asc'. Resetea a pág 0 y recarga con los valores nuevos
  // EXPLÍCITOS (anti-stale-closure: setState es async, no se confía en el estado).
  function cambiarOrden(col: OrdenColumna) {
    const nuevaDir: OrdenDireccion = col === orden ? (direccion === 'asc' ? 'desc' : 'asc') : 'asc'
    setOrden(col)
    setDireccion(nuevaDir)
    setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, col, nuevaDir, medicoId, fechaDesde, fechaHasta)
  }

  // Botón de dirección: alterna asc/desc sobre la columna vigente.
  function cambiarDireccion() {
    const nuevaDir: OrdenDireccion = direccion === 'asc' ? 'desc' : 'asc'
    setDireccion(nuevaDir)
    setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, nuevaDir, medicoId, fechaDesde, fechaHasta)
  }

  // Filtros (aplicación instantánea): cada cambio resetea a pág 0, limpia el
  // debounce pendiente y recarga pasando el valor nuevo EXPLÍCITO (anti-stale).
  function cambiarMedico(id: string) {
    setMedicoId(id); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, id, fechaDesde, fechaHasta)
  }
  function cambiarFechaDesde(v: string) {
    setFechaDesde(v); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, medicoId, v, fechaHasta)
  }
  function cambiarFechaHasta(v: string) {
    setFechaHasta(v); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, medicoId, fechaDesde, v)
  }

  // Carga la lista de médicos para el dropdown, recortada por rol: el médico
  // invitado solo se ve a sí mismo (UX, no seguridad — la RLS ya limita).
  useEffect(() => {
    let cancelado = false
    async function cargarMedicos() {
      try {
        const r = await fetch('/api/clinica/medicos')
        if (!r.ok) return
        const { medicos: lista } = await r.json() as { medicos: MedicoOpcion[] }
        if (cancelado) return
        if (isMedicoInvitado(profile) && profile?.id) {
          const soloEl = (lista || []).filter(m => m.id === profile.id)
          setMedicos(soloEl)
          setMedicoId(profile.id)
          cargar(busqueda, 0, false, orden, direccion, profile.id, fechaDesde, fechaHasta)
        } else {
          setMedicos(lista || [])
        }
      } catch {
        // dropdown queda vacío (solo "Todos"); no rompe la página.
      }
    }
    cargarMedicos()
    return () => { cancelado = true }
  }, [profile])

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-slide-up">

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
          onClick={interceptIfBlocked}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} /> Nuevo paciente
        </Link>
      </div>

      {/* Barra: buscador (siempre visible) + filtros avanzados (solo desktop) */}
      <div className="flex flex-col md:flex-row md:items-end gap-2">
        {/* Buscador — siempre visible (móvil y desktop) */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="text"
            placeholder="Buscar por nombre o apellido..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
          />
        </div>

        {/* Filtros avanzados — solo desktop (md+). En móvil se ocultan para no
            desbordar; se expondrán en sub-fase 5. */}
        <div className="hidden md:flex md:items-end gap-2">
          <div>
            <label className="block text-[11px] text-[#86868b] mb-1">Médico</label>
            <select
              value={medicoId}
              onChange={e => cambiarMedico(e.target.value)}
              className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
            >
              {!isMedicoInvitado(profile) && <option value="">Todos los médicos</option>}
              {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#86868b] mb-1">Ingreso desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => cambiarFechaDesde(e.target.value)}
              className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#86868b] mb-1">hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => cambiarFechaHasta(e.target.value)}
              className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#86868b] mb-1">Ordenar por</label>
            <select
              value={orden}
              onChange={e => cambiarOrden(e.target.value as OrdenColumna)}
              className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
            >
              <option value="apellidos">Apellido</option>
              <option value="nombre">Nombre</option>
              <option value="numero_expediente">Expediente</option>
              <option value="fecha_nacimiento">F. nacimiento</option>
              <option value="created_at">F. ingreso</option>
              <option value="medico">Médico</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#86868b] mb-1">&nbsp;</label>
            <button
              type="button"
              onClick={cambiarDireccion}
              aria-label={direccion === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
              title={direccion === 'asc' ? 'Ascendente' : 'Descendente'}
              className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-[#86868b] hover:text-[#1e5fa8] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
            >
              {direccion === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {loading && pacientes.length === 0 ? (
          <div className="divide-y divide-slate-100">
            {[1,2,3,4,5].map(i => <PacienteSkeleton key={i} />)}
          </div>
        ) : error && pacientes.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <Stethoscope size={24} className="text-rose-300" />
            </div>
            <p className="text-sm font-medium text-[#3d3d3f]">No se pudo cargar la lista</p>
            <p className="text-xs text-[#86868b] mt-1 mb-4">{error}</p>
            <button
              onClick={() => cargar(busqueda, pagina, false)}
              className="text-sm text-[#1e5fa8] font-medium hover:underline"
            >
              Reintentar
            </button>
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
              <Link href="/pacientes/nuevo" onClick={interceptIfBlocked} className="text-sm text-[#1e5fa8] font-medium hover:underline">
                + Nuevo paciente
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <TablaPacientesExpediente pacientes={pacientes} orden={orden} direccion={direccion} onOrden={cambiarOrden} />
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {pacientes.map((p, i) => {
                const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
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
                          {edad !== null ? `${edad.textoElegante} · ` : ''}
                          {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'}
                          {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                        </p>
                        <div className="mt-1">
                          <ListaChipsMedicos medicos={p.medicos} />
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <Link
                        href={`/expediente/${p.id}/nueva-nota`}
                        title="Nueva nota"
                        onClick={interceptIfBlocked}
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
            {error && pacientes.length > 0 && (
              <div className="px-5 pb-3.5 text-center">
                <p className="text-xs text-rose-600">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
