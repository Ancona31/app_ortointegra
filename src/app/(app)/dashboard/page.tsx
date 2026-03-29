'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import SecretariaDashboard from './SecretariaDashboard'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { FileText, Stethoscope, CalendarDays, LogIn, Loader2, Users, ClipboardList, Search } from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Stats = {
  total_pacientes: number
  consultas_este_mes: number
  documentos_total: number
  ultima_consulta: { created_at: string; motivo_consulta: string; paciente_nombre?: string } | null
}

type GCalEvent = {
  id?: string | null
  summary?: string | null
  start?: { date?: string | null; dateTime?: string | null } | null
  end?: { date?: string | null; dateTime?: string | null } | null
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

  async function fetchEventos(fetchInfo: { startStr: string; endStr: string }) {
    if (!conectado) return []
    try {
      const res = await fetch(`/api/google/events?from=${fetchInfo.startStr}&to=${fetchInfo.endStr}`)
      const data = await res.json()
      if (!data.connected) return []
      return (data.events as GCalEvent[] || []).map(e => ({
        id: e.id ?? undefined,
        title: e.summary ?? 'Sin título',
        start: e.start?.dateTime ?? e.start?.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? undefined,
        allDay: !e.start?.dateTime,
      }))
    } catch { return [] }
  }

  if (loadingProfile) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  if (profile?.role === 'secretaria') return <SecretariaDashboard />

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
        {/* Ctrl+K hint */}
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
          <>
            <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
          </>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <CalendarDays size={16} className="text-[#1e5fa8]" />
            Agenda
          </div>
          {conectado === null ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Verificando...
            </div>
          ) : conectado ? (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
              <CalendarDays size={12} /> Google Calendar conectado
            </span>
          ) : (
            <a href="/api/google/connect"
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-lg transition-colors">
              <LogIn size={12} /> Conectar Google Calendar
            </a>
          )}
        </div>
        <div style={{ height: 'calc(100vh - 320px)', minHeight: '520px' }}>
          {conectado === null ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={esLocale}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
              height="100%"
              contentHeight="100%"
              expandRows={true}
              events={conectado ? fetchEventos : []}
              eventColor="#1e5fa8"
              eventTextColor="#ffffff"
              dayMaxEvents={3}
              nowIndicator={true}
              scrollTime="08:00:00"
              editable={false}
              selectable={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}
