'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import CalendarWidget from '@/components/calendario/CalendarWidget'
import { FileText, Stethoscope, CalendarDays, Loader2, Users, ClipboardList, Search, Monitor } from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Stats = {
  total_pacientes: number
  consultas_este_mes: number
  documentos_total: number
  ultima_consulta: { created_at: string; motivo_consulta: string; paciente_nombre?: string } | null
}

const accesos = [
  {
    href: '/expediente',
    icon: Stethoscope,
    label: 'Expediente Clínico',
    desc: 'Consultas, diagnósticos y evolución',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    iconColor: 'text-violet-700',
  },
  {
    href: '/documentos',
    icon: FileText,
    label: 'Documentos',
    desc: 'Recetas, solicitudes de lab e imagen',
    color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    iconColor: 'text-amber-700',
  },
  {
    href: '/dicom',
    icon: Monitor,
    label: 'Visor DICOM',
    desc: 'Visualiza estudios de imagen médica',
    color: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
    iconColor: 'text-teal-700',
  },
]

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
      <div className="h-7 w-12 bg-slate-200 rounded" />
    </div>
  )
}

export default function DashboardPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [conectado, setConectado] = useState<boolean | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const hoy = new Date()
  const diaHoyTexto = format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  useEffect(() => {
    fetch('/api/google/events')
      .then(r => r.json())
      .then(data => setConectado(data.connected ?? false))
      .catch(() => setConectado(false))
  }, [])

  useEffect(() => {
    if (!loadingProfile && profile && profile.role !== 'secretaria') {
      fetch('/api/me/stats')
        .then(r => r.json())
        .then(data => setStats(data))
        .finally(() => setLoadingStats(false))
    }
  }, [profile, loadingProfile])

  if (loadingProfile) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">
            Bienvenido{profile?.nombre ? `, ${profile.titulo ? `${profile.titulo} ` : ''}${profile.nombre}` : ''}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Sistema de gestión clínica{profile?.especialidad ? ` — ${profile.especialidad}` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
            window.dispatchEvent(event)
          }}
          className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-600 transition-colors bg-white shadow-sm"
        >
          <Search size={13} />
          Buscar paciente
          <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500">Ctrl K</kbd>
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-fade-in-up">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <Users size={13} className="text-violet-500" />
                Pacientes totales
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats?.total_pacientes ?? 0}</p>
              <Link href="/expediente" className="text-xs text-[#1e5fa8] hover:underline mt-1 inline-block">Ver expediente →</Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <Stethoscope size={13} className="text-teal-500" />
                Consultas este mes
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats?.consultas_este_mes ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">{format(hoy, 'MMMM yyyy', { locale: es })}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <FileText size={13} className="text-amber-500" />
                Documentos generados
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats?.documentos_total ?? 0}</p>
              <Link href="/documentos" className="text-xs text-[#1e5fa8] hover:underline mt-1 inline-block">Crear documento →</Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <ClipboardList size={13} className="text-rose-500" />
                Última consulta
              </div>
              {stats?.ultima_consulta ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 leading-tight truncate">{stats.ultima_consulta.paciente_nombre}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDistanceToNow(parseISO(stats.ultima_consulta.created_at), { locale: es, addSuffix: true })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Sin consultas aún</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fila media: Hoy + accesos */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] rounded-2xl px-6 py-5 text-white text-center min-w-[220px]">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70 mb-1">Hoy es</p>
          <p className="text-base font-bold leading-snug capitalize">{diaHoyTexto}</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accesos.map(({ href, icon: Icon, label, desc, color, iconColor }) => (
              <Link key={href} href={href}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${color}`}>
                <div className={`mt-0.5 ${iconColor}`}><Icon size={24} /></div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 shadow-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              {profile?.nombre && <p><span className="font-medium">Médico:</span> {profile.nombre}</p>}
              {profile?.especialidad && <p><span className="font-medium">Especialidad:</span> {profile.especialidad}</p>}
              {profile?.cedula_profesional && <p><span className="font-medium">Céd. Prof.:</span> {profile.cedula_profesional}</p>}
              {profile?.cedula_especialidad && <p><span className="font-medium">Céd. Esp.:</span> {profile.cedula_especialidad}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <CalendarWidget conectado={conectado} setConectado={setConectado} />
    </div>
  )
}
