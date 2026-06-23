'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Stethoscope, FileText, LayoutDashboard,
  ChevronRight, UserCircle, Zap,
  CalendarDays, Users,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import ParticleCanvas from '@/components/launcher/ParticleCanvas'
import { useTheme } from '@/components/launcher/ThemeContext'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useClinica } from '@/hooks/useClinica'
import { useProfile } from '@/hooks/useProfile'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { hoyEnTZ, desplazarFecha, fechaHoraLocalAInstante } from '@/lib/dates'

type GridMode = 'sin_pacientes' | 'nuevo' | 'activo'

interface EstadoPerfil {
  porcentaje: number
  requiereOnboarding: boolean
  gridMode: GridMode
  role: string
  plan: string
  planNombre: string
  suscripcion_estado: string
}

const FRASES_MOTIVACIONALES = [
  'Listo para hacer la diferencia',
  'Tus pacientes te esperan',
  'Otro día para transformar vidas',
  'La excelencia comienza aquí',
  'Cada consulta cuenta',
  'Tu dedicación inspira salud',
  'Hoy es un gran día para sanar',
]

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function fraseDia(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return FRASES_MOTIVACIONALES[dayOfYear % FRASES_MOTIVACIONALES.length]
}

function fechaCompleta(): string {
  const now = new Date()
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`
}

export default function InicioPage() {
  const router = useRouter()
  const { dark } = useTheme()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const { profile } = useProfile()
  const [estado, setEstado] = useState<EstadoPerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false)
  const [modalConsulta, setModalConsulta] = useState(false)
  const [citasHoy, setCitasHoy] = useState<number>(0)
  const [pacientesSemana, setPacientesSemana] = useState<number>(0)

  // Precarga: poblar cache SWR de médico, clínica y fuentes PDF
  useMedicoInfo()
  useClinica()
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (!user) { router.push('/login'); return }

      fetch('/api/me/estado-perfil')
        .then(r => r.json())
        .then((data: EstadoPerfil) => {
          setEstado(data)
          if (data.requiereOnboarding) setMostrarOnboarding(true)
        })
        .catch(() => {})
        .finally(() => setLoading(false))

      // Fetch quick stats
      const inicioHoy = fechaHoraLocalAInstante(hoyEnTZ(), '00:00')
      const inicioManana = fechaHoraLocalAInstante(desplazarFecha(hoyEnTZ(), { dias: 1 }), '00:00')
      const inicioSemana = fechaHoraLocalAInstante(desplazarFecha(hoyEnTZ(), { dias: -7 }), '00:00')

      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', inicioHoy)
        .lt('start_time', inicioManana)
        .then((res: { count: number | null }) => setCitasHoy(res.count ?? 0))
        .catch(() => {})

      supabase
        .from('consultas')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicioSemana)
        .then((res: { count: number | null }) => setPacientesSemana(res.count ?? 0))
        .catch(() => {})
    })
  }, [router])

  function handleOnboardingComplete() {
    setMostrarOnboarding(false)
    fetch('/api/me/estado-perfil')
      .then(r => r.json())
      .then((data: EstadoPerfil) => setEstado(data))
      .catch(() => {})
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#1e5fa8]" />
      </div>
    )
  }

  if (!estado) return null

  const nombreMedico = profile?.nombres
    ? profile.nombres.split(' ')[0]
    : null

  const cardBase = dark
    ? 'bg-slate-900/80 backdrop-blur-md border-slate-700/50 text-slate-100'
    : 'bg-white/80 backdrop-blur-sm border-slate-200 text-[#1a3a5c]'

  const cardHover = dark
    ? 'hover:border-slate-500 hover:shadow-[0_8px_32px_rgba(212,175,55,0.08)]'
    : 'hover:border-[#1e5fa8]/40 hover:shadow-[0_8px_32px_rgba(30,95,168,0.12)]'

  return (
    <>
      {mostrarOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          role={estado.role}
          esAdminDeClinica={profile?.es_admin_de_clinica === true}
        />
      )}

      <ConsultaRapidaModal open={modalConsulta} onClose={() => setModalConsulta(false)} />

      {/* Particle background */}
      <ParticleCanvas dark={dark} />

      <div className="min-h-screen flex flex-col relative" style={{ zIndex: 1 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-spinus.png"
              alt="Spinus"
              width={800}
              height={777}
              className="rounded-xl h-14 w-auto"
            />
            <span className={`text-lg font-semibold tracking-wide ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Spinus<span className="align-super text-xs">&reg;</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Plan badge — compact */}
            {estado.plan !== 'free' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold mr-1">
                <Zap size={10} /> {estado.planNombre}
              </span>
            )}
            {estado.plan === 'free' && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e5fa8]/10 text-[#1e5fa8] text-[10px] font-semibold mr-1 hover:bg-[#1e5fa8]/20 transition-colors"
              >
                <Zap size={10} /> Actualizar
              </Link>
            )}
            <Link
              href="/perfil"
              className={`p-2 rounded-lg transition-colors ${
                dark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-[#1a3a5c] hover:bg-white/80'
              }`}
            >
              <UserCircle size={18} />
            </Link>
          </div>
        </div>

        <div className="mx-6 mt-3">
        </div>

        {/* Profile completion banner */}
        {estado.porcentaje < 100 && estado.role !== 'secretaria' && (
          <div className="mx-6 mt-2">
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              dark
                ? 'bg-amber-900/30 border border-amber-700/40'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke={dark ? '#78350f' : '#fde68a'} strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="15"
                      fill="none" stroke="#f59e0b" strokeWidth="4"
                      strokeDasharray={`${(estado.porcentaje / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${
                    dark ? 'text-amber-400' : 'text-amber-700'
                  }`}>
                    {estado.porcentaje}%
                  </span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
                    Completa tu perfil
                  </p>
                  <p className={`text-xs ${dark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                    Aparece en todos tus documentos PDF
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMostrarOnboarding(true)}
                className={`flex items-center gap-1 text-xs font-medium transition-colors shrink-0 ${
                  dark ? 'text-amber-400 hover:text-amber-200' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Completar <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">

          {/* Greeting */}
          <div className="launcher-greeting text-center mb-10">
            <p className={`text-sm font-medium mb-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {fechaCompleta()}
            </p>
            <h1 className={`text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 ${
              dark ? 'text-white' : 'text-[#1e5fa8]'
            }`}>
              {saludo()}{nombreMedico ? `, ${nombreMedico}` : ''}
            </h1>
            <p className={`text-lg font-medium italic ${
              dark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {fraseDia()}
            </p>
          </div>

          {/* Cards */}
          <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Consulta rapida — primary */}
            <button
              onClick={() => {
                if (subState.isBlocked) {
                  openBloqueoModal()
                  return
                }
                setModalConsulta(true)
              }}
              className={`launcher-card-0 group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border shadow-lg transition-all duration-300 min-h-[220px] sm:col-span-1 hover:scale-[1.03] active:scale-[0.98] ${
                dark
                  ? 'bg-[#1a3a5c]/90 backdrop-blur-md border-[#1e5fa8]/30 text-white hover:shadow-[0_12px_40px_rgba(30,95,168,0.25)]'
                  : 'bg-[#1a3a5c] border-transparent text-white hover:shadow-[0_12px_40px_rgba(26,58,92,0.3)]'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center transition-colors group-hover:bg-white/25">
                <Stethoscope size={32} className="transition-transform duration-300 group-hover:animate-[iconBounce_0.5s_ease-in-out]" style={{ animationFillMode: 'both' }} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Consulta rapida</p>
                <p className="text-sm text-white/60 mt-1">Buscar o registrar paciente</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-30 group-hover:opacity-60 transition-opacity">
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Documento rapido */}
            <Link
              href="/documentos"
              onClick={(e) => {
                if (subState.isBlocked) {
                  e.preventDefault()
                  openBloqueoModal()
                }
              }}
              className={`launcher-card-1 group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border shadow-sm transition-all duration-300 min-h-[220px] hover:scale-[1.03] active:scale-[0.98] ${cardBase} ${cardHover}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-teal-500 flex items-center justify-center group-hover:bg-teal-600 transition-colors">
                <FileText size={32} className="text-white transition-transform duration-300 group-hover:animate-[iconBounce_0.5s_ease-in-out]" style={{ animationFillMode: 'both' }} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Documento rapido</p>
                <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>
                  Receta, laboratorio, imagen...
                </p>
              </div>
              <div className={`absolute bottom-4 right-4 opacity-20 group-hover:opacity-50 transition-opacity ${
                dark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <ChevronRight size={18} />
              </div>
            </Link>

            {/* Dashboard — hard navigation para garantizar cookies frescas */}
            <a
              href="/dashboard"
              className={`launcher-card-2 group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border shadow-sm transition-all duration-300 min-h-[220px] hover:scale-[1.03] active:scale-[0.98] ${cardBase} ${cardHover}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center group-hover:bg-violet-700 transition-colors">
                <LayoutDashboard size={32} className="text-white transition-transform duration-300 group-hover:animate-[iconBounce_0.5s_ease-in-out]" style={{ animationFillMode: 'both' }} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Dashboard</p>
                <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>
                  Ver resumen, <strong>agenda</strong> y estadisticas
                </p>
              </div>
              <div className={`absolute bottom-4 right-4 opacity-20 group-hover:opacity-50 transition-opacity ${
                dark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <ChevronRight size={18} />
              </div>
            </a>
          </div>

          {/* Quick activity row */}
          <div className={`mt-8 flex items-center gap-6 launcher-greeting ${
            dark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays size={15} className={dark ? 'text-[#1e5fa8]' : 'text-[#1e5fa8]'} />
              <span>Hoy tienes <strong className={dark ? 'text-white' : 'text-[#1a3a5c]'}>{citasHoy}</strong> {citasHoy === 1 ? 'cita' : 'citas'}</span>
            </div>
            <div className={`w-px h-4 ${dark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            <div className="flex items-center gap-2 text-sm">
              <Users size={15} className={dark ? 'text-emerald-400' : 'text-emerald-600'} />
              <span><strong className={dark ? 'text-white' : 'text-[#1a3a5c]'}>{pacientesSemana}</strong> {pacientesSemana === 1 ? 'consulta' : 'consultas'} esta semana</span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
