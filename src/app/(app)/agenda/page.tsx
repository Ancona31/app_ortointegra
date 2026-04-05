'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventDropArg, DateSelectArg, EventInput, EventContentArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { X, Calendar, User, Plus, Trash2, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/hooks/useProfile'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import Portal from '@/components/ui/Portal'

/* ─── Tipos ────────────────────────────────────────────── */

type Status = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show'

type Appointment = {
  id: string
  title: string
  start_time: string
  end_time: string
  status: Status
  notes: string | null
  paciente_id: string | null
  medico_id: string | null
  google_event_id: string | null
  gcal_sync_status: 'synced' | 'pending' | 'failed'
  updated_at: string
  pacientes?: { id: string; nombre: string; apellidos: string; telefono: string | null } | null
  medico?: { id: string; nombre: string; titulo: string } | null
}

type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }

type Medico = { id: string; nombre: string; titulo: string; especialidad?: string | null }

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; start: string; end: string }
  | { mode: 'edit';   appointment: Appointment }

/* ─── Colores por estado ───────────────────────────────── */

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  scheduled:  { label: 'Agendada',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  confirmed:  { label: 'Confirmada', bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  cancelled:  { label: 'Cancelada',  bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  no_show:    { label: 'No asistió', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
}

// Paleta de colores por médico (Google Calendar multi-calendar style)
const DOCTOR_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: '#EFF6FF', text: '#1e40af', border: '#3b82f6' }, // blue
  { bg: '#F0FDF4', text: '#166534', border: '#22c55e' }, // green
  { bg: '#FDF4FF', text: '#7e22ce', border: '#a855f7' }, // purple
  { bg: '#FFF7ED', text: '#9a3412', border: '#f97316' }, // orange
  { bg: '#F0FDFA', text: '#065f46', border: '#14b8a6' }, // teal
  { bg: '#FFFBEB', text: '#92400e', border: '#f59e0b' }, // amber
  { bg: '#F5F3FF', text: '#4c1d95', border: '#8b5cf6' }, // violet
  { bg: '#FFF1F2', text: '#9f1239', border: '#ef4444' }, // rose
]

// Paleta pastel estilo Google Calendar
const STATUS_STYLE: Record<Status, { bg: string; text: string; border: string }> = {
  scheduled: { bg: '#EFF6FF', text: '#1e40af', border: '#3b82f6' },
  confirmed:  { bg: '#F0FDF4', text: '#166534', border: '#22c55e' },
  cancelled:  { bg: '#FFF1F2', text: '#9f1239', border: '#ef4444' },
  no_show:    { bg: '#FFF7ED', text: '#9a3412', border: '#f97316' },
}

/* ─── Horario de consulta ──────────────────────────────── */

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
type HorarioDia = { activo: boolean; inicio: string; fin: string }
type Horario = Record<DiaSemana, HorarioDia>

const DIAS: { key: DiaSemana; label: string; fc: number }[] = [
  { key: 'lunes',     label: 'Lunes',     fc: 1 },
  { key: 'martes',    label: 'Martes',    fc: 2 },
  { key: 'miercoles', label: 'Miércoles', fc: 3 },
  { key: 'jueves',    label: 'Jueves',    fc: 4 },
  { key: 'viernes',   label: 'Viernes',   fc: 5 },
  { key: 'sabado',    label: 'Sábado',    fc: 6 },
  { key: 'domingo',   label: 'Domingo',   fc: 0 },
]

const HORARIO_DEFAULT: Horario = {
  lunes:     { activo: true,  inicio: '09:00', fin: '19:00' },
  martes:    { activo: true,  inicio: '09:00', fin: '19:00' },
  miercoles: { activo: true,  inicio: '09:00', fin: '19:00' },
  jueves:    { activo: true,  inicio: '09:00', fin: '19:00' },
  viernes:   { activo: true,  inicio: '09:00', fin: '19:00' },
  sabado:    { activo: false, inicio: '09:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '14:00' },
}

function horarioToBusinessHours(h: Horario) {
  return DIAS.filter(d => h[d.key]?.activo).map(d => ({
    daysOfWeek: [d.fc],
    startTime:  h[d.key].inicio,
    endTime:    h[d.key].fin,
  }))
}

function isWithinBusinessHours(date: Date, h: Horario): boolean {
  const dia = DIAS.find(d => d.fc === date.getDay())
  if (!dia) return false
  const horarioDia = h[dia.key]
  if (!horarioDia.activo) return false
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return hhmm >= horarioDia.inicio && hhmm < horarioDia.fin
}

/* ─── Modal de configuración de horario ─────────────────── */

function HorarioModal({ onClose, onSave }: { onClose: () => void; onSave: (h: Horario) => Promise<void> }) {
  const [horario, setHorario] = useState<Horario | null>(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch('/api/me/horario')
      .then(r => r.json())
      .then(d => setHorario(d.horario ?? HORARIO_DEFAULT))
  }, [])

  function toggle(dia: DiaSemana) {
    setHorario(prev => prev ? { ...prev, [dia]: { ...prev[dia], activo: !prev[dia].activo } } : prev)
  }

  function setHora(dia: DiaSemana, campo: 'inicio' | 'fin', val: string) {
    setHorario(prev => prev ? { ...prev, [dia]: { ...prev[dia], [campo]: val } } : prev)
  }

  async function handleSave() {
    if (!horario) return
    setSaving(true)
    await onSave(horario)
    setSaving(false)
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-modal-enter overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Settings size={15} className="text-slate-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">Horario de consulta</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {!horario ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {DIAS.map(({ key, label }) => {
                const dia = horario[key]
                return (
                  <div key={key} className={`rounded-xl px-3 py-2.5 transition-colors ${dia.activo ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    {/* Fila: toggle + nombre */}
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => toggle(key)}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-[#1e5fa8]' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${dia.activo ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-sm font-medium flex-1 ${dia.activo ? 'text-[#1d1d1f]' : 'text-slate-400'}`}>
                        {label}
                      </span>
                      {!dia.activo && (
                        <span className="text-[11px] text-slate-400 italic">Sin consulta</span>
                      )}
                    </div>

                    {/* Fila: pickers de hora (solo si activo) */}
                    {dia.activo && (
                      <div className="flex items-center gap-2 mt-2 pl-[52px]">
                        <input
                          type="time"
                          value={dia.inicio}
                          onChange={e => setHora(key, 'inicio', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                        <span className="text-xs text-slate-400 flex-shrink-0">–</span>
                        <input
                          type="time"
                          value={dia.fin}
                          min={dia.inicio}
                          onChange={e => setHora(key, 'fin', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !horario}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

/* ─── Duraciones disponibles (minutos) ─────────────────── */

const DURATIONS = [
  { label: '15 min', value: 15  },
  { label: '30 min', value: 30  },
  { label: '45 min', value: 45  },
  { label: '1 hora', value: 60  },
  { label: '1:30 h', value: 90  },
  { label: '2 horas', value: 120 },
]

const DEFAULT_DURATION = 60

function calcDuration(startIso: string, endIso: string) {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + mins); return d.toISOString()
}

/* ─── Helpers ──────────────────────────────────────────── */

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromDatetimeLocal(val: string) { return new Date(val).toISOString() }
function addHour(iso: string) {
  const d = new Date(iso); d.setHours(d.getHours() + 1); return d.toISOString()
}

/* ─── Hook: búsqueda de pacientes ─────────────────────── */

function usePacientes(query: string) {
  const [results, setResults] = useState<PacienteBusqueda[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos, telefono')
        .neq('activo', false)
        .or(`nombre.ilike.%${query}%,apellidos.ilike.%${query}%`)
        .order('apellidos')
        .limit(8)
      setResults(data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
}

/* ─── Modal de creación rápida de paciente ──────────────── */
// Ahora importado desde @/components/ui/QuickPatientModal
// Se mantiene el bloque comentado para referencia
/*
function QuickPatientModal({
  nombreInicial,
  onCreated,
  onClose,
}: {
  nombreInicial: string
  onCreated: (p: PacienteBusqueda) => void
  onClose: () => void
}) {
  const partes = nombreInicial.trim().split(' ')
  const [nombre,    setNombre]    = useState(partes[0] ?? '')
  const [apellidos, setApellidos] = useState(partes.slice(1).join(' '))
  const [edad,      setEdad]      = useState('')
  const [email,     setEmail]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function handleCreate() {
    if (!nombre.trim() || !apellidos.trim() || !edad) {
      setError('Nombre, apellidos y edad son requeridos.')
      return
    }
    setSaving(true)
    setError('')
    const edadNum = parseInt(edad, 10)
    const anio = new Date().getFullYear() - edadNum
    const fecha_nacimiento = `${anio}-06-15`

    const res = await fetch('/api/pacientes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), apellidos: apellidos.trim(), fecha_nacimiento, email: email.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al crear paciente'); setSaving(false); return }
    onCreated({ id: data.id, nombre: nombre.trim(), apellidos: apellidos.trim(), telefono: null })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <User size={15} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">Registrar paciente</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Apellidos</label>
              <input value={apellidos} onChange={e => setApellidos(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Edad</label>
              <input type="number" min={0} max={120} value={edad} onChange={e => setEdad(e.target.value)}
                placeholder="ej. 35"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="opcional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <p className="text-[11px] text-[#86868b]">El expediente completo se puede editar después desde Pacientes.</p>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {saving ? 'Registrando...' : 'Crear y continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}

*/

/* ─── Modal de cita ─────────────────────────────────────── */

function AppointmentModal({
  modal, onClose, onSave, onDelete, medicos, isSingleDoctor, defaultMedicoId,
}: {
  modal: ModalState
  onClose: () => void
  onSave: (data: Partial<Appointment> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  medicos: Medico[]
  isSingleDoctor: boolean
  defaultMedicoId: string
}) {
  const isEdit = modal.mode === 'edit'
  const apt    = modal.mode === 'edit' ? modal.appointment : null

  const initialDuration = apt ? calcDuration(apt.start_time, apt.end_time) : DEFAULT_DURATION

  const [startTime,   setStartTime]   = useState(
    modal.mode === 'create' ? toDatetimeLocal(modal.start)
    : apt ? toDatetimeLocal(apt.start_time) : ''
  )
  const [duration,    setDuration]    = useState(initialDuration)
  const [notes,       setNotes]       = useState(apt?.notes ?? '')
  const [status,      setStatus]      = useState<Status>(apt?.status ?? 'scheduled')
  const [paciente,    setPaciente]    = useState<PacienteBusqueda | null>(
    apt?.pacientes
      ? { id: apt.pacientes.id, nombre: apt.pacientes.nombre, apellidos: apt.pacientes.apellidos, telefono: apt.pacientes.telefono ?? null }
      : null
  )
  const [search,      setSearch]      = useState('')
  const [showSearch,  setShowSearch]  = useState(false)
  const [quickCreate, setQuickCreate] = useState(false)
  const [medicoId,    setMedicoId]    = useState<string>(apt?.medico_id ?? defaultMedicoId)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const { results, loading: searchLoading } = usePacientes(search)
  const showDropdown = showSearch && search.trim().length >= 2

  async function handleSave() {
    if (!paciente || !startTime) return
    setSaving(true)
    const start_time = fromDatetimeLocal(startTime)
    await onSave({
      id:          apt?.id,
      title:       `${paciente.nombre} ${paciente.apellidos}`,
      start_time,
      end_time:    addMinutes(start_time, duration),
      notes:       notes.trim() || null,
      status,
      paciente_id: paciente.id,
      medico_id:   medicoId || null,
      updated_at:  apt?.updated_at,
    })
    setSaving(false)
  }

  async function handleDelete() {
    if (!apt?.id) return
    setDeleting(true)
    await onDelete(apt.id)
    setDeleting(false)
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-modal-enter overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar size={15} className="text-blue-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">
              {isEdit ? 'Editar cita' : 'Nueva cita'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Paciente — campo principal y obligatorio */}
          <div>
            <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">
              Paciente <span className="text-red-400">*</span>
            </label>
            {paciente ? (
              <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1e5fa8] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-white">{paciente.nombre[0]}{paciente.apellidos[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{paciente.nombre} {paciente.apellidos}</p>
                    {paciente.telefono && <p className="text-[11px] text-blue-600">{paciente.telefono}</p>}
                  </div>
                </div>
                <button onClick={() => { setPaciente(null); setSearch('') }} className="text-blue-400 hover:text-blue-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowSearch(true) }}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Buscar paciente por nombre o apellido..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
                {showDropdown && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {searchLoading && <div className="px-3 py-2.5 text-xs text-[#86868b]">Buscando...</div>}
                    {results.map(p => (
                      <button key={p.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                        onClick={() => { setPaciente(p); setSearch(''); setShowSearch(false) }}
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-blue-700">{p.nombre[0]}{p.apellidos[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1d1d1f]">{p.nombre} {p.apellidos}</p>
                          {p.telefono && <p className="text-[11px] text-[#86868b]">{p.telefono}</p>}
                        </div>
                      </button>
                    ))}
                    {/* Opción de registro rápido */}
                    {!searchLoading && (
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors border-t border-slate-100"
                        onClick={() => { setShowSearch(false); setQuickCreate(true) }}
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Plus size={13} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Registrar "{search}"</p>
                          <p className="text-[11px] text-emerald-500">Crear nuevo paciente y continuar</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fecha y hora de inicio */}
          <div>
            <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">
              Fecha y hora de inicio
            </label>
            <input
              type="datetime-local"
              value={startTime}
              step={900}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Duración */}
          <div>
            <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Duración</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    duration === d.value
                      ? 'bg-[#1e5fa8] text-white border-[#1e5fa8]'
                      : 'bg-white text-[#64748b] border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {startTime && (
              <p className="text-[11px] text-[#86868b] mt-1.5">
                Termina a las{' '}
                <span className="font-semibold text-[#1d1d1f]">
                  {toDatetimeLocal(addMinutes(fromDatetimeLocal(startTime), duration)).slice(11, 16)}
                </span>
              </p>
            )}
          </div>

          {/* Estado (solo edición) */}
          {isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Estado</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setStatus(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      status === key ? `${cfg.bg} ${cfg.text} border-current` : 'bg-white text-[#86868b] border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${status === key ? cfg.dot : 'bg-slate-300'}`} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Médico (solo modo multi-doctor) */}
          {!isSingleDoctor && (
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Médico</label>
              <select
                value={medicoId}
                onChange={e => setMedicoId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white"
              >
                <option value="">Sin asignar</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>{m.titulo ? `${m.titulo} ` : ''}{m.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instrucciones, observaciones..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              <Trash2 size={14} />
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !paciente || !startTime}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agendar cita'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de creación rápida — z-index superior al modal de cita */}
    {quickCreate && (
      <QuickPatientModal
        nombreInicial={search}
        onCreated={p => { setPaciente(p); setQuickCreate(false); setSearch('') }}
        onClose={() => setQuickCreate(false)}
      />
    )}
    </Portal>
  )
}

/* ─── Modal de confirmación genérico ───────────────────── */

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter p-6">
        <p className="text-sm text-[#1d1d1f] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

/* ─── Renderer de eventos (estilo Google) ──────────────── */

type EventColor = { bg: string; text: string; border: string }

function renderEventContent(arg: EventContentArg) {
  const apt = arg.event.extendedProps as Appointment & { colorStyle?: EventColor; doctorInitial?: string }
  if (!apt?.status) return <>{arg.event.title}</>
  const s   = apt.colorStyle ?? STATUS_STYLE[apt.status]
  const pac = apt.pacientes

  return (
    <div style={{
      background:     s.bg,
      borderLeft:     `3px solid ${s.border}`,
      borderRadius:   '6px',
      padding:        '3px 7px',
      height:         '100%',
      overflow:       'hidden',
      boxSizing:      'border-box',
      cursor:         'pointer',
      display:        'flex',
      flexDirection:  'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', color: s.text, opacity: 0.6, lineHeight: 1.2, fontWeight: 500, flex: 1 }}>
          {arg.timeText}
        </span>
        {apt.doctorInitial && (
          <span style={{
            fontSize: '9px', fontWeight: 700, color: s.text,
            background: s.border + '33', borderRadius: '3px',
            padding: '0 3px', lineHeight: '14px', flexShrink: 0,
          }}>
            {apt.doctorInitial}
          </span>
        )}
      </div>
      <div style={{
        fontSize:     '11.5px',
        fontWeight:   700,
        color:        s.text,
        lineHeight:   1.3,
        marginTop:    '2px',
        wordBreak:    'break-word',
        overflowWrap: 'break-word',
        whiteSpace:   'normal',
      }}>
        {pac ? `${pac.nombre} ${pac.apellidos}` : apt.title}
      </div>
    </div>
  )
}

/* ─── Página principal ─────────────────────────────────── */

export default function AgendaPage() {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const [modal,        setModal]        = useState<ModalState>({ mode: 'closed' })
  const [isMobile,     setIsMobile]     = useState(false)
  const [horario,      setHorario]      = useState<Horario>(HORARIO_DEFAULT)
  const [horarioOpen,  setHorarioOpen]  = useState(false)
  const [confirm,      setConfirm]      = useState<{ message: string; onConfirm: () => void; onCancel: () => void } | null>(null)
  const [medicos,      setMedicos]      = useState<Medico[]>([])
  const [filtroMedico, setFiltroMedico] = useState<string>('')
  const { profile } = useProfile()
  const toast = useToast()

  const canEditHorario  = ['medico', 'admin', 'super_admin'].includes(profile?.role ?? '')
  const isSingleDoctor  = medicos.length <= 1
  const defaultMedicoId = isSingleDoctor ? (medicos[0]?.id ?? '') : ''

  // Map medico_id → color index (stable order from API)
  const medicoColorMap = useMemo(() => {
    const map = new Map<string, number>()
    medicos.forEach((m, i) => map.set(m.id, i))
    return map
  }, [medicos])

  useEffect(() => {
    fetch('/api/me/horario')
      .then(r => r.json())
      .then(d => { if (d.horario) setHorario(d.horario) })
  }, [])

  useEffect(() => {
    fetch('/api/clinica/medicos')
      .then(r => r.json())
      .then(d => setMedicos(d.medicos ?? []))
  }, [])

  /* ── Detectar mobile y actualizar vista del calendario ── */
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      const api = calendarRef.current?.getApi()
      if (!api) return
      if (mobile && api.view.type !== 'timeGridDay') {
        api.changeView('timeGridDay')
      } else if (!mobile && api.view.type === 'timeGridDay') {
        api.changeView('timeGridWeek')
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function closeModal() { setModal({ mode: 'closed' }) }

  function refetch() {
    calendarRef.current?.getApi().refetchEvents()
  }

  /* ── Supabase Realtime — WebSocket subscription ─────── */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        refetch()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── Event source: nuestras citas ───────────────────── */
  const appointmentSource = useCallback(async (
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    try {
      let url = `/api/appointments?from=${info.startStr}&to=${info.endStr}`
      if (filtroMedico) url += `&medico_id=${filtroMedico}`
      const res = await fetch(url)
      const data = await res.json()
      const apts: Appointment[] = data.appointments ?? []

      success(apts.map(apt => {
        let colorStyle: { bg: string; text: string; border: string }
        let doctorInitial: string | undefined

        if (!isSingleDoctor && apt.medico_id) {
          const idx = medicoColorMap.get(apt.medico_id) ?? 0
          colorStyle = DOCTOR_COLORS[idx % DOCTOR_COLORS.length]
          const m = apt.medico
          if (m) doctorInitial = m.nombre.slice(0, 2).toUpperCase()
        } else {
          colorStyle = STATUS_STYLE[apt.status] ?? STATUS_STYLE.scheduled
        }

        return {
          id:              apt.id,
          title:           apt.title,
          start:           apt.start_time,
          end:             apt.end_time,
          backgroundColor: 'transparent',
          borderColor:     'transparent',
          textColor:       colorStyle.text,
          extendedProps:   { ...apt, colorStyle, doctorInitial },
        }
      }))
    } catch (err: any) {
      failure(err)
    }
  }, [isSingleDoctor, medicoColorMap, filtroMedico])

  /* ── Event source: eventos personales de Google Calendar ── */
  const gcalSource = useCallback(async (
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    try {
      const res = await fetch(`/api/google/events?from=${info.startStr}&to=${info.endStr}`)
      const data = await res.json()
      if (!data.connected || !data.events) { success([]); return }

      // IDs de eventos que ya son citas de la app — para no duplicar
      const appGcalIds = new Set<string>()
      const aptsRes = await fetch(`/api/appointments?from=${info.startStr}&to=${info.endStr}`)
      const aptsData = await aptsRes.json()
      for (const apt of aptsData.appointments ?? []) {
        if (apt.google_event_id) appGcalIds.add(apt.google_event_id)
      }

      const eventos = (data.events as any[])
        .filter((e: any) => e.id && !appGcalIds.has(e.id))
        .map((e: any) => ({
          id:              `gcal-${e.id}`,
          title:           `🔒 ${e.summary || 'Ocupado'}`,
          start:           e.start?.dateTime ?? e.start?.date ?? '',
          end:             e.end?.dateTime ?? e.end?.date ?? undefined,
          allDay:          !e.start?.dateTime,
          backgroundColor: '#f3e8ff',
          borderColor:     '#c084fc',
          textColor:       '#7c3aed',
          editable:        false,
          extendedProps:   { isGcalBlock: true },
        }))

      success(eventos)
    } catch (err: any) {
      failure(err)
    }
  }, [])

  /* ── Handlers ────────────────────────────────────────── */
  function handleDateClick(arg: DateClickArg) {
    const start = arg.date.toISOString()
    if (!isWithinBusinessHours(arg.date, horario)) {
      setConfirm({
        message: '¿La consulta se agendará fuera del horario de consulta. ¿Desea continuar?',
        onConfirm: () => { setConfirm(null); setModal({ mode: 'create', start, end: addHour(start) }) },
        onCancel:  () => setConfirm(null),
      })
      return
    }
    setModal({ mode: 'create', start, end: addHour(start) })
  }

  function handleSelect(arg: DateSelectArg) {
    if (!isWithinBusinessHours(arg.start, horario)) {
      setConfirm({
        message: 'La consulta se agendará fuera del horario de consulta. ¿Desea continuar?',
        onConfirm: () => { setConfirm(null); setModal({ mode: 'create', start: arg.startStr, end: arg.endStr }) },
        onCancel:  () => setConfirm(null),
      })
      return
    }
    setModal({ mode: 'create', start: arg.startStr, end: arg.endStr })
  }

  function handleEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps.isGoogleEvent || arg.event.extendedProps.isGcalBlock) return
    setModal({ mode: 'edit', appointment: arg.event.extendedProps as Appointment })
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (arg.event.extendedProps.isGcalBlock) { arg.revert(); return }
    const id         = arg.event.id
    const start_time = arg.event.start?.toISOString()
    const end_time   = arg.event.end?.toISOString()

    if (!start_time) { arg.revert(); return }

    if (!isWithinBusinessHours(arg.event.start!, horario)) {
      setConfirm({
        message: 'La consulta se movió fuera del horario de consulta. ¿Está seguro?',
        onConfirm: () => { setConfirm(null); ejecutarDrop(id, start_time, end_time, arg) },
        onCancel:  () => { setConfirm(null); arg.revert() },
      })
      return
    }

    // Sin updated_at — drag & drop no requiere chequeo de concurrencia
    toast.info('Guardando cambio...')
    ejecutarDrop(id, start_time, end_time, arg)
  }

  async function ejecutarDrop(id: string, start_time: string, end_time: string | undefined, arg: EventDropArg) {
    const res = await fetch(`/api/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ start_time, end_time }),
    })

    if (res.ok) {
      toast.success('Cita actualizada')
    } else {
      arg.revert()
      const { error } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(error ?? 'Error de conexión — cita devuelta a su horario original')
    }
  }

  async function handleSave(data: Partial<Appointment> & { id?: string }) {
    const isEdit = !!data.id

    // Optimistic: cierra el modal y actualiza el calendario de inmediato
    closeModal()
    refetch()
    toast.success(isEdit ? 'Cita actualizada' : 'Cita agendada correctamente')

    const res = await fetch(
      isEdit ? `/api/appointments/${data.id}` : '/api/appointments',
      { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    )

    if (!res.ok) {
      // Rollback: revertir el optimismo si falló
      refetch()
      const { error } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(error ?? 'No se pudo guardar la cita')
      return
    }

    const json = await res.json()
    if (!isEdit && json.gcalSynced === false) {
      toast.info('Sin conexión con Google Calendar — se sincronizará pronto.')
    }
  }

  async function handleDelete(id: string) {
    closeModal()
    refetch()
    toast.success('Cita eliminada')

    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      refetch()
      toast.error('No se pudo eliminar la cita')
    }
  }

  return (
    <div className="flex flex-col">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Agenda</h1>
          <p className="text-sm text-[#86868b] mt-0.5">Gestión de citas clínicas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Filtro por médico — solo en modo multi-doctor */}
          {!isSingleDoctor && (
            <select
              value={filtroMedico}
              onChange={e => { setFiltroMedico(e.target.value); refetch() }}
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            >
              <option value="">Todos los médicos</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>{m.titulo ? `${m.titulo} ` : ''}{m.nombre}</option>
              ))}
            </select>
          )}
          {canEditHorario && (
            <button
              onClick={() => setHorarioOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              title="Configurar horario de consulta"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Horario</span>
            </button>
          )}
          <button
            onClick={() => { const now = new Date().toISOString(); setModal({ mode: 'create', start: now, end: addHour(now) }) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] transition-colors shadow-sm"
          >
            <Plus size={15} />
            Nueva cita
          </button>
        </div>
      </div>

      {/* ── Leyenda ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {isSingleDoctor ? (
          // Modo de un solo médico — leyenda por estado
          (Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: STATUS_STYLE[key as Status].bg, borderLeft: `3px solid ${STATUS_STYLE[key as Status].border}` }}
              />
              <span className="text-[11px] text-[#86868b] font-medium">{cfg.label}</span>
            </div>
          ))
        ) : (
          // Modo multi-doctor — leyenda por médico
          medicos.map((m, i) => {
            const c = DOCTOR_COLORS[i % DOCTOR_COLORS.length]
            return (
              <div key={m.id} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.border}` }}
                />
                <span className="text-[11px] text-[#86868b] font-medium">
                  {m.titulo ? `${m.titulo} ` : ''}{m.nombre}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* ── Calendario ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ minHeight: '70vh' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          locale={esLocale}
          headerToolbar={isMobile
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
          }
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          editable
          businessHours={horarioToBusinessHours(horario)}
          eventSources={[appointmentSource, gcalSource]}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          height="auto"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
        />
      </div>

      {/* ── Modal cita ──────────────────────────────────── */}
      {modal.mode !== 'closed' && (
        <AppointmentModal
          modal={modal}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
          medicos={medicos}
          isSingleDoctor={isSingleDoctor}
          defaultMedicoId={defaultMedicoId}
        />
      )}

      {/* ── Confirm ─────────────────────────────────────── */}
      {confirm && <ConfirmModal {...confirm} />}

      {/* ── Modal horario ────────────────────────────────── */}
      {horarioOpen && (
        <HorarioModal
          onClose={() => setHorarioOpen(false)}
          onSave={async (h) => {
            const res = await fetch('/api/me/horario', {
              method:  'PUT',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ horario: h }),
            })
            if (res.ok) {
              setHorario(h)
              setHorarioOpen(false)
              toast.success('Horario actualizado')
            } else {
              toast.error('No se pudo guardar el horario')
            }
          }}
        />
      )}
    </div>
  )
}
