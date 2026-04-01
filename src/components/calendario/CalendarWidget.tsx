'use client'

import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { CalendarDays, LogIn, Loader2, X, MapPin, AlignLeft, ExternalLink, Plus, LogOut, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

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

export default function CalendarWidget({ conectado, setConectado }: {
  conectado: boolean | null
  setConectado: (v: boolean) => void
}) {
  const [eventoDetalle, setEventoDetalle] = useState<CalEventInfo | null>(null)
  const [modalCrear, setModalCrear] = useState<ModalCrear | null>(null)
  const [crearTodoDia, setCrearTodoDia] = useState(false)
  const [creandoEvento, setCreandoEvento] = useState(false)
  const [eliminandoEvento, setEliminandoEvento] = useState(false)
  const calendarRef = useRef<FullCalendar>(null)
  const hoy = new Date()

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
    const paciente = (data.get('paciente') as string).trim()
    const motivo = (data.get('motivo') as string).trim()
    const descripcionExtra = (data.get('descripcion') as string).trim()
    const emailMedico = (data.get('emailMedico') as string).trim()
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone

    const partes = []
    if (paciente) partes.push(`Paciente: ${paciente}`)
    if (motivo) partes.push(`Motivo: ${motivo}`)
    if (descripcionExtra) partes.push(descripcionExtra)
    const descripcion = partes.join('\n') || undefined

    setCreandoEvento(true)
    try {
      const body = crearTodoDia
        ? { titulo, descripcion, todoDia: true, fecha, emailMedico: emailMedico || undefined }
        : {
            titulo,
            descripcion,
            todoDia: false,
            inicio: `${fecha}T${horaInicio}:00`,
            fin: `${fecha}T${horaFin}:00`,
            zona,
            emailMedico: emailMedico || undefined,
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

  async function handleEliminarEvento() {
    if (!eventoDetalle?.id) return
    if (!confirm('¿Eliminar este evento del calendario?')) return
    setEliminandoEvento(true)
    try {
      const res = await fetch('/api/google/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventoDetalle.id }),
      })
      if (res.ok) {
        setEventoDetalle(null)
        calendarRef.current?.getApi().refetchEvents()
      }
    } finally {
      setEliminandoEvento(false)
    }
  }

  async function handleDesconectar() {
    if (!confirm('¿Desconectar Google Calendar?')) return
    await fetch('/api/google/disconnect', { method: 'DELETE' })
    setConectado(false)
  }

  return (
    <>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEventoDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
            <div className="mt-5 flex items-center justify-between">
              {eventoDetalle.htmlLink ? (
                <a href={eventoDetalle.htmlLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#1e5fa8] hover:underline">
                  <ExternalLink size={12} /> Abrir en Google Calendar
                </a>
              ) : <span />}
              {eventoDetalle.id && (
                <button
                  onClick={handleEliminarEvento}
                  disabled={eliminandoEvento}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                >
                  {eliminandoEvento ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Eliminar evento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: crear cita */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalCrear(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nueva cita</h2>
              <button onClick={() => setModalCrear(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCrearEvento} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Título *</label>
                <input name="titulo" required autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                  placeholder="Consulta, cirugía, junta..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nombre del paciente</label>
                <input name="paciente"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                  placeholder="Ej. Juan Pérez" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Motivo de consulta</label>
                <input name="motivo"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                  placeholder="Ej. Dolor lumbar, revisión postquirúrgica..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="allDayCW" checked={crearTodoDia}
                  onChange={e => setCrearTodoDia(e.target.checked)} className="rounded" />
                <label htmlFor="allDayCW" className="text-sm text-slate-600 cursor-pointer">Todo el día</label>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Fecha *</label>
                <input type="date" name="fecha" defaultValue={modalCrear.fecha} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]" />
              </div>
              {!crearTodoDia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Hora inicio</label>
                    <input type="time" name="horaInicio" defaultValue={modalCrear.horaInicio}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Hora fin</label>
                    <input type="time" name="horaFin" defaultValue={modalCrear.horaFin}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Email del médico <span className="text-slate-400 font-normal">(se le enviará invitación)</span>
                </label>
                <input name="emailMedico" type="email"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]"
                  placeholder="doctor@ejemplo.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Notas adicionales</label>
                <textarea name="descripcion" rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8] resize-none"
                  placeholder="Notas adicionales..." />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalCrear(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creandoEvento}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] rounded-lg transition-colors disabled:opacity-50">
                  {creandoEvento ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Crear cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
