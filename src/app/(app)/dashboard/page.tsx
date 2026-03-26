'use client'

import { useState, useEffect } from 'react'
import { FileText, Stethoscope, ChevronLeft, ChevronRight, CalendarDays, Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

const accesos = [
  {
    href: '/expediente',
    icon: Stethoscope,
    label: 'Expediente Clínico',
    desc: 'Registrar consultas, diagnósticos y evolución',
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

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

type GCalEvent = {
  id?: string | null
  summary?: string | null
  start?: { date?: string | null; dateTime?: string | null } | null
}

function Calendario() {
  const [mes, setMes] = useState(new Date())
  const [eventos, setEventos] = useState<GCalEvent[]>([])
  const [conectado, setConectado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [tooltip, setTooltip] = useState<{ dia: string; eventos: string[] } | null>(null)

  const hoy = new Date()

  useEffect(() => {
    fetch('/api/google/events')
      .then(r => r.json())
      .then(data => {
        setConectado(data.connected ?? false)
        setEventos(data.events ?? [])
      })
      .finally(() => setCargando(false))
  }, [])

  // Cuando cambia el mes, buscar eventos del nuevo mes
  useEffect(() => {
    if (!conectado) return
    const ini = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString()
    const fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString()
    fetch(`/api/google/events?from=${ini}&to=${fin}`)
      .then(r => r.json())
      .then(data => setEventos(data.events ?? []))
  }, [mes, conectado])

  const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 })
  const fin = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 })
  const dias = eachDayOfInterval({ start: inicio, end: fin })

  const diaHoyTexto = format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  function eventosDelDia(dia: Date): GCalEvent[] {
    return eventos.filter(e => {
      const fechaStr = e.start?.dateTime ?? e.start?.date
      if (!fechaStr) return false
      return isSameDay(new Date(fechaStr), dia)
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Banner Hoy es */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] px-5 py-5 text-white text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70 mb-1">Hoy es</p>
        <p className="text-base font-bold leading-snug capitalize">{diaHoyTexto}</p>
      </div>

      <div className="p-4">
        {/* Navegación de mes */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMes(subMonths(mes, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-700 capitalize">
            {format(mes, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={() => setMes(addMonths(mes, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Cabecera días */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {dias.map(dia => {
            const esHoy = isSameDay(dia, hoy)
            const delMes = isSameMonth(dia, mes)
            const evs = eventosDelDia(dia)
            const tieneEventos = evs.length > 0

            return (
              <div
                key={dia.toISOString()}
                className="relative flex flex-col items-center"
                onMouseEnter={() => tieneEventos && setTooltip({ dia: dia.toISOString(), eventos: evs.map(e => e.summary ?? 'Sin título') })}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className={`
                  w-8 h-8 flex items-center justify-center text-sm rounded-full font-medium select-none transition-colors
                  ${esHoy ? 'bg-[#1e5fa8] text-white shadow-sm ring-2 ring-[#1e5fa8]/30' : ''}
                  ${!esHoy && delMes ? 'text-slate-700 hover:bg-slate-100 cursor-default' : ''}
                  ${!delMes ? 'text-slate-300 cursor-default' : ''}
                `}>
                  {format(dia, 'd')}
                </div>
                {/* Puntos de eventos */}
                {tieneEventos && delMes && (
                  <div className="flex gap-0.5 mt-0.5">
                    {evs.slice(0, 3).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${esHoy ? 'bg-white/70' : 'bg-[#1e5fa8]'}`} />
                    ))}
                  </div>
                )}
                {/* Tooltip */}
                {tooltip?.dia === dia.toISOString() && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-[#1a3a5c] text-white text-xs rounded-lg px-3 py-2 shadow-lg w-max max-w-[180px] pointer-events-none">
                    {tooltip.eventos.map((ev, i) => (
                      <p key={i} className="truncate">• {ev}</p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ir a hoy */}
        {!isSameMonth(mes, hoy) && (
          <button
            onClick={() => setMes(new Date())}
            className="mt-3 w-full text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-semibold py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
          >
            ← Ir a hoy
          </button>
        )}

        {/* Estado Google Calendar */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Verificando calendario...
            </div>
          ) : conectado ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium justify-center">
              <CalendarDays size={13} />
              Google Calendar conectado
            </div>
          ) : (
            <a
              href="/api/google/connect"
              className="flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] rounded-lg transition-colors"
            >
              <LogIn size={13} />
              Conectar Google Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Bienvenido, Dr. Ancona</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sistema de gestión clínica — Cirugía de Columna · Traumatología y Ortopedia
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <Calendario />

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accesos.map(({ href, icon: Icon, label, desc, color, iconColor }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all ${color}`}
              >
                <div className={`mt-0.5 ${iconColor}`}>
                  <Icon size={28} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{label}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Información del consultorio</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
              <p><span className="font-medium">Médico:</span> Dr. Angel M. Ancona Pérez</p>
              <p><span className="font-medium">Especialidad:</span> Cirugía de Columna · T&O</p>
              <p><span className="font-medium">Céd. Prof.:</span> 12085805</p>
              <p><span className="font-medium">CMOT:</span> 26/5567/25</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
