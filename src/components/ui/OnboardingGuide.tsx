'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import Portal from '@/components/ui/Portal'
import {
  Stethoscope, CalendarDays, FileText, UserCircle,
  ChevronRight, X, Sparkles,
} from 'lucide-react'

/* ─── Pasos del onboarding ───────────────────────────────── */

type Step = {
  id: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  message: string
  action: string
  href: string
}

const STEPS: Step[] = [
  {
    id: 'perfil',
    icon: UserCircle,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'Completa tu perfil',
    message: 'Agrega tu especialidad y cédula para personalizar tus documentos.',
    action: 'Ir a mi perfil',
    href: '/perfil',
  },
  {
    id: 'paciente',
    icon: Stethoscope,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Registra tu primer paciente',
    message: 'Crea un expediente para comenzar a documentar.',
    action: 'Nuevo paciente',
    href: '/pacientes/nuevo',
  },
  {
    id: 'agenda',
    icon: CalendarDays,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#1e5fa8]',
    title: 'Agenda una cita',
    message: 'Organiza tus consultas y lleva el control de tu día.',
    action: 'Abrir agenda',
    href: '/agenda',
  },
  {
    id: 'documentos',
    icon: FileText,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Genera un documento',
    message: 'Recetas, solicitudes y más con tu membrete oficial.',
    action: 'Ver documentos',
    href: '/documentos',
  },
]

const STORAGE_KEY = 'ortointegra_onboarding'

type OnboardingState = {
  dismissed: boolean
  currentStep: number
  completedSteps: string[]
}

function getState(): OnboardingState {
  if (typeof window === 'undefined') return { dismissed: false, currentStep: 0, completedSteps: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { dismissed: false, currentStep: 0, completedSteps: [] }
}

function saveState(state: OnboardingState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

/* ─── Componente ─────────────────────────────────────────── */

export default function OnboardingGuide() {
  const { profile, loading } = useProfile()
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState<OnboardingState>({ dismissed: false, currentStep: 0, completedSteps: [] })
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [entering, setEntering] = useState(false)

  // Cargar estado de localStorage después del mount
  useEffect(() => {
    const s = getState()
    setState(s)
    setMounted(true)
  }, [])

  // Mostrar la burbuja con delay después del primer render
  useEffect(() => {
    if (!mounted || state.dismissed || loading) return
    if (profile?.role === 'secretaria') return

    const timer = setTimeout(() => {
      setOpen(true)
      requestAnimationFrame(() => setEntering(true))
    }, 1500)
    return () => clearTimeout(timer)
  }, [mounted, state.dismissed, loading, profile?.role])

  // Marcar paso como completado si el usuario navega a la página correspondiente
  useEffect(() => {
    if (!mounted || state.dismissed) return
    const step = STEPS[state.currentStep]
    if (!step) return

    const match =
      (step.id === 'perfil' && pathname === '/perfil') ||
      (step.id === 'paciente' && pathname === '/pacientes/nuevo') ||
      (step.id === 'agenda' && pathname === '/agenda') ||
      (step.id === 'documentos' && pathname === '/documentos')

    if (match && !state.completedSteps.includes(step.id)) {
      const newState = {
        ...state,
        completedSteps: [...state.completedSteps, step.id],
        currentStep: Math.min(state.currentStep + 1, STEPS.length - 1),
      }
      setState(newState)
      saveState(newState)
    }
  }, [pathname, mounted, state])

  const update = useCallback((partial: Partial<OnboardingState>) => {
    setState(prev => {
      const next = { ...prev, ...partial }
      saveState(next)
      return next
    })
  }, [])

  function dismiss() {
    setEntering(false)
    setTimeout(() => {
      setOpen(false)
      update({ dismissed: true })
    }, 250)
  }

  function goToStep(index: number) {
    update({ currentStep: index })
  }

  function handleAction(step: Step) {
    router.push(step.href)
  }

  // No mostrar si: cargando, dismissed, secretaria, o todos los pasos completados
  if (!mounted || loading || state.dismissed) return null
  if (profile?.role === 'secretaria') return null
  if (state.completedSteps.length >= STEPS.length) return null
  if (!open) return null

  const currentStep = STEPS[state.currentStep] ?? STEPS[0]
  const progress = (state.completedSteps.length / STEPS.length) * 100

  return (
    <Portal>
      <div
        className={`fixed bottom-6 right-6 z-[60] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          entering
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        {/* Tarjeta principal */}
        <div className="w-[320px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-slate-200/60 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white/80" />
              <span className="text-xs font-semibold text-white">Primeros pasos</span>
            </div>
            <button
              onClick={dismiss}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={12} className="text-white/70" />
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#1e5fa8] to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Paso actual — burbuja */}
          <div className="p-4">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl ${currentStep.iconBg} flex items-center justify-center flex-shrink-0`}>
                <currentStep.icon size={18} className={currentStep.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">{currentStep.title}</p>
                <p className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">{currentStep.message}</p>
              </div>
            </div>

            {/* Botón de acción */}
            <button
              onClick={() => handleAction(currentStep)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] active:scale-[0.98] transition-all"
            >
              {currentStep.action}
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Indicadores de paso */}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((step, i) => {
                const completed = state.completedSteps.includes(step.id)
                const active = i === state.currentStep
                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      completed
                        ? 'w-5 bg-emerald-400'
                        : active
                          ? 'w-5 bg-[#1e5fa8]'
                          : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                )
              })}
            </div>
            <button
              onClick={dismiss}
              className="text-[10px] text-[#86868b] hover:text-[#3d3d3f] transition-colors"
            >
              No mostrar más
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
