'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Stethoscope, FileText, LayoutDashboard,
  ChevronRight, UserCircle, Zap,
  CalendarDays, Users, WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import ParticleCanvas from '@/components/launcher/ParticleCanvas'
import OfflineReadinessPanel from '@/components/ui/OfflineReadinessPanel'
import { useTheme } from '@/components/launcher/ThemeContext'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useClinica } from '@/hooks/useClinica'
import { precacheFonts } from '@/lib/pdfClientFallback'
import { subscribe, getStatus } from '@/lib/connectionMonitor'
import { precachePatients } from '@/lib/offlinePatients'

type GridMode = 'sin_pacientes' | 'nuevo' | 'activo'

interface EstadoPerfil {
  porcentaje: number
  requiereOnboarding: boolean
  gridMode: GridMode
  role: string
  nombre: string | null
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
  const [estado, setEstado] = useState<EstadoPerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false)
  const [modalConsulta, setModalConsulta] = useState(false)
  const [citasHoy, setCitasHoy] = useState<number>(0)
  const [pacientesSemana, setPacientesSemana] = useState<number>(0)

  const [isOnline, setIsOnline] = useState(() => getStatus() !== 'offline')

  // Precarga: poblar cache SWR de médico, clínica y fuentes PDF
  useMedicoInfo()
  useClinica()
  useEffect(() => {
    precacheFonts()
    precachePatients()
    // Prefetch chunks JS de TODAS las rutas críticas para navegación offline
    router.prefetch('/dashboard')
    router.prefetch('/agenda')
    router.prefetch('/estadisticas')
    router.prefetch('/documentos')
    router.prefetch('/pacientes')
    router.prefetch('/pacientes/nuevo')
    router.prefetch('/expediente')
    router.prefetch('/expediente/_')
    router.prefetch('/expediente/_/nueva-nota')
    router.prefetch('/expediente/_/editar')
    router.prefetch('/expediente/_/documentos')
    router.prefetch('/expediente/_/laboratorios/nuevo')
    router.prefetch('/expediente/_/laboratorios/_')
    router.prefetch('/expediente/_/consulta/_')
    router.prefetch('/suplementacion')
    // Warm-up: forzar descarga completa de los chunks JS de los 8 formularios
    // El SW los intercepta y cachea automáticamente para modo offline.
    // Helper: logguea la inyección ANTES del import dinámico
    const logInject = (path: string) => {
      // eslint-disable-next-line no-console
      console.log('[Spinus] Inyectando script: ' + path)
    }

    logInject('@/components/documentos/RecetaForm')
    const wRcta = import('@/components/documentos/RecetaForm')
    logInject('@/components/documentos/SolicitudLabForm')
    const wSLab = import('@/components/documentos/SolicitudLabForm')
    logInject('@/components/documentos/SolicitudImagenForm')
    const wSImg = import('@/components/documentos/SolicitudImagenForm')
    logInject('@/components/documentos/PlanSuplementacionForm')
    const wSupl = import('@/components/documentos/PlanSuplementacionForm')
    logInject('@/components/documentos/SolicitudInternamientoForm')
    const wInt = import('@/components/documentos/SolicitudInternamientoForm')
    logInject('@/components/documentos/EscritoMedicoForm')
    const wEsc = import('@/components/documentos/EscritoMedicoForm')
    logInject('@/components/documentos/ConsentimientoInformadoForm')
    const wCons = import('@/components/documentos/ConsentimientoInformadoForm')
    logInject('@/components/documentos/NotaHonorariosForm')
    const wHon = import('@/components/documentos/NotaHonorariosForm')

    const formWarmups: Array<[string, Promise<unknown>]> = [
      ['RecetaForm', wRcta],
      ['SolicitudLabForm', wSLab],
      ['SolicitudImagenForm', wSImg],
      ['PlanSuplementacionForm', wSupl],
      ['SolicitudInternamientoForm', wInt],
      ['EscritoMedicoForm', wEsc],
      ['ConsentimientoInformadoForm', wCons],
      ['NotaHonorariosForm', wHon],
    ]

    Promise.all(
      formWarmups.map(([name, p]) =>
        p.then(() => {
          // eslint-disable-next-line no-console
          console.log('[Spinus warm-up] ✓', name)
          return name
        }).catch(err => {
          // eslint-disable-next-line no-console
          console.error('[Spinus warm-up] ✗', name, err)
          return null
        })
      )
    ).then(results => {
      const ok = results.filter(Boolean).length
      // eslint-disable-next-line no-console
      console.log(`[Spinus warm-up] formularios listos: ${ok}/${formWarmups.length}`)
    })

    // Warm-up de renderers PDF
    logInject('@/lib/pdf/RecetaPdf')
    const pRcta = import('@/lib/pdf/RecetaPdf')
    logInject('@/lib/pdf/SolicitudLabPdf')
    const pSLab = import('@/lib/pdf/SolicitudLabPdf')
    logInject('@/lib/pdf/SolicitudImagenPdf')
    const pSImg = import('@/lib/pdf/SolicitudImagenPdf')
    logInject('@/lib/pdf/PlanSuplementacionPdf')
    const pSupl = import('@/lib/pdf/PlanSuplementacionPdf')
    logInject('@/lib/pdf/NotaHonorariosPdf')
    const pHon = import('@/lib/pdf/NotaHonorariosPdf')
    logInject('@/lib/pdf/SolicitudInternamientoPdf')
    const pInt = import('@/lib/pdf/SolicitudInternamientoPdf')
    logInject('@/lib/pdf/EscritoMedicoPdf')
    const pEsc = import('@/lib/pdf/EscritoMedicoPdf')
    logInject('@/lib/pdf/ConsentimientoInformadoPdf')
    const pCons = import('@/lib/pdf/ConsentimientoInformadoPdf')
    logInject('@/lib/pdf/NotaEvolucionPdf')
    const pEvo = import('@/lib/pdf/NotaEvolucionPdf')

    const pdfWarmups: Array<[string, Promise<unknown>]> = [
      ['RecetaPdf', pRcta],
      ['SolicitudLabPdf', pSLab],
      ['SolicitudImagenPdf', pSImg],
      ['PlanSuplementacionPdf', pSupl],
      ['NotaHonorariosPdf', pHon],
      ['SolicitudInternamientoPdf', pInt],
      ['EscritoMedicoPdf', pEsc],
      ['ConsentimientoInformadoPdf', pCons],
      ['NotaEvolucionPdf', pEvo],
    ]

    Promise.all(
      pdfWarmups.map(([name, p]) =>
        p.then(() => {
          // eslint-disable-next-line no-console
          console.log('[Spinus warm-up] ✓ PDF', name)
          return name
        }).catch(err => {
          // eslint-disable-next-line no-console
          console.error('[Spinus warm-up] ✗ PDF', name, err)
          return null
        })
      )
    ).then(results => {
      const ok = results.filter(Boolean).length
      // eslint-disable-next-line no-console
      console.log(`[Spinus warm-up] renderers PDF listos: ${ok}/${pdfWarmups.length}`)
      // eslint-disable-next-line no-console
      console.log('[Spinus warm-up] todo listo — sistema blindado para offline')
    })
    // Fetch páginas críticas para que el SW cache todos sus chunks
    const rutasWarmup = [
      '/dashboard',
      '/agenda',
      '/estadisticas',
      '/documentos',
      '/pacientes',
      '/pacientes/nuevo',
      '/expediente',
      '/expediente/_',
      '/expediente/_/nueva-nota',
      '/expediente/_/editar',
      '/expediente/_/documentos',
      '/expediente/_/laboratorios/nuevo',
      '/expediente/_/laboratorios/_',
      '/expediente/_/consulta/_',
      '/suplementacion',
    ]
    rutasWarmup.forEach(r => { fetch(r).catch(() => {}) })
  }, [router])
  useEffect(() => {
    const unsub = subscribe((status) => setIsOnline(status !== 'offline'))
    return unsub
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Offline: saltar validación de sesión, cargar UI con datos cacheados
    // para que el médico pueda acceder al launcher sin bloqueo
    const isBrowserOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false

    if (isBrowserOffline) {
      // Estado mínimo fallback para que la UI no se quede colgada
      const fallbackEstado: EstadoPerfil = {
        porcentaje: 100,
        requiereOnboarding: false,
        gridMode: 'activo',
        role: 'medico',
        nombre: null,
        plan: 'free',
        planNombre: 'Free',
        suscripcion_estado: 'trial',
      }

      // Intentar leer el estado del perfil (el SW lo puede tener cacheado si
      // el médico abrió el launcher antes online); si falla, usar fallback
      fetch('/api/me/estado-perfil')
        .then(r => r.json())
        .then((data: EstadoPerfil) => setEstado(data))
        .catch(() => setEstado(fallbackEstado))
        .finally(() => setLoading(false))
      return
    }

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
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', today)
        .lt('start_time', new Date(Date.now() + 86_400_000).toISOString().split('T')[0])
        .then((res: { count: number | null }) => setCitasHoy(res.count ?? 0))
        .catch(() => {})

      supabase
        .from('consultas')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo)
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

  const nombreMedico = estado.nombre
    ? estado.nombre.replace(/^(Dr\.|Dra\.|Mtro\.|Mtra\.|Lic\.|Ing\.)\s*/i, '').split(' ')[0]
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
          nombreInicial={estado.nombre}
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
              width={56}
              height={56}
              className="rounded-xl"
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

        {/* Offline readiness panel — estado del sistema */}
        <div className="mx-6 mt-3">
          <OfflineReadinessPanel dark={dark} />
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
              onClick={() => setModalConsulta(true)}
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

            {/* Dashboard */}
            {isOnline ? (
              <Link
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
              </Link>
            ) : (
              <div
                className={`launcher-card-2 relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border shadow-sm min-h-[220px] opacity-50 cursor-not-allowed ${
                  dark ? 'bg-slate-900/80 border-slate-700/50 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-400'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-400 flex items-center justify-center">
                  <LayoutDashboard size={32} className="text-white" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold leading-tight">Dashboard</p>
                  <p className="text-sm mt-1 flex items-center justify-center gap-1">
                    <WifiOff size={13} /> Requiere conexion
                  </p>
                </div>
              </div>
            )}
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
