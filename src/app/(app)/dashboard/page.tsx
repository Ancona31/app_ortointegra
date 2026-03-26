'use client'

import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { FileText, Stethoscope, CalendarDays, LogIn, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

type GCalEvent = {
  id?: string | null
  summary?: string | null
  start?: { date?: string | null; dateTime?: string | null } | null
  end?: { date?: string | null; dateTime?: string | null } | null
}

export default function DashboardPage() {
  const [conectado, setConectado] = useState<boolean | null>(null)
  const hoy = new Date()
  const diaHoyTexto = format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  useEffect(() => {
    fetch('/api/google/events')
      .then(r => r.json())
      .then(data => setConectado(data.connected ?? false))
      .catch(() => setConectado(false))
  }, [])

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
    } catch {
      return []
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Bienvenido, Dr. Ancona</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sistema de gestión clínica — Cirugía de Columna · Traumatología y Ortopedia
        </p>
      </div>

      {/* Fila superior: Hoy es + accesos + info */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 items-start">
        {/* Banner Hoy es */}
        <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] rounded-2xl px-6 py-5 text-white text-center min-w-[220px]">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70 mb-1">Hoy es</p>
          <p className="text-base font-bold leading-snug capitalize">{diaHoyTexto}</p>
        </div>

        {/* Accesos rápidos + info */}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-slate-600">
              <p><span className="font-medium">Médico:</span> Dr. Angel M. Ancona Pérez</p>
              <p><span className="font-medium">Especialidad:</span> Cirugía de Columna · T&O</p>
              <p><span className="font-medium">Céd. Prof.:</span> 12085805</p>
              <p><span className="font-medium">CMOT:</span> 26/5567/25</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario FullCalendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header del calendario */}
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
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
              }}
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
