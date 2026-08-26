'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import Portal from '@/components/ui/Portal'
import {
  ChevronRight, X, Sparkles, ArrowUp, MessageCircle, Volume2, VolumeX,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */

type ContextTip = {
  id: string
  title: string
  message: string
  highlight?: string
  action?: { label: string; href: string }
  requiresElement?: string
}

type PageContext = {
  match: (path: string) => boolean
  tips: ContextTip[]
}

/* ─── State machine ──────────────────────────────────────── */

type Phase =
  | 'dormido'        // waiting for initial delay
  | 'welcome'        // showing welcome card + audio
  | 'playing'        // showing tips with audio + auto-advance
  | 'manual'         // muted — no audio, no auto-advance
  | 'bubble'         // minimized pulsing bubble
  | 'dismissed'      // permanently hidden

/* ─── Tip data ───────────────────────────────────────────── */

const WELCOME_TIP: ContextTip = {
  id: 'welcome',
  title: '¡Bienvenido a Spinus®!',
  message: 'Te llevaré paso a paso a conocer tu nueva plataforma de expediente clínico. Puedes navegar libremente — estaré aquí para guiarte.',
}

const PAGE_CONTEXTS: PageContext[] = [
  {
    match: (p) => p === '/dashboard',
    tips: [
      {
        id: 'dash-nuevo',
        title: 'Comienza registrando un paciente',
        message: 'Para empezar a usar la plataforma, registra tu primer paciente. Haz clic en "Nuevo paciente" para crear su expediente.',
        highlight: 'nuevo-paciente',
        action: { label: 'Nuevo paciente', href: '/pacientes/nuevo' },
      },
      {
        id: 'dash-buscar',
        title: 'Busca pacientes al instante',
        message: 'Presiona Ctrl+K en cualquier momento para abrir la búsqueda global. Encuentra a cualquier paciente en segundos.',
      },
      {
        id: 'dash-pendientes',
        title: 'Aún hay más por explorar',
        message: 'Todavía puedes conocer el expediente del paciente con laboratorios, la agenda con Google Calendar y el visor DICOM disponible desde esta página de inicio. Navega por las secciones del menú lateral para continuar el tour.',
      },
    ],
  },
  {
    match: (p) => p === '/expediente',
    tips: [
      {
        id: 'exp-lista',
        title: 'Expediente clínico',
        message: 'Aquí aparecen todos los pacientes que se han registrado. Elige uno para abrir su expediente o búscalo en la barra de búsqueda. Si no está tu paciente, también puedes hacer un "registro express" dando clic en "Nuevo paciente" y saltar a tu consulta inmediatamente.',
        highlight: 'nuevo-paciente-exp',
      },
    ],
  },
  {
    match: (p) => p === '/pacientes/nuevo',
    tips: [
      {
        id: 'pac-form',
        title: 'Datos del paciente',
        message: 'Llena los datos básicos. No olvides agregar el email — es importante para enviarle recetas y documentos directamente a su correo.',
      },
    ],
  },
  {
    match: (p) => p.startsWith('/expediente/') && p.endsWith('/nueva-nota'),
    tips: [
      {
        id: 'nota-ia',
        title: 'Tu primera nota médica',
        message: 'Llena el motivo de consulta y la exploración física, después haz clic en "Generar con IA". La inteligencia artificial estructurará la nota — tú solo validas y firmas.',
      },
      {
        id: 'nota-panel',
        title: 'Panel de documentos',
        message: 'Ahora para redactar una receta o cualquier otro documento, en el panel lateral derecho elige una de las opciones disponibles.',
        highlight: 'panel-documentos',
        requiresElement: 'panel-documentos',
      },
      {
        id: 'nota-modal-iconos',
        title: 'Navega entre documentos',
        message: 'En esta ventana puedes acceder a todos los documentos disponibles. Solo haz clic en los iconos de la esquina superior derecha para cambiar entre receta, laboratorio, imagen y más.',
        highlight: 'modal-doc-iconos',
        requiresElement: 'modal-doc-iconos',
      },
      {
        id: 'nota-post-consulta',
        title: '¡Consulta terminada!',
        message: 'Ahora puedes regresar a la ventana de inicio desde la barra lateral dando clic en "Inicio", o revisar el expediente de tu paciente dando clic en "Ver expediente" en la parte superior. Si olvidaste un documento, haz clic de nuevo en cualquier opción del panel lateral derecho.',
        highlight: 'ver-expediente',
        requiresElement: 'consulta-completa',
      },
    ],
  },
  {
    match: (p) => p.startsWith('/expediente/') && !p.includes('/nueva-nota'),
    tips: [
      {
        id: 'exp-general',
        title: 'Expediente del paciente',
        message: 'Aquí se encuentra toda la información generada de tu paciente. Desde aquí puedes generar una nota médica nueva, ingresar laboratorios para llevar un seguimiento cronológico o redactar cualquier documento como recetas, solicitudes y consentimientos.',
      },
      {
        id: 'exp-notas',
        title: 'Notas médicas',
        message: 'En la pestaña de Notas puedes ver todo el historial de consultas. Haz clic en "Nueva nota" para iniciar otra consulta — la IA te ayudará a estructurarla.',
      },
      {
        id: 'exp-labs',
        title: 'Mediciones y documentos clínicos',
        message: 'En la card "Mediciones y Documentos" registras valores longitudinales del paciente (glucosa, presión arterial, HbA1c, peso, etc.) con gráficas de evolución y bandas de referencia automáticas. También puedes subir PDFs, imágenes y estudios DICOM — todo vinculado al expediente.',
      },
    ],
  },
  {
    match: (p) => p === '/dicom',
    tips: [
      {
        id: 'dicom-intro',
        title: 'Visor DICOM',
        message: 'En esta página puedes visualizar archivos en formato DICOM (.dcm). Los archivos deben estar en tu computadora en una carpeta específica para estos estudios — la carpeta no debe estar comprimida.',
      },
      {
        id: 'dicom-rendimiento',
        title: 'Rendimiento',
        message: 'Ten en cuenta que entre más archivos cargues, el navegador puede ralentizarse. Se recomienda cargar un estudio a la vez para la mejor experiencia.',
      },
    ],
  },
  {
    match: (p) => p === '/agenda',
    tips: [
      {
        id: 'agenda-intro',
        title: 'Tu agenda de consultas',
        message: 'Esta es tu agenda. Aquí puedes organizar todas tus citas del día, semana o mes. Funciona igual que Google Calendar — si ya lo usas, te sentirás como en casa.',
      },
      {
        id: 'agenda-cita',
        title: 'Crear una cita',
        /* ⚠️ EL BOTÓN SE LLAMA «Agendar», NO «Nueva cita». Decía lo segundo hasta
           el 2026-08-25, cuando el header se retiró a una sola línea: se quitó el
           botón «Nuevo evento» —el conmutador del modal ya hacía su trabajo— y el
           que quedó pasó a llamarse «Agendar», porque abre las dos cosas y
           «Nueva cita» ya no describía lo que abre.
           `highlight` NO cambia: apunta al `data-onboard`, no al texto. */
        message: 'Haz clic en "Agendar" o directamente en cualquier horario del calendario. El modal abre en "Cita": selecciona al paciente y listo. Arriba del modal puedes cambiar a "Evento" para bloqueos, cirugías o reuniones.',
        highlight: 'nueva-cita',
      },
      {
        id: 'agenda-drag',
        title: 'Arrastra y suelta',
        message: 'Puedes mover citas arrastrándolas a otro horario, o estirarlas para cambiar la duración. Los cambios se guardan automáticamente y se reflejan en Google Calendar.',
      },
      {
        id: 'agenda-gcal',
        title: 'Sincronización con Google Calendar',
        message: 'Conecta tu Google Calendar desde Mi perfil para sincronizar citas en ambas direcciones — lo que crees aquí aparece en tu celular y lo que agendes desde tu celular aparece aquí.',
      },
      {
        id: 'agenda-config',
        title: 'Horario de consulta',
        message: 'En el icono de configuración puedes establecer tu horario de consulta. Las horas fuera de tu horario se muestran en gris para que no agenden en esos espacios.',
      },
      {
        id: 'agenda-cita-creada',
        title: '¡Agendaste tu primera cita!',
        message: 'Puedes verificarla en Inicio, en la tarjeta de "Próxima cita". Ahí verás el nombre del paciente, la hora y podrás iniciar la consulta directamente desde ahí.',
        requiresElement: 'cita-creada',
        action: { label: 'Ir a Inicio', href: '/dashboard' },
      },
    ],
  },
  {
    match: (p) => p === '/perfil',
    tips: [
      {
        id: 'perfil-datos',
        title: 'Tus datos profesionales',
        message: 'Es fundamental que completes tu nombre, especialidad y cédula profesional — todos los documentos que generes (recetas, solicitudes, consentimientos) saldrán con estos datos.',
      },
      {
        id: 'perfil-logo',
        title: 'Personaliza tu membrete',
        message: 'Sube tu logo para que aparezca en todos los documentos que generes. También puedes personalizar los colores de tu interfaz.',
        highlight: 'subir-logo',
      },
    ],
  },
]

/* ─── Persistence ────────────────────────────────────────── */

const STORAGE_KEY = 'spinus_onboarding'

type PersistedState = {
  dismissed: boolean
  seenTips: string[]
  welcomed: boolean
  muted: boolean
}

const DEFAULT_STATE: PersistedState = { dismissed: false, seenTips: [], welcomed: false, muted: false }

function loadState(): PersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if ('currentStep' in parsed) return DEFAULT_STATE // migrate old format
      return { ...DEFAULT_STATE, ...parsed }
    }
  } catch {}
  return DEFAULT_STATE
}

function persistState(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

/* ─── Arrow component ────────────────────────────────────── */

function HighlightArrow({ target }: { target: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    function update() {
      const el = document.querySelector(`[data-onboard="${target}"]`) as HTMLElement | null
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({ top: rect.top, left: rect.left + rect.width / 2 })
      } else {
        setPos(null)
      }
      rafRef.current = requestAnimationFrame(update)
    }
    const timer = setTimeout(() => { rafRef.current = requestAnimationFrame(update) }, 300)
    return () => { clearTimeout(timer); cancelAnimationFrame(rafRef.current) }
  }, [target])

  if (!pos) return null

  return (
    <div
      className="fixed z-[10001] pointer-events-none"
      style={{ top: pos.top - 44, left: pos.left - 16 }}
    >
      <div className="flex flex-col items-center animate-bounce">
        <div className="bg-[#1e5fa8] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
          Aquí
        </div>
        <ArrowUp size={20} className="text-[#1e5fa8] -mt-1" style={{ transform: 'rotate(180deg)' }} />
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function OnboardingGuide() {
  const { profile, loading } = useProfile()
  const pathname = usePathname()
  const router = useRouter()

  // Persisted state
  const [persisted, setPersisted] = useState<PersistedState>(DEFAULT_STATE)
  const persistedRef = useRef(persisted)
  persistedRef.current = persisted

  // Phase machine
  const [phase, setPhase] = useState<Phase>('dormido')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // UI state
  const [tipIndex, setTipIndex] = useState(0)
  const [entering, setEntering] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set())

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable updater
  const save = useCallback((partial: Partial<PersistedState>) => {
    setPersisted(prev => {
      const next = { ...prev, ...partial }
      persistState(next)
      return next
    })
  }, [])

  // ── Derived: tips for current page ──
  const pageCtx = PAGE_CONTEXTS.find(c => c.match(pathname))
  const allTips = pageCtx?.tips ?? []
  const tips = allTips.filter(t => !t.requiresElement || visibleElements.has(t.requiresElement))
  const isWelcome = phase === 'welcome'
  const currentTip = isWelcome ? WELCOME_TIP : tips[Math.min(tipIndex, tips.length - 1)] ?? null

  // ── Audio helpers (use refs to avoid stale closures) ──
  function stopAudio() {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current = null
    }
  }

  function playAudio(tipId: string) {
    stopAudio()
    const audio = new Audio(`/audio/${tipId}.mp3`)
    audio.volume = 0.8
    audio.addEventListener('ended', () => {
      autoAdvanceRef.current = setTimeout(() => {
        autoAdvanceRef.current = null
        advanceRef.current()
      }, 1200)
    })
    audio.play().catch(() => {})
    audioRef.current = audio
  }

  // ── Advance logic (ref for stable access from audio callback) ──
  const advanceRef = useRef(() => {})
  advanceRef.current = () => {
    const p = phaseRef.current
    if (p === 'welcome') {
      save({ welcomed: true })
      setPhase('playing')
      setTipIndex(0)
      return
    }
    if (p !== 'playing' && p !== 'manual') return
    // Mark current tip as seen
    const ps = persistedRef.current
    const ctx = PAGE_CONTEXTS.find(c => c.match(pathname))
    const all = ctx?.tips ?? []
    const vis = all.filter(t => !t.requiresElement || visibleElements.has(t.requiresElement))
    const cur = vis[Math.min(tipIndex, vis.length - 1)]
    if (cur && !ps.seenTips.includes(cur.id)) {
      save({ seenTips: [...ps.seenTips, cur.id] })
    }
    // Advance or bubble
    if (tipIndex < vis.length - 1) {
      setTipIndex(tipIndex + 1)
    } else {
      stopAudio()
      setPhase('bubble')
    }
  }

  // ── 1. Mount + load persisted state ──
  useEffect(() => {
    const s = loadState()
    setPersisted(s)
    setMounted(true)
    if (s.dismissed) {
      setPhase('dismissed')
    }
  }, [])

  // ── 2. DORMIDO → WELCOME or PLAYING (initial delay) ──
  useEffect(() => {
    if (!mounted || phase !== 'dormido' || loading) return
    if (profile?.role === 'secretaria') { setPhase('dismissed'); return }
    if (persisted.dismissed) { setPhase('dismissed'); return }

    const timer = setTimeout(() => {
      if (persisted.welcomed) {
        // Already saw welcome — check if page has unseen tips
        const ctx = PAGE_CONTEXTS.find(c => c.match(pathname))
        const all = ctx?.tips ?? []
        const hasUnseen = all.some(t => !persisted.seenTips.includes(t.id))
        if (hasUnseen && all.length > 0) {
          setPhase(persisted.muted ? 'manual' : 'playing')
        } else {
          setPhase('bubble')
        }
      } else {
        setPhase('welcome')
      }
      requestAnimationFrame(() => setEntering(true))
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, loading, profile?.role])

  // ── 3. Play audio when tip changes (playing phase only) ──
  const currentTipId = currentTip?.id ?? null
  useEffect(() => {
    if (!currentTipId) return
    if (phase === 'playing' || phase === 'welcome') {
      playAudio(currentTipId)
    }
    // Cleanup on change
    return () => stopAudio()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTipId, phase])

  // ── 4. Page navigation handling ──
  const prevPathRef = useRef(pathname)
  const prevTipCountRef = useRef(0)
  useEffect(() => {
    if (pathname === prevPathRef.current) return
    prevPathRef.current = pathname
    stopAudio()
    setTipIndex(0)
    prevTipCountRef.current = 0

    const p = phaseRef.current
    if (p === 'dismissed') return

    const ctx = PAGE_CONTEXTS.find(c => c.match(pathname))
    const pageTips = ctx?.tips ?? []
    const ps = persistedRef.current
    const hasUnseen = pageTips.some(t => !ps.seenTips.includes(t.id))

    if (p === 'bubble' && hasUnseen && pageTips.length > 0) {
      // Auto-expand for unseen tips
      setPhase(ps.muted ? 'manual' : 'playing')
      setEntering(true)
    } else if (p === 'playing' || p === 'manual') {
      // Stay expanded but reset index
      if (pageTips.length === 0) {
        setPhase('bubble')
      }
    }
  }, [pathname])

  // ── 5. Observe DOM for dynamic data-onboard elements ──
  useEffect(() => {
    if (!mounted) return
    function scan() {
      const els = document.querySelectorAll('[data-onboard]')
      const found = new Set<string>()
      els.forEach(el => { const v = el.getAttribute('data-onboard'); if (v) found.add(v) })
      setVisibleElements(prev => {
        if (prev.size !== found.size || [...found].some(v => !prev.has(v))) return found
        return prev
      })
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [mounted, pathname])

  // ── 6. Auto-jump when new requiresElement tips appear on same page ──
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'manual') return
    if (tips.length > prevTipCountRef.current && prevTipCountRef.current > 0) {
      setTipIndex(tips.length - 1)
    }
    prevTipCountRef.current = tips.length
  }, [tips.length, phase])

  // ── 7. Cleanup on unmount ──
  useEffect(() => {
    return () => stopAudio()
  }, [])

  // ── Actions ──
  function handleNext() {
    stopAudio()
    advanceRef.current()
  }

  function handlePrev() {
    stopAudio()
    if (tipIndex > 0) setTipIndex(tipIndex - 1)
  }

  function handleAction() {
    if (currentTip?.action?.href) {
      router.push(currentTip.action.href)
    }
    handleNext()
  }

  function handleMinimize() {
    stopAudio()
    setPhase('bubble')
  }

  function handleDismiss() {
    stopAudio()
    setEntering(false)
    setTimeout(() => {
      setPhase('dismissed')
      save({ dismissed: true })
    }, 250)
  }

  function handleToggleMute() {
    const nowMuted = !persisted.muted
    save({ muted: nowMuted })
    if (nowMuted) {
      stopAudio()
      if (phase === 'playing') setPhase('manual')
    } else {
      if (phase === 'manual') {
        setPhase('playing')
        // Audio will auto-play via the effect watching phase+currentTipId
      }
    }
  }

  function handleBubbleClick() {
    setTipIndex(0)
    setPhase(persisted.muted ? 'manual' : 'playing')
    setEntering(true)
  }

  // ── Render gates ──
  if (!mounted || loading || phase === 'dormido' || phase === 'dismissed') return null

  // ── Bubble ──
  if (phase === 'bubble') {
    return (
      <Portal>
        <div className="fixed bottom-6 right-6 z-[10002]">
          <button
            onClick={handleBubbleClick}
            className="relative w-12 h-12 bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200"
            style={{ animation: 'ledPulse 2s ease-in-out infinite' }}
            title="Abrir asistente"
          >
            <Sparkles size={18} className="text-white" />
          </button>
        </div>
      </Portal>
    )
  }

  // ── Card (welcome, playing, manual) ──
  const showWelcome = phase === 'welcome'
  const hasMultipleTips = !showWelcome && tips.length > 1
  const isMuted = persisted.muted

  return (
    <Portal>
      {/* Arrow highlighting target element */}
      {!showWelcome && currentTip?.highlight && (
        <HighlightArrow target={currentTip.highlight} />
      )}

      {/* Main card */}
      <div
        className={`fixed bottom-6 right-6 z-[10002] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          entering
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="w-[360px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-slate-200/60 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white/80" />
              <span className="text-xs font-semibold text-white">
                {showWelcome ? 'Asistente' : 'Asistente — Tip'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleMute}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title={isMuted ? 'Activar voz' : 'Silenciar voz'}
              >
                {isMuted
                  ? <VolumeX size={11} className="text-white/70" />
                  : <Volume2 size={11} className="text-white/70" />
                }
              </button>
              <button
                onClick={handleMinimize}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Minimizar"
              >
                <span className="text-white/70 text-[10px] font-bold leading-none">—</span>
              </button>
              <button
                onClick={handleDismiss}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="No mostrar más"
              >
                <X size={12} className="text-white/70" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a3a5c]/10 to-[#1e5fa8]/10 flex items-center justify-center flex-shrink-0">
                {showWelcome
                  ? <Sparkles size={18} className="text-[#1e5fa8]" />
                  : <MessageCircle size={18} className="text-[#1e5fa8]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#1d1d1f] leading-tight">{currentTip?.title}</p>
                <p className="text-[11px] text-[#86868b] mt-1.5 leading-relaxed">{currentTip?.message}</p>
              </div>
            </div>

            {/* Action / Navigation */}
            <div className="mt-4 flex items-center gap-2">
              {showWelcome ? (
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] active:scale-[0.98] transition-all"
                >
                  ¡Empecemos!
                  <ChevronRight size={12} />
                </button>
              ) : (
                <>
                  {currentTip?.action && currentTip.action.href && (
                    <button
                      onClick={handleAction}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] active:scale-[0.98] transition-all"
                    >
                      {currentTip.action.label}
                      <ChevronRight size={12} />
                    </button>
                  )}
                  {hasMultipleTips && (
                    <div className="flex items-center gap-1">
                      {tipIndex > 0 && (
                        <button
                          onClick={handlePrev}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center active:scale-95 transition-all"
                        >
                          <ChevronRight size={13} className="text-slate-500 rotate-180" />
                        </button>
                      )}
                      <button
                        onClick={handleNext}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center active:scale-95 transition-all"
                        title={tipIndex < tips.length - 1 ? 'Siguiente tip' : 'Entendido'}
                      >
                        <ChevronRight size={13} className="text-slate-500" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Dots indicator */}
          {hasMultipleTips && (
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-1.5">
                {tips.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { stopAudio(); setTipIndex(i) }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === tipIndex ? 'w-5 bg-[#1e5fa8]' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#86868b]">{tipIndex + 1} de {tips.length}</span>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
