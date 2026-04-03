'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import { FileText, Stethoscope, Monitor, Search, ArrowRight, UserPlus, Pill, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

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
  const [recientes, setRecientes] = useState<Reciente[]>([])
  const [totalPacientes, setTotalPacientes] = useState<number | null>(null)

  useEffect(() => {
    if (loadingProfile || profile?.role === 'secretaria') return

    const supabase = createClient()

    // Total de expedientes
    supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setTotalPacientes(count ?? 0))

    supabase
      .from('consultas')
      .select('paciente_id, created_at, motivo_consulta, pacientes!inner(nombre, apellidos)')
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: Reciente[] = []
        for (const c of data) {
          if (!seen.has(c.paciente_id) && unique.length < 5) {
            seen.add(c.paciente_id)
            const pac = (Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes) as { nombre: string; apellidos: string } | null
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
  }, [profile, loadingProfile])

  if (loadingProfile) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
    </div>
  )

  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  const nombre = profile?.nombre ?? ''
  const titulo = profile?.titulo ? `${profile.titulo} ` : ''
  const hoy = format(new Date(), "EEEE, d 'de' MMMM", { locale: es })

  const abrirBusqueda = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

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

        {/* Buscar paciente */}
        <button
          onClick={abrirBusqueda}
          className="group relative overflow-hidden flex items-center sm:flex-col sm:items-start gap-3 sm:gap-3 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl
            bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] text-white text-left
            shadow-[0_4px_24px_rgba(30,95,168,0.3)]
            hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)]
            hover:-translate-y-0.5
            active:scale-[0.98] active:shadow-md
            transition-all duration-200"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Search size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] leading-tight">Buscar paciente</p>
            <p className="text-white/60 text-xs mt-0.5">Iniciar consulta</p>
          </div>
          <kbd className="hidden sm:inline font-mono text-[10px] bg-white/10 border border-white/20 px-2 py-0.5 rounded-md text-white/70">
            Ctrl / ⌘ K
          </kbd>
        </button>

        {/* Nuevo paciente */}
        <Link
          href="/pacientes/nuevo"
          className="group flex items-center sm:flex-col sm:items-start gap-3 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl
            bg-white border border-slate-100 text-left
            shadow-sm
            hover:shadow-md hover:-translate-y-0.5
            active:scale-[0.98] active:shadow-sm
            transition-all duration-200 ring-2 ring-transparent group-hover:ring-emerald-100"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors duration-150">
            <UserPlus size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-[#1d1d1f] leading-tight">Nuevo paciente</p>
            <p className="text-[#86868b] text-xs mt-0.5">Crear expediente</p>
          </div>
          <span className="hidden sm:inline text-[10px] text-emerald-600 font-semibold bg-emerald-50 group-hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors duration-150">
            + Registrar
          </span>
        </Link>

      </div>

      {/* ── Módulos ───────────────────────────────────────────── */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Módulos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ACCESOS.map(({ href, icon: Icon, label, desc, gradient, ring }) => (
            <Link
              key={href}
              href={href}
              className={`group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                hover:shadow-md hover:-translate-y-1
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
                  className={`flex items-center gap-3 px-4 py-3 group ${i < recientes.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  {/* Avatar + nombre → navega al expediente */}
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
                      <p className="text-[11px] text-[#86868b]">
                        {formatDistanceToNow(parseISO(p.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </div>
                  </Link>

                  {/* Acciones rápidas */}
                  <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                    {/* Receta Express */}
                    <Link
                      href={`/expediente/${p.paciente_id}/documentos?tipo=receta`}
                      title="Receta express"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                    >
                      <Pill size={12} />
                      Receta
                    </Link>
                    {/* Última nota */}
                    <Link
                      href={`/expediente/${p.paciente_id}?tab=consultas`}
                      title="Última nota"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors"
                    >
                      <ClipboardList size={12} />
                      Nota
                    </Link>
                    {/* Ver expediente */}
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
