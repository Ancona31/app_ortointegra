'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { FileText, Stethoscope, Monitor, Search, ArrowRight, UserPlus, Pill, ClipboardList, CalendarDays, FolderOpen, User } from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { formatCitaHora } from './utils'
import { StatusChip } from './StatusChip'

/* ─── Helpers ─────────────────────────────────────────────── */

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/* ─── Tipos ───────────────────────────────────────────────── */

type Reciente = {
  paciente_id: string
  nombre: string
  apellidos: string
  created_at: string
  motivo_consulta: string
}

type ProximaCita = {
  id: string
  title: string
  start_time: string
  status: string
  paciente_id: string | null
  pacientes: { nombre: string; apellidos: string } | null
  medico: { id: string; nombre: string; titulo: string } | null
}

/* ─── Config ──────────────────────────────────────────────── */

const ACCESOS = [
  {
    href: '/expediente',
    icon: Stethoscope,
    label: 'Expediente',
    desc: 'Historial clínico',
    gradient: 'from-violet-500 to-violet-600',
    ring: 'group-hover:ring-violet-200',
  },
  {
    href: '/agenda',
    icon: CalendarDays,
    label: 'Agenda',
    desc: 'Citas y horarios',
    gradient: 'from-blue-500 to-blue-600',
    ring: 'group-hover:ring-blue-200',
  },
  {
    href: '/documentos',
    icon: FileText,
    label: 'Documentos',
    desc: 'Recetas y solicitudes',
    gradient: 'from-amber-500 to-amber-600',
    ring: 'group-hover:ring-amber-200',
  },
  {
    href: '/dicom',
    icon: Monitor,
    label: 'DICOM',
    desc: 'Visor de imagen médica',
    gradient: 'from-teal-500 to-teal-600',
    ring: 'group-hover:ring-teal-200',
  },
]

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
]

/* ─── Componente ──────────────────────────────────────────── */

export default function DashboardPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [recientes,      setRecientes]      = useState<Reciente[]>([])
  const [totalPacientes, setTotalPacientes] = useState<number | null>(null)
  const [proximasCitas,  setProximasCitas]  = useState<ProximaCita[]>([])
  const [clinicaTipo,    setClinicaTipo]    = useState<string>('independiente')
  const [soloMisCitas,   setSoloMisCitas]   = useState(false)
  const [loadingCitas,   setLoadingCitas]   = useState(true)

  useEffect(() => {
    if (loadingProfile || profile?.role === 'secretaria') return

    const supabase = createClient()

    // Total de expedientes — fetch remoto con fallback al mirror
    supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .neq('activo', false)
      .then(({ count }: { count: number | null }) => setTotalPacientes(count ?? 0))
      .catch(() => {
        // silent — el fallback al mirror abajo resuelve el contador
      })



    // Pacientes recientes — catch silencioso
    supabase
      .from('consultas')
      .select('paciente_id, created_at, motivo_consulta, pacientes!inner(nombre, apellidos, activo)')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }: { data: { paciente_id: string; created_at: string; motivo_consulta: string | null; pacientes: { nombre: string; apellidos: string; activo?: boolean } | { nombre: string; apellidos: string; activo?: boolean }[] }[] | null }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: Reciente[] = []
        for (const c of data) {
          // Filtrar pacientes con soft delete
          const pac = (Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes) as { nombre: string; apellidos: string; activo?: boolean } | null
          if (pac?.activo === false) continue

          if (!seen.has(c.paciente_id) && unique.length < 5) {
            seen.add(c.paciente_id)
            unique.push({
              paciente_id: c.paciente_id,
              nombre: pac?.nombre ?? '',
              apellidos: pac?.apellidos ?? '',
              created_at: c.created_at,
              motivo_consulta: c.motivo_consulta ?? '',
            })
          }
        }
        setRecientes(unique)
      })
      .catch(() => {
        // silent — si el fetch falla, recientes queda vacío y no se renderiza
      })

    // Próximas citas + clinica.tipo — wrap completo en try/catch/finally
    // para garantizar que loadingCitas siempre termine en false.
    async function fetchCitas() {
      try {
        if (!profile?.clinica_id) return

        const { data: clinicaData } = await supabase
          .from('clinicas')
          .select('tipo')
          .eq('id', profile.clinica_id)
          .single()

        const tipo = clinicaData?.tipo ?? 'independiente'
        setClinicaTipo(tipo)

        const isClinicaAdmin = profile!.role === 'admin' && tipo === 'clinica'

        let q = supabase
          .from('appointments')
          .select('id, title, start_time, status, paciente_id, pacientes(nombre, apellidos), medico:profiles!appointments_medico_id_fkey(id, nombre, titulo)')
          .eq('clinica_id', profile!.clinica_id!)
          .gt('start_time', new Date().toISOString())
          .in('status', ['scheduled', 'confirmed'])
          .order('start_time', { ascending: true })
          .limit(isClinicaAdmin ? 8 : 1) as any

        if (!isClinicaAdmin) {
          q = q.eq('medico_id', profile!.id)
        }

        const { data } = await q
        setProximasCitas((data as ProximaCita[]) ?? [])
      } catch {
        // Red caída o query fallida → citas vacío, el resto del dashboard renderiza
        setProximasCitas([])
      } finally {
        // SIEMPRE apagar el skeleton de carga, sin importar el path
        setLoadingCitas(false)
      }
    }

    void fetchCitas()
  }, [profile, loadingProfile])

  if (loadingProfile) return <DashboardSkeleton />
  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  const nombre = profile?.nombre ?? ''
  const titulo = profile?.titulo ? `${profile.titulo} ` : ''
  const hoy    = format(new Date(), "EEEE, d 'de' MMMM", { locale: es })

  const abrirBusqueda = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

  const isClinicaAdmin = profile?.role === 'admin' && clinicaTipo === 'clinica'
  const displayCitas   = soloMisCitas
    ? proximasCitas.filter(c => c.medico?.id === profile?.id)
    : proximasCitas
  const proximaCita    = proximasCitas[0] ?? null

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">

      {/* ── Saludo ───────────────────────────────────────────── */}
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <p className="text-sm text-[#86868b] capitalize mb-1">{hoy}</p>
        <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] leading-tight">
          {saludo()}{nombre ? `, ${titulo}${nombre}` : ''}
        </h1>
      </div>

      {/* ── Dos CTAs principales ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>

        {/* ── Tarjeta izquierda: Próxima(s) cita(s) — 3 columnas ── */}
        {isClinicaAdmin ? (
          /* Lista para admin de clínica */
          <div className="sm:col-span-1 bg-white border border-[#1e5fa8]/20 rounded-2xl shadow-sm shadow-[#1e5fa8]/5 ring-1 ring-[#1e5fa8]/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} className="text-white/70" />
                <p className="text-[11px] font-semibold text-white uppercase tracking-widest">Próximas citas</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={soloMisCitas}
                    onChange={e => setSoloMisCitas(e.target.checked)}
                    className="rounded border-white/30 bg-white/10 text-white focus:ring-white/30"
                  />
                  Solo mías
                </label>
                <Link href="/agenda" className="text-[10px] text-white/70 hover:text-white hover:underline">Ver agenda →</Link>
              </div>
            </div>
            {loadingCitas ? (
              <div className="px-5 py-4 space-y-3">
                {[1,2].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : displayCitas.length > 0 ? (
              displayCitas.slice(0, 4).map(cita => (
                <div key={cita.id} className="flex gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={17} className="text-[#1e5fa8]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1d1d1f]">
                        {cita.pacientes?.nombre} {cita.pacientes?.apellidos}
                      </p>
                      <StatusChip status={cita.status} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#86868b]">
                      <span>{formatCitaHora(cita.start_time)}</span>
                      {!soloMisCitas && cita.medico && (
                        <span>· {cita.medico.titulo} {cita.medico.nombre}</span>
                      )}
                    </div>
                    {cita.paciente_id && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Link href={`/expediente/${cita.paciente_id}/nueva-nota`}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] transition-colors">
                          <Stethoscope size={10} /> Iniciar consulta
                        </Link>
                        <Link href={`/expediente/${cita.paciente_id}`}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#1e5fa8] bg-blue-50 hover:bg-blue-100 transition-colors">
                          <FolderOpen size={10} /> Expediente
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#86868b] px-5 py-6 text-center">No hay citas agendadas</p>
            )}
          </div>
        ) : (
          /* Tarjeta simple para médico o admin independiente */
          <div className="sm:col-span-1 bg-white border border-[#1e5fa8]/20 rounded-2xl shadow-sm shadow-[#1e5fa8]/5 ring-1 ring-[#1e5fa8]/10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} className="text-white/70" />
                <p className="text-[11px] font-semibold text-white uppercase tracking-widest">Próxima cita</p>
              </div>
              <Link href="/agenda" className="text-[10px] text-white/70 hover:text-white hover:underline">Ver agenda →</Link>
            </div>
            <div className="px-5 py-4 sm:px-6 flex-1 flex flex-col gap-3">
            {loadingCitas ? (
              <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ) : proximaCita ? (
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <User size={22} className="text-[#1e5fa8]" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="font-semibold text-[17px] text-[#1d1d1f] leading-snug">
                      {proximaCita.pacientes?.nombre} {proximaCita.pacientes?.apellidos}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#86868b]">{formatCitaHora(proximaCita.start_time)}</p>
                      <StatusChip status={proximaCita.status} />
                    </div>
                  </div>
                  {proximaCita.paciente_id && (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/expediente/${proximaCita.paciente_id}/nueva-nota`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] transition-colors"
                      >
                        <Stethoscope size={11} /> Iniciar consulta
                      </Link>
                      <Link
                        href={`/expediente/${proximaCita.paciente_id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#1e5fa8] bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <FolderOpen size={11} /> Ver expediente
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#86868b]">No hay citas agendadas</p>
            )}
            </div>
          </div>
        )}

        {/* ── Tarjeta derecha: Buscar / Nuevo paciente — 2 columnas ── */}
        <div className="sm:col-span-1 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] text-white shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] transition-all duration-200 flex flex-col">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          {/* Buscar */}
          <button
            onClick={abrirBusqueda}
            className="relative flex-1 w-full flex items-center gap-3 px-5 py-4 border-b border-white/10 hover:bg-white/15 active:bg-white/20 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Search size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px] leading-tight">Buscar paciente</p>
              <p className="text-white/60 text-[11px] mt-0.5">Iniciar consulta</p>
            </div>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-white/10 border border-white/20 px-2 py-0.5 rounded-md text-white/70 flex-shrink-0">
              Ctrl K
            </kbd>
          </button>
          {/* Nuevo */}
          <Link
            href="/pacientes/nuevo"
            data-onboard="nuevo-paciente"
            className="relative flex-1 flex items-center gap-3 px-5 py-4 hover:bg-white/15 active:bg-white/20 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <UserPlus size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px] leading-tight">Nuevo paciente</p>
              <p className="text-white/60 text-[11px] mt-0.5">Crear expediente</p>
            </div>
          </Link>
        </div>

      </div>

      {/* ── Módulos ───────────────────────────────────────────── */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Módulos</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACCESOS.map(({ href, icon: Icon, label, desc, gradient, ring }) => (
            <Link
              key={href}
              href={href}
              className={`group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                hover:shadow-[0_4px_20px_rgba(30,95,168,0.15)] hover:border-[#1e5fa8]/20 hover:-translate-y-1
                active:scale-[0.97]
                transition-all duration-200
                ring-2 ring-transparent ${ring}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                  <Icon size={17} className="text-white" />
                </div>
                {href === '/expediente' && totalPacientes !== null && (
                  <span className="text-[11px] font-bold tabular-nums text-[#1e5fa8] bg-blue-50 px-2 py-0.5 rounded-full">
                    {totalPacientes}
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm text-[#1d1d1f]">{label}</p>
              <p className="text-[11px] text-[#86868b] mt-0.5 leading-tight">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Pacientes recientes ───────────────────────────────── */}
      {recientes.length > 0 && (
        <div className="animate-slide-up pb-6" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Recientes</p>
            <Link href="/expediente" className="text-[11px] text-[#1e5fa8] hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {recientes.map((p, i) => {
              const initials = `${p.nombre[0] ?? ''}${p.apellidos[0] ?? ''}`.toUpperCase()
              return (
                <div
                  key={p.paciente_id}
                  className={`flex items-center gap-3 px-4 py-3 group hover:bg-blue-50/50 transition-colors ${i < recientes.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  <Link
                    href={`/expediente/${p.paciente_id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                        {p.nombre} {p.apellidos}
                      </p>
                      <p className="text-[11px] text-[#86868b] truncate">
                        Última atención: {formatDistanceToNow(parseISO(p.created_at), { locale: es, addSuffix: true })}
                        {p.motivo_consulta && ` · ${p.motivo_consulta}`}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 flex-shrink-0 flex items-center gap-1">
                    <Link
                      href={`/expediente/${p.paciente_id}/documentos?tipo=receta`}
                      title="Receta express"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                    >
                      <Pill size={12} />
                      Receta
                    </Link>
                    <Link
                      href={`/expediente/${p.paciente_id}?tab=consultas`}
                      title="Última nota"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors"
                    >
                      <ClipboardList size={12} />
                      Nota
                    </Link>
                    <Link
                      href={`/expediente/${p.paciente_id}`}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
