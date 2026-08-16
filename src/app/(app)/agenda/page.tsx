'use client'

import { useEffect, useRef, useState, useCallback, useMemo, memo, type CSSProperties } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { EventClickArg, EventDropArg, DateSelectArg, EventInput, EventContentArg, DayHeaderContentArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { X, Calendar, User, Plus, Trash2, Settings, Lock, LayoutGrid, Columns3, Square, ChevronDown, FileText, Stethoscope, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica } from '@/lib/permissions'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import Portal from '@/components/ui/Portal'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultoriosDeMedico } from '@/hooks/useConsultoriosDeMedico'
import { componerNombreMedicoCompleto, componerInicialesMedico } from '@/lib/nombreMedico'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'

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
  gcal_sync_status: 'synced' | 'pending' | 'failed' | 'unbound'
  updated_at: string
  // F3-6: snapshots de consultorio (persistidos en POST/PUT, devueltos en GET).
  consultorio_id: string | null
  consultorio_nombre: string | null
  consultorio_nombre_corto: string | null
  consultorio_direccion: string | null
  consultorio_telefono: string | null
  consultorio_timezone: string | null
  pacientes?: { id: string; nombre: string; apellidos: string; telefono: string | null } | null
  medico?: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }

type Medico = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null; especialidad?: string | null }

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

/** Id de la eventSource de citas; ver `eventSourcesStable`. */
const FUENTE_APPOINTMENTS = 'appointments'

/** Prefijo del id temporal que lleva una cita aun no confirmada por el servidor. */
const PREFIJO_OPTIMISTA = 'optimistic-'

function calcDuration(startIso: string, endIso: string) {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + mins); return d.toISOString()
}

/* ─── F3-6e: helpers para badge de timezone ─── */
function regionDeTimezone(tz: string | null): string {
  if (!tz) return ''
  const zona = ZONAS_MEXICO.find(z => z.value === tz)
  if (!zona) return tz  // fallback al IANA crudo
  return zona.label.split('—')[0].trim()  // em-dash U+2014
}

function horaEnTZ(startTimeISO: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(startTimeISO))
  } catch {
    return ''
  }
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
      const queryNorm = query.trim().replace(/\s+/g, ' ')
      const { data } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos, telefono')
        .neq('activo', false)
        .or(`nombre.ilike.%${queryNorm}%,apellidos.ilike.%${queryNorm}%`)
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
    if (!res.ok) { setError(data.message ?? data.error ?? 'Error al crear paciente'); setSaving(false); return }
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
  modal, onClose, onSave, onDelete, medicos, defaultMedicoId,
  hideMedicoDropdown, medicoDropdownRequired, canVerExpediente,
}: {
  modal: ModalState
  onClose: () => void
  onSave: (data: Partial<Appointment> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  medicos: Medico[]
  defaultMedicoId: string
  hideMedicoDropdown: boolean
  medicoDropdownRequired: boolean
  canVerExpediente: boolean
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

  // F3-6: hook de consultorio activo (siempre disponible bajo el Provider).
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()

  // F3-6: hooks de consultorios. Se llaman AMBOS incondicionalmente (reglas
  // de hooks). El discriminador hideMedicoDropdown decide cuál se usa.
  // - hideMedicoDropdown=true → médico operando para sí (owner-scope).
  // - hideMedicoDropdown=false → admin/secretaria operando para otro médico.
  const ownerConsultorios = useConsultorios()
  const operativoConsultorios = useConsultoriosDeMedico(hideMedicoDropdown ? null : medicoId)

  const consultoriosList = hideMedicoDropdown
    ? ownerConsultorios.consultorios
    : operativoConsultorios.consultorios
  const consultorioDefaultDelTarget = hideMedicoDropdown
    ? ownerConsultorios.consultorioDefault
    : operativoConsultorios.consultorioDefault

  // F3-7b: solo si la cita es del médico autenticado y su consultorio existe en la lista
  const citaConsultorio = apt?.consultorio_id
    ? consultoriosList.find(c => c.id === apt.consultorio_id)
    : undefined
  const showIniciarConsulta =
    isEdit &&
    canVerExpediente &&
    paciente &&
    defaultMedicoId === apt?.medico_id &&
    citaConsultorio

  // State del consultorio seleccionado.
  // Pre-selección cascada: apt (edición) → activo del sidebar si está en lista
  // → default del target → vacío.
  const [consultorioId, setConsultorioId] = useState<string>(() => {
    if (apt?.consultorio_id) return apt.consultorio_id
    if (consultorioActivo && consultoriosList.some(c => c.id === consultorioActivo.id)) {
      return consultorioActivo.id
    }
    return consultorioDefaultDelTarget?.id ?? ''
  })

  // F3-6: reset al cambiar médico.
  // En edición sin cambio de médico: preservar snapshot.
  // En edición con cambio de médico, o creación: ajustar al default del nuevo target.
  useEffect(() => {
    if (apt && medicoId === apt.medico_id) return
    if (consultoriosList.some(c => c.id === consultorioId)) return
    const next = consultorioDefaultDelTarget?.id ?? ''
    setConsultorioId(next)
  }, [medicoId, consultoriosList, consultorioDefaultDelTarget?.id, apt, consultorioId])

  // Sincronizar default cuando profile carga después del mount inicial.
  // Solo aplica para creación de cita (no para edición de cita existente).
  useEffect(() => {
    if (!apt && defaultMedicoId && !medicoId) {
      setMedicoId(defaultMedicoId)
    }
  }, [defaultMedicoId, apt, medicoId])

  const { results, loading: searchLoading } = usePacientes(search)
  const showDropdown = showSearch && search.trim().length >= 2

  async function handleSave() {
    if (!paciente || !startTime) return

    // Defensa en profundidad: secretaria debe seleccionar médico
    // (el `required` HTML5 ya bloquea el submit, pero validamos aquí también)
    if (medicoDropdownRequired && !medicoId) return
    if (!consultorioId) return  // F3-6: consultorio obligatorio

    setSaving(true)
    const start_time = fromDatetimeLocal(startTime)

    // F3-6: enviar consultorio_id en creación SIEMPRE; en edición SOLO si cambió.
    // Evita re-validación innecesaria del consultorio en el backend cuando se edita
    // hora/status sin tocar consultorio.
    const consultorioChanged = !apt || consultorioId !== apt.consultorio_id

    await onSave({
      id:          apt?.id,
      title:       `${paciente.nombre} ${paciente.apellidos}`,
      start_time,
      end_time:    addMinutes(start_time, duration),
      notes:       notes.trim() || null,
      status,
      paciente_id: paciente.id,
      // El bloque optimista de handleSave pinta la tarjeta antes de que
      // responda el servidor; sin esto escribiria el paciente anterior.
      pacientes:   paciente ?? null,
      medico_id:   medicoId || null,
      ...(consultorioChanged ? { consultorio_id: consultorioId } : {}),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--ag-modal-overlay)' }} onClick={onClose} />
      <div className="relative rounded-[22px] w-full max-w-[480px] max-h-[92vh] flex flex-col animate-modal-enter overflow-hidden"
        style={{ background: 'var(--ag-modal-bg)', boxShadow: '0 30px 80px rgba(16, 32, 64, .28)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-[22px] py-[18px] border-b" style={{ borderColor: 'var(--ag-hairline)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-modal-icon-bg)' }}>
            <Calendar size={20} style={{ color: 'var(--ag-brand-primary)' }} />
          </div>
          <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--ag-ink)' }}>
            {isEdit ? 'Editar cita' : 'Nueva cita'}
          </h2>
          {canVerExpediente && paciente && (
            <Link
              href={`/expediente/${paciente.id}`}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <FileText size={14} />
              Expediente
            </Link>
          )}
          <button onClick={onClose} className={`${canVerExpediente && paciente ? '' : 'ml-auto'} p-1 transition-opacity hover:opacity-70`} style={{ color: 'var(--ag-muted2)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-5 space-y-4 flex-1 min-h-0 overflow-y-auto">

          {/* Paciente — campo principal y obligatorio */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Paciente <span className="text-red-500">*</span>
            </label>
            {paciente ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                style={{ background: 'var(--ag-patient-card-bg)', borderColor: 'var(--ag-patient-card-border)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-brand-secondary)' }}>
                    <span className="text-[10px] font-bold text-white">{paciente.nombre[0]}{paciente.apellidos[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>{paciente.nombre} {paciente.apellidos}</p>
                    {paciente.telefono && <p className="text-[11px]" style={{ color: 'var(--ag-brand-secondary)' }}>{paciente.telefono}</p>}
                  </div>
                </div>
                <button onClick={() => { setPaciente(null); setSearch('') }} className="transition-opacity hover:opacity-70" style={{ color: 'var(--ag-muted)' }}>
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
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
                {showDropdown && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
                    style={{ background: 'var(--ag-modal-bg)', borderColor: 'var(--ag-input-border)' }}>
                    {searchLoading && <div className="px-3 py-2.5 text-xs" style={{ color: 'var(--ag-muted)' }}>Buscando...</div>}
                    {results.map(p => (
                      <button key={p.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b last:border-0 hover:bg-[var(--ag-btn-ghost-hover)]"
                        style={{ borderColor: 'var(--ag-hairline)' }}
                        onClick={() => { setPaciente(p); setSearch(''); setShowSearch(false) }}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-brand-secondary)' }}>
                          <span className="text-[10px] font-bold text-white">{p.nombre[0]}{p.apellidos[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ag-ink)' }}>{p.nombre} {p.apellidos}</p>
                          {p.telefono && <p className="text-[11px]" style={{ color: 'var(--ag-muted)' }}>{p.telefono}</p>}
                        </div>
                      </button>
                    ))}
                    {/* Opción de registro rápido */}
                    {!searchLoading && (
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors border-t"
                        style={{ borderColor: 'var(--ag-hairline)' }}
                        onClick={() => { setShowSearch(false); setQuickCreate(true) }}
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <Plus size={13} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Registrar "{search}"</p>
                          <p className="text-[11px] text-emerald-600">Crear nuevo paciente y continuar</p>
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
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Fecha y hora de inicio
            </label>
            <input
              type="datetime-local"
              value={startTime}
              step={900}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
            />
          </div>

          {/* Duración */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Duración</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                  className="px-4 py-2 rounded-full text-[13px] font-bold border transition-all"
                  style={duration === d.value
                    ? { background: 'var(--ag-brand-primary)', color: '#fff', borderColor: 'var(--ag-brand-primary)' }
                    : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {startTime && (
              <p className="text-[12.5px] mt-2.5" style={{ color: 'var(--ag-muted)' }}>
                Termina a las{' '}
                <span className="font-bold" style={{ color: 'var(--ag-text)' }}>
                  {toDatetimeLocal(addMinutes(fromDatetimeLocal(startTime), duration)).slice(11, 16)}
                </span>
              </p>
            )}
          </div>

          {/* Estado (solo edición) */}
          {isEdit && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Estado</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => {
                  const on = status === key
                  return (
                    <button key={key} onClick={() => setStatus(key)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={on
                        ? { background: `var(--ag-status-${key}-bg)`, color: `var(--ag-status-${key}-text)`, border: `1.5px solid var(--ag-status-${key}-dot)` }
                        : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', border: '1.5px solid var(--ag-input-border)' }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(--ag-status-${key}-dot)` }} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Médico — ocultado para médicos sin admin y para clínicas single-doctor */}
          {!hideMedicoDropdown && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                Médico {medicoDropdownRequired && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <select
                  value={medicoId}
                  onChange={e => setMedicoId(e.target.value)}
                  required={medicoDropdownRequired}
                  className="w-full pl-3 pr-9 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer"
                >
                  {!medicoDropdownRequired && <option value="">Sin asignar</option>}
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ag-muted)' }} />
              </div>
            </div>
          )}

          {/* F3-6: Dropdown de consultorios. Siempre visible. */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Consultorio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={consultorioId}
                onChange={e => setConsultorioId(e.target.value)}
                required
                disabled={consultoriosList.length === 0}
                className="w-full pl-3 pr-9 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {consultoriosList.length === 0 ? (
                  <option value="">Sin consultorios disponibles</option>
                ) : (
                  <>
                    <option value="">— Selecciona consultorio —</option>
                    {consultoriosList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.es_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ag-muted)' }} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instrucciones, observaciones..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-[22px] py-3.5 border-t flex items-center gap-2" style={{ borderColor: 'var(--ag-hairline)' }}>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={deleting ? 'Eliminando...' : 'Eliminar cita'}
              aria-label={deleting ? 'Eliminando cita' : 'Eliminar cita'}
              className="flex items-center justify-center p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
          {showIniciarConsulta && (
            <Link
              href={`/expediente/${paciente.id}/nueva-nota`}
              onClick={() => {
                cambiarActivo(citaConsultorio!)
                onClose()
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <Stethoscope size={15} />
              Iniciar consulta
            </Link>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]" style={{ color: 'var(--ag-muted)' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !paciente || !startTime || !consultorioId}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]">
              {saving ? 'Guardando...' : 'Guardar'}
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

/* ─── Renderer de eventos (estilo Google) — memoizado ──── */

type EventColor = { bg: string; text: string; border: string }

/* Breakpoints de altura renderizada de la tarjeta (px). El tier se decide
   midiendo el alto real del contenedor con ResizeObserver (ver abajo): es
   lo más fiable con FullCalendar, cuyo alto de evento depende de la duración
   y del alto de hora del grid, no calculable con certeza solo desde datos.
   Calibrados al grid real: slot de 30min = 2.16rem ≈ 34.56px (globals.css),
   así una cita de 1h ≈ 69.12px → cae en 'full' y el layout (con line-heights
   ajustados abajo) cabe sin recortar el nombre. */
const CARD_TINY_MAX = 40
const CARD_COMPACT_MAX = 56

/* Estilo neutro del chip de médico (handoff). El contenido (2 iniciales,
   solo multi-doctor) lo decide el event source; aquí solo se estiliza. */
const CHIP_STYLE: CSSProperties = {
  fontSize: '9px', fontWeight: 800, letterSpacing: '.02em',
  borderRadius: '5px', padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
  background: 'var(--ag-chip-bg)', color: 'var(--ag-chip-text)',
}
const NAME_BASE: CSSProperties = {
  fontSize: '12px', fontWeight: 700, color: 'var(--ag-ink)', lineHeight: 1.25,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
  // flexShrink:0 → el nombre nunca se comprime; ante desborde se recorta la
  // fila de estado (última), nunca el nombre.
  flexShrink: 0,
}
const STATUS_DOT: CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
}
const tzDiffStyle: CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 500,
  lineHeight: 1.2,
  color: 'var(--ag-muted)',
  fontStyle: 'italic',
}

const MemoizedEventContent = memo(function MemoizedEventContent({
  timeText, title, pacNombre, status, doctorInitial, tzDiff,
}: {
  timeText: string; title: string; pacNombre: string | null
  status: Status; doctorInitial?: string; tzDiff?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  // Mide el alto real asignado por FullCalendar (root con height:100%).
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setHeight(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // height null = aún sin medir → 'full' hasta el primer ResizeObserver.
  const tier: 'tiny' | 'compact' | 'full' =
    height == null ? 'full'
      : height < CARD_TINY_MAX ? 'tiny'
        : height < CARD_COMPACT_MAX ? 'compact'
          : 'full'

  const dot = `var(--ag-status-${status}-dot)`
  const txt = `var(--ag-status-${status}-text)`
  const isCancelled = status === 'cancelled'
  const name = pacNombre ?? title

  const root: CSSProperties = {
    height: '100%', boxSizing: 'border-box', overflow: 'hidden', cursor: 'pointer',
    background: `var(--ag-status-${status}-bg)`,
    border: `1px solid var(--ag-status-${status}-border)`,
    borderLeft: `3.5px solid ${dot}`,
    borderRadius: '9px',
    boxShadow: 'var(--ag-shadow-card)',
    display: 'flex', flexDirection: 'column', gap: '1px',
    justifyContent: tier === 'tiny' ? 'center' : 'flex-start',
    padding: tier === 'tiny' ? '2px 8px' : '4px 9px',
    opacity: isCancelled ? 0.7 : 1,
  }
  const nameStyle: CSSProperties = isCancelled
    ? { ...NAME_BASE, textDecoration: 'line-through' }
    : NAME_BASE
  const chip = doctorInitial ? <span style={CHIP_STYLE}>{doctorInitial}</span> : null

  // tiny: punto de estado + nombre, una fila centrada. Sin hora ni chip.
  if (tier === 'tiny') {
    return (
      <div ref={rootRef} style={root}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <span style={{ ...STATUS_DOT, background: dot }} />
          <span style={nameStyle}>{name}</span>
        </div>
      </div>
    )
  }

  const timeRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
      <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.2, color: 'var(--ag-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {timeText}
      </span>
      {chip}
    </div>
  )

  // compact: fila hora + chip, luego nombre. Sin fila de estado.
  if (tier === 'compact') {
    return (
      <div ref={rootRef} style={root}>
        {timeRow}
        <span style={nameStyle}>{name}</span>
        {tzDiff && <span style={tzDiffStyle}>{tzDiff}</span>}
      </div>
    )
  }

  // full: fila hora + chip, nombre, fila (punto + estado corto).
  return (
    <div ref={rootRef} style={root}>
      {timeRow}
      <span style={nameStyle}>{name}</span>
      {tzDiff && <span style={tzDiffStyle}>{tzDiff}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ ...STATUS_DOT, background: dot }} />
        <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.2, color: txt }}>{STATUS_CONFIG[status].label}</span>
      </div>
    </div>
  )
})

/* Logo oficial "G" de Google (4 colores), SVG inline. Sin dependencias ni
   assets externos. Tamaño por prop (12px en la tarjeta). */
function GoogleGIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

/* Tarjeta de evento externo de Google Calendar (no arrastrable). Solo
   presentación: la lógica de fetch/dedupe de Google no se toca. */
const GoogleEventCard = memo(function GoogleEventCard({
  timeText, title,
}: { timeText: string; title: string }) {
  const label = title.replace(/^🔒\s*/, '') // el emoji lo agrega gcalSource; aquí se muestra el icono
  return (
    <div style={{
      height: '100%', boxSizing: 'border-box', overflow: 'hidden',
      color: 'var(--ag-gcal-text)',
      border: '1px dashed var(--ag-gcal-border)',
      borderLeft: '3px solid var(--ag-gcal-accent)',
      borderRadius: '9px', padding: '5px 9px',
      background: 'repeating-linear-gradient(135deg, var(--ag-gcal-bg1), var(--ag-gcal-bg1) 8px, var(--ag-gcal-bg2) 8px, var(--ag-gcal-bg2) 9px)',
      display: 'flex', flexDirection: 'column', gap: '2px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
        <GoogleGIcon size={12} />
        <Lock size={11} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '10.5px', fontWeight: 600, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {timeText}
        </span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  )
})

/* Chip plano de cita para la Vista Mes (dayGridMonth). Branch DEDICADO: NO
   comparte chrome con MemoizedEventContent (tarjetas de Semana/Día). Una sola
   fila: marcador (punto por estado o "G" de Google) + hora (700) + nombre
   (ellipsis). Sin border/sombra/fondo de tarjeta. */
const MonthChip = memo(function MonthChip({ arg }: { arg: EventContentArg }) {
  const ext = arg.event.extendedProps as (Appointment & { doctorInitial?: string }) & { isGcalBlock?: boolean }
  const isGcal = !!ext?.isGcalBlock
  const status = ext?.status
  const isCancelled = status === 'cancelled'
  // Google: quitar el 🔒 que agrega gcalSource (el ícono G ya lo distingue).
  const name = isGcal ? arg.event.title.replace(/^🔒\s*/, '') : arg.event.title

  const marker = isGcal
    ? <GoogleGIcon size={10} />
    : <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: status ? `var(--ag-status-${status}-dot)` : 'var(--ag-muted)' }} />

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
      fontSize: 11, color: 'var(--ag-text)', cursor: 'pointer', overflow: 'hidden',
      opacity: isCancelled ? 0.62 : 1,
    }}>
      {marker}
      {arg.timeText && (
        <span style={{ fontWeight: 700, color: 'var(--ag-muted)', flex: '0 0 auto' }}>{arg.timeText}</span>
      )}
      <span style={{
        fontWeight: 600, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textDecoration: isCancelled ? 'line-through' : 'none',
      }}>{name}</span>
    </div>
  )
})

function renderEventContent(arg: EventContentArg, navegadorTZ: string) {
  // Vista Mes: chip plano dedicado. El camino de Semana/Día (abajo) queda intacto.
  if (arg.view.type === 'dayGridMonth') return <MonthChip arg={arg} />
  const ext = arg.event.extendedProps as (Appointment & { doctorInitial?: string }) & { isGcalBlock?: boolean }
  if (ext?.isGcalBlock) {
    return <GoogleEventCard timeText={arg.timeText} title={arg.event.title} />
  }
  if (!ext?.status) return <>{arg.event.title}</>
  const pac = ext.pacientes

  // F3-6e: badge de hora en TZ del consultorio si la hora resultante difiere
  // de la hora en TZ del navegador. Comparamos horas resultantes, no strings
  // IANA, para evitar falsos positivos entre zonas del mismo offset (las 8
  // zonas UTC-6 mexicanas son IANA distintas pero comparten hora de pared).
  let tzDiff: string | undefined
  const consultorioTZ = ext.consultorio_timezone
  // F3-6e: usar arg.event.start (Date) en vez de ext.start_time (ISO de extendedProps)
  // para que el badge se actualice correctamente tras drag/resize. FullCalendar
  // actualiza arg.event.start automáticamente, pero NO toca extendedProps.start_time.
  const startISO = arg.event.start?.toISOString()
  if (consultorioTZ && startISO) {
    const horaConsultorio = horaEnTZ(startISO, consultorioTZ)
    const horaNavegador = horaEnTZ(startISO, navegadorTZ)
    if (horaConsultorio && horaConsultorio !== horaNavegador) {
      const region = regionDeTimezone(consultorioTZ)
      tzDiff = `${horaConsultorio} hora ${region}`
    }
  }

  return (
    <MemoizedEventContent
      timeText={arg.timeText}
      title={ext.title}
      pacNombre={pac ? `${pac.nombre} ${pac.apellidos}` : null}
      status={ext.status}
      doctorInitial={ext.doctorInitial}
      tzDiff={tzDiff}
    />
  )
}

/* ─── Página principal ─────────────────────────────────── */

// Segmentos del control de vistas. Íconos lucide representativos:
// LayoutGrid (rejilla = Mes), Columns3 (columnas = Semana), Square (Día).
const VIEWS = [
  { type: 'dayGridMonth', label: 'Mes',    icon: LayoutGrid },
  { type: 'timeGridWeek', label: 'Semana', icon: Columns3 },
  { type: 'timeGridDay',  label: 'Día',    icon: Square },
] as const

export default function AgendaPage() {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const [modal,        setModal]        = useState<ModalState>({ mode: 'closed' })
  const [isMobile,     setIsMobile]     = useState(false)
  const [currentView,  setCurrentView]  = useState<string>('timeGridWeek')
  const [horario,      setHorario]      = useState<Horario>(HORARIO_DEFAULT)
  const [horarioOpen,  setHorarioOpen]  = useState(false)
  const [confirm,      setConfirm]      = useState<{ message: string; onConfirm: () => void; onCancel: () => void } | null>(null)
  const [citaCreada,   setCitaCreada]   = useState(false)
  const [medicos,      setMedicos]      = useState<Medico[]>([])
  const [filtroMedico, setFiltroMedico] = useState<string>('')
  const { profile, isDoctor } = useProfile()
  const toast = useToast()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()

  const isMedicoSinAdmin = profile?.role === 'medico' && !profile?.es_admin_de_clinica
  const isMedicoConAdmin = profile?.role === 'medico' && profile?.es_admin_de_clinica === true
  const isSecretaria = profile?.role === 'secretaria'

  const canEditHorario  = canManageClinica(profile)
  const isSingleDoctor  = medicos.length <= 1
  const defaultMedicoId = useMemo(() => {
    // Médico (admin o no): default es él mismo
    if (profile?.role === 'medico' && profile?.id) return profile.id
    // Clínica single-doctor: el único médico
    if (isSingleDoctor && medicos[0]?.id) return medicos[0].id
    // Secretaria u otros: sin default (obligar elección)
    return ''
  }, [profile, isSingleDoctor, medicos])

  // F3-6e: TZ del navegador (estable) + wrapper para inyectarla a renderEventContent.
  const navegadorTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )

  const renderEC = useCallback(
    (arg: EventContentArg) => renderEventContent(arg, navegadorTZ),
    [navegadorTZ]
  )

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

  /* ── Refetch al cambiar el filtro de médico ─────────────
     Se dispara DESPUÉS del commit del estado (no en el onChange síncrono),
     cuando appointmentSourceRef.current ya apunta al appointmentSource
     recreado con el filtroMedico nuevo → el fetch sale con el médico
     correcto. El guard de primer render evita el doble fetch en montaje
     (FullCalendar ya hace su fetch inicial por sí mismo). */
  const filtroFirstRender = useRef(true)
  useEffect(() => {
    if (filtroFirstRender.current) { filtroFirstRender.current = false; return }
    refetch()
  }, [filtroMedico])

  // F3-6 fix: refetch al cargar médicos para que el chip se calcule con
  // isSingleDoctor correcto. En el primer render medicos=[] → isSingleDoctor=true,
  // el closure de appointmentSource captura ese valor y no calcula doctorInitial.
  // Cuando médicos cargan, este efecto fuerza un refetch que reevalúa con el
  // closure nuevo (isSingleDoctor=false en clínicas multi-médico).
  const firstRenderMedicosRef = useRef(true)
  useEffect(() => {
    if (firstRenderMedicosRef.current) { firstRenderMedicosRef.current = false; return }
    refetch()
  }, [isSingleDoctor])

  /* ── Supabase Realtime — debounced (max 1 refetch/sec) ── */
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        if (realtimeTimer.current) return // ya hay un refetch pendiente
        realtimeTimer.current = setTimeout(() => {
          realtimeTimer.current = null
          refetch()
        }, 1000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
    }
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
        // Color = ESTADO (siempre). El médico solo se identifica por el chip.
        const colorStyle = STATUS_STYLE[apt.status] ?? STATUS_STYLE.scheduled
        let doctorInitial: string | undefined
        if (!isSingleDoctor && apt.medico_id) {
          const m = apt.medico
          if (m) doctorInitial = componerInicialesMedico(m)
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
    } catch (err: unknown) {
      failure(err instanceof Error ? err : new Error('Error cargando citas'))
    }
  }, [isSingleDoctor, filtroMedico])

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

      type GCalEvent = { id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }
      const eventos = (data.events as GCalEvent[])
        .filter((e) => e.id && !appGcalIds.has(e.id))
        .map((e) => ({
          id:              `gcal-${e.id}`,
          title:           `🔒 ${e.summary || 'Ocupado'}`,
          start:           e.start?.dateTime ?? e.start?.date ?? '',
          end:             e.end?.dateTime ?? e.end?.date ?? undefined,
          allDay:          !e.start?.dateTime,
          // Harness transparente: la GoogleEventCard pinta su propio fondo/borde.
          backgroundColor: 'transparent',
          borderColor:     'transparent',
          textColor:       '#6d4ec0',
          editable:        false,
          extendedProps:   { isGcalBlock: true },
        }))

      success(eventos)
    } catch (err: unknown) {
      failure(err instanceof Error ? err : new Error('Error cargando eventos'))
    }
  }, [])

  /* ── Stable eventSources ref (evita re-registro en cada render) ── */
  const appointmentSourceRef = useRef(appointmentSource)
  appointmentSourceRef.current = appointmentSource
  const gcalSourceRef = useRef(gcalSource)
  gcalSourceRef.current = gcalSource

  const stableAppointmentSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) =>
      appointmentSourceRef.current(info, success, failure),
    []
  )
  const stableGcalSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) =>
      gcalSourceRef.current(info, success, failure),
    []
  )
  /**
   * Las fuentes llevan `id` explicito porque `api.addEvent(input, sourceId)`
   * resuelve la fuente por ese id (si no la encuentra devuelve null y avisa
   * por consola). Un evento añadido sin sourceId no pertenece a ninguna
   * fuente y `refetchEvents()` no lo purga: sobrevive junto al evento
   * recargado del servidor y quedan dos con el mismo ID (E5-DT-8).
   */
  const eventSourcesStable = useMemo(() => [
    { id: FUENTE_APPOINTMENTS, events: stableAppointmentSource },
    { id: 'gcal',              events: stableGcalSource },
  ], [stableAppointmentSource, stableGcalSource])

  /* ── Helper: construir EventInput desde datos de cita ── */
  function buildEventInput(data: Partial<Appointment> & { id?: string }): EventInput {
    const status = data.status ?? 'scheduled'
    // Color = ESTADO (siempre). El médico solo se identifica por el chip.
    const colorStyle: EventColor = STATUS_STYLE[status] ?? STATUS_STYLE.scheduled
    let doctorInitial: string | undefined
    if (!isSingleDoctor && data.medico_id) {
      const m = medicos.find(m => m.id === data.medico_id)
      if (m) doctorInitial = componerInicialesMedico(m)
    }

    return {
      id:              data.id ?? `${PREFIJO_OPTIMISTA}${Date.now()}`,
      title:           data.title ?? '',
      start:           data.start_time,
      end:             data.end_time,
      backgroundColor: 'transparent',
      borderColor:     'transparent',
      textColor:       colorStyle.text,
      extendedProps:   { ...data, colorStyle, doctorInitial },
    }
  }

  /**
   * Re-hidrata un evento del calendario con la fila canonica que devolvio el
   * servidor. Sustituye extendedProps en bloque en vez de campo por campo:
   * ese era el bug — se sincronizaban 6 campos a mano y `updated_at` no
   * estaba entre ellos, asi que el segundo guardado de una misma cita
   * mandaba un valor viejo y el servidor respondia 409.
   */
  function aplicarAppointmentAlEvento(appointment: Partial<Appointment> & { id?: string }) {
    if (!appointment?.id) return
    const existing = calendarRef.current?.getApi()?.getEventById(appointment.id)
    if (!existing) return

    const input = buildEventInput(appointment)
    if (appointment.start_time) existing.setStart(appointment.start_time)
    if (appointment.end_time)   existing.setEnd(appointment.end_time)
    existing.setProp('title', appointment.title ?? '')
    if (input.textColor) existing.setProp('textColor', input.textColor as string)

    for (const [clave, valor] of Object.entries(input.extendedProps ?? {})) {
      existing.setExtendedProp(clave, valor)
    }
  }

  /* ── Handlers ────────────────────────────────────────── */
  function handleDateClick(arg: DateClickArg) {
    // Fase 8.2: bloqueo creación de citas si suscripción cancelada con >5 pacientes
    if (subState.isBlocked) { openBloqueoModal(); return }
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
    // Fase 8.2: idem handleDateClick
    if (subState.isBlocked) { openBloqueoModal(); return }
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
    // FullCalendar ya movió el evento visualmente — solo sincronizar con servidor
    ejecutarDrop(id, start_time, end_time, arg)
  }

  async function ejecutarDrop(id: string, start_time: string, end_time: string | undefined, arg: EventDropArg | EventResizeDoneArg) {
    // Guarda: un id temporal no existe en la base, el PUT devolveria un error
    // sin sentido. El evento optimista ya nace con `editable: false`, asi que
    // esto solo cubre cualquier camino futuro que se nos escape.
    if (id.startsWith(PREFIJO_OPTIMISTA)) { arg.revert(); return }

    const res = await fetch(`/api/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ start_time, end_time }),
    })

    if (!res.ok) {
      arg.revert()
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'Error de conexión — cita devuelta a su horario original')
      return
    }

    toast.success('Cita reagendada')

    // Sin esto, extendedProps.updated_at se queda con el valor de la carga
    // inicial y la siguiente edicion por formulario falla con 409.
    const json = await res.json().catch(() => null)
    if (json?.appointment) aplicarAppointmentAlEvento(json.appointment)

    // Glow verde de confirmación
    const el = arg.el as HTMLElement | null
    if (el) {
      el.classList.add('fc-event-drop-success')
      setTimeout(() => el.classList.remove('fc-event-drop-success'), 700)
    }
  }

  async function handleEventResize(arg: EventResizeDoneArg) {
    if (arg.event.extendedProps.isGcalBlock) { arg.revert(); return }
    const id         = arg.event.id
    const start_time = arg.event.start?.toISOString()
    const end_time   = arg.event.end?.toISOString()
    if (!start_time) { arg.revert(); return }
    ejecutarDrop(id, start_time, end_time, arg)
  }

  async function handleSave(data: Partial<Appointment> & { id?: string }) {
    const isEdit = !!data.id
    const api = calendarRef.current?.getApi()

    // ── Optimistic update: inyectar/actualizar evento en FullCalendar al instante ──
    closeModal()
    toast.success(isEdit ? 'Cita actualizada' : 'Cita agendada correctamente')
    if (!isEdit) setCitaCreada(true)

    let optimisticEvent: ReturnType<NonNullable<typeof api>['addEvent']> | null = null

    if (api) {
      if (isEdit) {
        // Actualizar el evento existente in-place
        const existing = api.getEventById(data.id!)
        if (existing) {
          if (data.start_time) existing.setStart(data.start_time)
          if (data.end_time)   existing.setEnd(data.end_time)
          if (data.title)      existing.setProp('title', data.title)
          // Actualizar extendedProps con nuevo color/status
          const ev = buildEventInput(data)
          existing.setExtendedProp('status', data.status ?? existing.extendedProps.status)
          existing.setExtendedProp('colorStyle', ev.extendedProps?.colorStyle)
          existing.setExtendedProp('notes', data.notes ?? existing.extendedProps.notes)
          existing.setExtendedProp('pacientes', data.pacientes ?? null)
          // F3-6 fix Bug 1: actualizar también médico y consultorio_id (optimistic).
          existing.setExtendedProp('doctorInitial', ev.extendedProps?.doctorInitial)
          existing.setExtendedProp('medico_id', data.medico_id ?? null)
          existing.setExtendedProp('consultorio_id', data.consultorio_id ?? existing.extendedProps.consultorio_id)
        }
      } else {
        // Crear evento optimista temporal. `editable: false` cubre arrastre y
        // redimension a la vez: una cita que todavia no existe en la base no
        // tiene id que mandarle al servidor, solo el temporal.
        optimisticEvent = api.addEvent({ ...buildEventInput(data), editable: false }, FUENTE_APPOINTMENTS)
      }
    }

    // ── Llamada real al API ──
    const res = await fetch(
      isEdit ? `/api/appointments/${data.id}` : '/api/appointments',
      { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    )

    if (!res.ok) {
      // Rollback: remover evento optimista y refrescar desde servidor
      if (optimisticEvent) optimisticEvent.remove()
      refetch()
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'No se pudo guardar la cita')
      return
    }

    const json = await res.json()

    if (isEdit && json.appointment) {
      aplicarAppointmentAlEvento(json.appointment)
    }

    if (!isEdit && optimisticEvent && json.appointment?.id) {
      // Reemplazar evento optimista con el real (que tiene ID de DB). Si un
      // refetch corrio durante el POST, la cita ya llego del servidor: hay que
      // re-hidratarla, no agregarla de nuevo — serian dos con el mismo id.
      optimisticEvent.remove()
      const yaPresente = api?.getEventById(json.appointment.id)
      if (yaPresente) {
        aplicarAppointmentAlEvento(json.appointment)
      } else {
        api?.addEvent(buildEventInput({ ...data, ...json.appointment }), FUENTE_APPOINTMENTS)
      }
    }

    if (!isEdit && json.gcalSynced === false) {
      toast.info('Sin conexión con Google Calendar — se sincronizará pronto.')
    }
  }

  async function handleDelete(id: string) {
    closeModal()
    toast.success('Cita eliminada')

    // Optimistic: remover evento del calendario al instante
    const api = calendarRef.current?.getApi()
    const existing = api?.getEventById(id)
    existing?.remove()

    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      // Rollback: restaurar estado desde servidor
      refetch()
      toast.error('No se pudo eliminar la cita')
    }
  }

  // Header de día apilado para Semana/Día. Mes (sub-fase 7) conserva su
  // header por defecto devolviendo arg.text sin tocar. El estado "inhábil"
  // se deriva del MISMO objeto `horario` que alimenta businessHours (no se
  // inventa lógica de horario): un día es hábil si horario[dia].activo === true.
  function renderDayHeader(arg: DayHeaderContentArg) {
    if (arg.view.type === 'dayGridMonth') return arg.text

    const diaInfo = DIAS.find(d => d.fc === arg.date.getDay())
    const habil   = diaInfo ? (horario[diaInfo.key]?.activo ?? false) : false
    const abbr    = diaInfo ? diaInfo.label.slice(0, 3).toUpperCase() : arg.text

    // Color por estado: HOY (blanco) > inhábil (atenuado) > hábil normal.
    let dowColor: string, numColor: string
    if (arg.isToday)  { dowColor = 'rgba(255,255,255,.72)'; numColor = '#fff' }
    else if (!habil)  { dowColor = 'var(--ag-faint)';       numColor = 'var(--ag-muted2)' }
    else              { dowColor = 'var(--ag-muted)';       numColor = 'var(--ag-text)' }

    return (
      <span className="ag-dayhead">
        <span className="ag-dayhead-dow" style={{ color: dowColor }}>{abbr}</span>
        <span className="ag-dayhead-num" style={{ color: numColor }}>{arg.date.getDate()}</span>
      </span>
    )
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
          {/* Segmented control de vistas — desktop only (móvil queda fijo en Día,
              igual que hoy). Sincronizado con la vista real vía datesSet. */}
          {!isMobile && (
            <div
              role="tablist"
              aria-label="Vista del calendario"
              className="inline-flex"
              style={{ background: 'var(--ag-segment-bg)', borderRadius: 10, padding: 3, gap: 2 }}
            >
              {VIEWS.map(v => {
                const active = currentView === v.type
                const Ico = v.icon
                return (
                  <button
                    key={v.type}
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      const api = calendarRef.current?.getApi()
                      if (!api) return
                      api.changeView(v.type)
                      setCurrentView(v.type)
                    }}
                    className={`inline-flex items-center gap-1.5 transition-all ${active ? '' : 'hover:opacity-70'}`}
                    style={{
                      border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 13px',
                      fontSize: 12.5, fontWeight: active ? 700 : 600,
                      ...(active
                        ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                        : { background: 'transparent', color: 'var(--ag-segment-text)' }),
                    }}
                  >
                    <Ico size={15} />
                    {v.label}
                  </button>
                )
              })}
            </div>
          )}
          {/* Filtro por médico — solo en modo multi-doctor */}
          {!isSingleDoctor && (
            <div className="relative">
              <select
                value={filtroMedico}
                onChange={e => setFiltroMedico(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              >
                <option value="">Todos los médicos</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ag-muted)]"
              />
            </div>
          )}
          {canEditHorario && (
            <button
              onClick={() => setHorarioOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              title="Configurar horario de consulta"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Horario</span>
            </button>
          )}
          <button
            onClick={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              const now = new Date().toISOString()
              setModal({ mode: 'create', start: now, end: addHour(now) })
            }}
            data-onboard="nueva-cita"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
          >
            <Plus size={15} />
            Nueva cita
          </button>
        </div>
      </div>

      {citaCreada && <div data-onboard="cita-creada" className="hidden" />}

      {/* ── Leyenda ─────────────────────────────────────── */}
      {/* Solo single-doctor: leyenda por estado. La leyenda multi-doctor
          (puntos de color por médico) se eliminó: las tarjetas ya no se
          colorean por médico, así que prometía un código de color inexistente. */}
      {isSingleDoctor && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: STATUS_STYLE[key as Status].bg, borderLeft: `3px solid ${STATUS_STYLE[key as Status].border}` }}
              />
              <span className="text-[11px] text-[#86868b] font-medium">{cfg.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendario ──────────────────────────────────── */}
      <div className="agenda-fc bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ minHeight: '70vh' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          locale={esLocale}
          headerToolbar={isMobile
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: '' }
          }
          datesSet={arg => setCurrentView(arg.view.type)}
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          dayMaxEvents={3}
          nowIndicator
          selectable
          selectMirror
          editable
          dragRevertDuration={200}
          eventResizableFromStart
          businessHours={horarioToBusinessHours(horario)}
          eventSources={eventSourcesStable}
          dayHeaderContent={renderDayHeader}
          eventContent={renderEC}
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
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
          defaultMedicoId={defaultMedicoId}
          hideMedicoDropdown={isSingleDoctor || isMedicoSinAdmin}
          medicoDropdownRequired={isSecretaria || isMedicoConAdmin}
          canVerExpediente={isDoctor}
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
