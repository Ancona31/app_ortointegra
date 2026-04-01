'use client'

import { useState, useEffect, useRef } from 'react'
import { useProfile } from '@/hooks/useProfile'
import SecretariaDashboard from './SecretariaDashboard'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import {
  FileText, Stethoscope, CalendarDays, LogIn, Loader2, Users, ClipboardList,
  Search, Monitor, X, MapPin, AlignLeft, ExternalLink, Plus, LogOut,
} from 'lucide-react'
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
  description?: string | null
  location?: string | null
  htmlLink?: string | null
  start?: { date?: string | null; dateTime?: string | null } | null
  end?: { date?: string | null; dateTime?: string | null } | null
}

type CalEventInfo = {
  id?: string
  title: string
  start: string
  end?: string
  allDay: boolean
  description?: string
  location?: string
  htmlLink?: string
}

type ModalCrear = {
  fecha: string
  horaInicio: string
  horaFin: string
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
  const [eventoDetalle, setEventoDetalle] = useState<CalEventInfo | null>(null)
  const [modalCrear, setModalCrear] = useState<ModalCrear | null>(null)
  const [crearTodoDia, setCrearTodoDia] = useState(false)
  const [creandoEvento, setCreandoEvento] = useState(false)
  const calendarRef = useRef<FullCalendar>(null)
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
        extendedProps: {
          description: e.description ?? undefined,
          location: e.location ?? undefined,
          htmlLink: e.htmlLink ?? undefined,
        },
      }))
    } catch { return [] }
  }

  function handleEventClick(info: { event: { id: string; title: string; startStr: string; endStr: string; allDay: boolean; extendedProps: Record<string, string> } }) {
    const ev = info.event
    setEventoDetalle({
      id: ev.id,
      title: ev.title,
      start: ev.startStr,
      end: ev.endStr || undefined,
      allDay: ev.allDay,
      description: ev.extendedProps.description,
      location: ev.extendedProps.location,
      htmlLink: ev.extendedProps.htmlLink,
    })
  }

  function handleDateClick(info: { dateStr: string; allDay: boolean }) {
    const fecha = info.dateStr.slice(0, 10)
    const horaInicio = info.allDay ? '09:00' : info.dateStr.slice(11, 16)
    const [h, m] = horaInicio.split(':').map(Number)
    const horaFin = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    setCrearTodoDia(false)
    setModalCrear({ fecha, horaInicio, horaFin })
  }

  async function handleCrearEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const titulo = data.get('titulo') as string
    const fecha = data.get('fecha') as string
    const horaInicio = data.get('horaInicio') as string
    const horaFin = data.get('horaFin') as string
    const descripcion = (data.get('descripcion') as string).trim()
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone

    setCreandoEvento(true)
    try {
      const body = crearTodoDia
        ? { titulo, descripcion: descripcion || undefined, todoDia: true, fecha }
        : {
            titulo,
            descripcion: descripcion || undefined,
            todoDia: false,
            inicio: `${fecha}T${horaInicio}:00`,
            fin: `${fecha}T${horaFin}:00`,
            zona,
          }

      const res = await fetch('/api/google/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setModalCrear(null)
        calendarRef.current?.getApi().refetchEvents()
      }
    } finally {
      setCreandoEvento(false)
    }
  }

  async function handleDesconectar() {
    if (!confirm('¿Desconectar Google Calendar?')) return
    await fetch('/api/google/disconnect', { method: 'DELETE' })
    setConectado(false)
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setModalCrear({ fecha: format(hoy, 'yyyy-MM-dd'), horaInicio: '09:00', horaFin: '10:00' })}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={12} /> Nueva cita
              </button>
              <button
                onClick={handleDesconectar}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
                title="Desconectar Google Calendar"
              >
                <LogOut size={13} /> Desconectar
              </button>
            </div>
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
              ref={calendarRef}
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
              selectable={true}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
            />
          )}
        </div>
      </div>

      {/* Modal: detalle de evento */}
      {eventoDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEventoDetalle(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-3">
              <h2 className="font-semibold text-slate-800 text-base leading-snug">{eventoDetalle.title}</h2>
              <button onClick={() => setEventoDetalle(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-[#1e5fa8] shrink-0" />
                <span>
                  {eventoDetalle.allDay
                    ? format(parseISO(eventoDetalle.start), "EEEE d 'de' MMMM yyyy", { locale: es })
                    : `${format(parseISO(eventoDetalle.start), "EEEE d 'de' MMMM, HH:mm", { locale: es })}${eventoDetalle.end ? ` – ${format(parseISO(eventoDetalle.end), 'HH:mm')}` : ''}`
                  }
                </span>
              </div>
              {eventoDetalle.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  <span>{eventoDetalle.location}</span>
                </div>
              )}
              {eventoDetalle.description && (
                <div className="flex items-start gap-2">
                  <AlignLeft size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{eventoDetalle.description}</span>
                </div>
              )}
            </div>
            {eventoDetalle.htmlLink && (
              <a
                href={eventoDetalle.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-1.5 text-xs text-[#1e5fa8] hover:underline"
              >
                <ExternalLink size={12} /> Abrir en Google Calendar
              </a>
            )}
          </div>
        </div>
      )}

      {/* Modal: crear cita */}
      {modalCrear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalCrear(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nueva cita</h2>
              <button onClick={() => setModalCrear(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCrearEvento} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Título *</label>
                <input
                  name="titulo"
                  required
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                  placeholder="Consulta, cirugía, junta..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={crearTodoDia}
                  onChange={e => setCrearTodoDia(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="allDay" className="text-sm text-slate-600 cursor-pointer">Todo el día</label>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  defaultValue={modalCrear.fecha}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                />
              </div>
              {!crearTodoDia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Hora inicio</label>
                    <input
                      type="time"
                      name="horaInicio"
                      defaultValue={modalCrear.horaInicio}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Hora fin</label>
                    <input
                      type="time"
                      name="horaFin"
                      defaultValue={modalCrear.horaFin}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Descripción (opcional)</label>
                <textarea
                  name="descripcion"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8] resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalCrear(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoEvento}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] rounded-lg transition-colors disabled:opacity-50"
                >
                  {creandoEvento ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Crear cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
