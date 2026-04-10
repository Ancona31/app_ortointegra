'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Stethoscope, FileText, LayoutDashboard, ChevronRight, UserCircle, Zap } from 'lucide-react'
import Link from 'next/link'
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import OnboardingModal from '@/components/onboarding/OnboardingModal'

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

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function InicioPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoPerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false)
  const [modalConsulta, setModalConsulta] = useState(false)

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

      <div className="min-h-screen flex flex-col">
        {/* Top bar mínima */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <p className="text-xs text-slate-400">
              {saludo()}{nombreMedico ? `, ${nombreMedico}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/perfil" className="p-2 rounded-lg text-slate-400 hover:text-[#1a3a5c] hover:bg-white/80 transition-colors">
              <UserCircle size={18} />
            </Link>
          </div>
        </div>

        {/* Banner completitud */}
        {estado.porcentaje < 100 && estado.role !== 'secretaria' && (
          <div className="mx-6 mt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#fde68a" strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="15"
                      fill="none" stroke="#f59e0b" strokeWidth="4"
                      strokeDasharray={`${(estado.porcentaje / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-amber-700">
                    {estado.porcentaje}%
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Completa tu perfil</p>
                  <p className="text-xs text-amber-600">Aparece en todos tus documentos PDF</p>
                </div>
              </div>
              <button
                onClick={() => setMostrarOnboarding(true)}
                className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors shrink-0"
              >
                Completar <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Badge plan actual */}
        <div className="mx-6 mt-2">
          {estado.plan === 'free' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center">
                  <Zap size={14} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Plan {estado.planNombre}</p>
                  <p className="text-xs text-slate-400">Hasta 5 pacientes</p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e5fa8] text-white rounded-lg text-xs font-semibold hover:bg-[#1a3a5c] transition-colors shrink-0"
              >
                <Zap size={12} /> Actualizar plan
              </Link>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Zap size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Plan {estado.planNombre}</p>
                <p className="text-xs text-emerald-600">
                  {estado.suscripcion_estado === 'activo' ? 'Suscripción activa' : estado.suscripcion_estado}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contenido principal centrado */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
          <h1 className="text-2xl font-bold text-[#1a3a5c] mb-8 text-center">
            ¿Qué quieres hacer?
          </h1>

          <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Consulta rápida — card principal, más destacada */}
            <button
              onClick={() => setModalConsulta(true)}
              className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-[#1a3a5c] text-white rounded-2xl shadow-lg hover:bg-[#0f2540] active:scale-[0.98] transition-all min-h-[200px] sm:col-span-1"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Stethoscope size={32} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Consulta rápida</p>
                <p className="text-sm text-white/60 mt-1">Buscar o registrar paciente</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-30 group-hover:opacity-60 transition-opacity">
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Documento rápido */}
            <Link
              href="/documentos"
              className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-white text-[#1a3a5c] rounded-2xl shadow-sm border border-slate-200 hover:border-[#1e5fa8]/40 hover:shadow-md active:scale-[0.98] transition-all min-h-[200px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-teal-500 flex items-center justify-center group-hover:bg-teal-600 transition-colors">
                <FileText size={32} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Documento rápido</p>
                <p className="text-sm text-slate-400 mt-1">Receta, laboratorio, imagen…</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-20 group-hover:opacity-50 transition-opacity">
                <ChevronRight size={18} className="text-slate-600" />
              </div>
            </Link>

            {/* Dashboard */}
            <Link
              href="/dashboard"
              className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-white text-slate-700 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md active:scale-[0.98] transition-all min-h-[200px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center group-hover:bg-violet-700 transition-colors">
                <LayoutDashboard size={32} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">Dashboard</p>
                <p className="text-sm text-slate-400 mt-1">Ver resumen, <strong>agenda</strong> y estadísticas</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-20 group-hover:opacity-50 transition-opacity">
                <ChevronRight size={18} />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
