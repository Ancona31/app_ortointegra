'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus, Users, ChevronRight, CalendarDays, CalendarPlus, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente } from '@/types'
import { format, parseISO } from 'date-fns'
import { calcularEdad } from '@/lib/patientUtils'
import { es } from 'date-fns/locale'
import { StatusChip } from './StatusChip'
import { formatCitaHora } from './utils'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

type ProximaCita = {
  id: string
  title: string
  start_time: string
  status: string
  paciente_id: string | null
  pacientes: { nombre: string; apellidos: string } | null
  medico: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

type Medico = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null }

export default function AsistenteDashboard() {
  const { profile } = useProfile()
  const [recientes,     setRecientes]     = useState<Paciente[]>([])
  const [proximasCitas, setProximasCitas] = useState<ProximaCita[]>([])
  const [medicos,       setMedicos]       = useState<Medico[]>([])
  const [filtroMedico,  setFiltroMedico]  = useState<string>('todos')
  const [loadingCitas,  setLoadingCitas]  = useState(true)

  const hoy = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes')
      .select('*')
      .neq('activo', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }: { data: Paciente[] | null }) => setRecientes(data || []))
  }, [])

  useEffect(() => {
    if (!profile?.clinica_id) return
    const supabase = createClient()

    async function fetchCitas() {
      // Médicos de la clínica
      const { data: medicosData } = await supabase
        .from('profiles')
        .select('id, titulo, nombres, apellido_paterno, apellido_materno')
        .eq('clinica_id', profile!.clinica_id!)
        .eq('role', 'medico')
        .order('apellido_paterno')
      setMedicos((medicosData as Medico[]) ?? [])

      // Próximas citas de toda la clínica
      const { data: citasData } = await supabase
        .from('appointments')
        .select('id, title, start_time, status, paciente_id, pacientes(nombre, apellidos), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)')
        .eq('clinica_id', profile!.clinica_id!)
        .gt('start_time', new Date().toISOString())
        .in('status', ['scheduled', 'confirmed'])
        .order('start_time', { ascending: true })
        .limit(8)
      setProximasCitas((citasData as any) ?? [])
      setLoadingCitas(false)
    }

    fetchCitas()
  }, [profile])

  const displayCitas = filtroMedico === 'todos'
    ? proximasCitas
    : proximasCitas.filter(c => c.medico?.id === filtroMedico)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Saludo */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] rounded-2xl px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Bienvenida</p>
        <p className="text-xl font-bold mb-1 capitalize">{hoy}</p>
        <p className="text-sm opacity-75">Consultorio Dr. Angel M. Ancona Pérez</p>
      </div>

      {/* Próximas citas */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CalendarDays size={13} className="text-white/70" />
            <p className="text-[11px] font-semibold text-white uppercase tracking-widest">Próximas citas</p>
          </div>
          <div className="flex items-center gap-3">
            {medicos.length > 1 && (
              <select
                value={filtroMedico}
                onChange={e => setFiltroMedico(e.target.value)}
                className="text-xs text-white border border-white/30 rounded-lg px-2 py-1 bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="todos" className="text-[#1d1d1f]">Todos los médicos</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id} className="text-[#1d1d1f]">{componerNombreMedicoCompleto(m)}</option>
                ))}
              </select>
            )}
            <Link href="/agenda" className="text-[10px] text-white/70 hover:text-white hover:underline">Ver agenda →</Link>
          </div>
        </div>

        {loadingCitas ? (
          <div className="px-5 py-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
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
                  {cita.medico && (
                    <span>· {componerNombreMedicoCompleto(cita.medico)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#86868b] px-5 py-5 text-center">No hay citas agendadas</p>
        )}
      </div>

      {/* Acción principal */}
      <Link href="/pacientes/nuevo"
        className="flex items-center justify-between p-6 bg-white rounded-2xl border-2 border-[#1e5fa8] hover:bg-blue-50 transition-all group shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1e5fa8] rounded-xl flex items-center justify-center">
            <UserPlus size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[#1a3a5c] text-lg">Registrar nuevo paciente</p>
            <p className="text-slate-500 text-sm">Datos básicos de ingreso</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-[#1e5fa8] group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Agendar nueva cita */}
      <Link href="/agenda"
        className="flex items-center justify-between p-6 bg-white rounded-2xl border-2 border-[#1e5fa8] hover:bg-blue-50 transition-all group shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1e5fa8] rounded-xl flex items-center justify-center">
            <CalendarPlus size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[#1a3a5c] text-lg">Agendar nueva cita</p>
            <p className="text-slate-500 text-sm">Abrir la agenda de la clínica</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-[#1e5fa8] group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Pacientes recientes */}
      {recientes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Users size={15} className="text-slate-500" />
            <h2 className="font-semibold text-slate-700 text-sm">Últimos pacientes registrados</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recientes.map(p => {
              const edad = p.fecha_nacimiento
                ? calcularEdad(p.fecha_nacimiento)
                : null
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{p.nombre} {p.apellidos}</p>
                      <p className="text-xs text-slate-400">
                        {edad !== null ? `${edad.textoElegante} · ` : ''}
                        {p.created_at ? format(parseISO(p.created_at), "d MMM yyyy", { locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                    Registrado
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
