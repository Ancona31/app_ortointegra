'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'

// Counter global para manejar body scroll lock con modales anidados.
// Solo el primero en abrir hace el lock; solo el último en cerrar lo libera.
let modalStack = 0
let prevBodyOverflow = ''

// Geometría del sistema de diseño Spinus, por forma de estado. Solo actúa en
// ≥768px: por debajo manda `fullscreenMobile` (rangos disjuntos, no compiten).
// Strings literales completos: el scanner de Tailwind 4 lee el fuente como
// texto y no generaría el CSS de una clase armada por concatenación.
const SP_GEO = {
  work:   { wrap: 'md:items-start md:pt-[60px]', panel: 'md:max-w-[724px] md:max-h-[calc(100vh-120px)]' },
  decide: { wrap: '',                            panel: 'md:max-w-[620px]' },
  done:   { wrap: '',                            panel: 'md:max-w-[600px]' },
  wait:   { wrap: '',                            panel: 'md:max-w-[560px]' },
} as const

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  iconBg?: string
  headerRight?: React.ReactNode
  /** Tailwind max-w-* class. Default: max-w-lg */
  maxWidth?: string
  /** z-50 por defecto. elevated=true usa z-[60] para apilarse sobre otro ModalShell */
  elevated?: boolean
  /** Oculta el botón X del header. Útil para modales bloqueantes (ej. onboarding). */
  hideClose?: boolean
  /** Contenido fijo al pie del modal. No scrollea con el body. El consumidor maneja su propio padding. */
  footer?: React.ReactNode
  // En <768px el modal ocupa la pantalla completa (h-dvh). Default: false.
  fullscreenMobile?: boolean
  /**
   * Geometría del sistema de diseño (solo funnel de nota). Ausente = geometría legacy.
   *   work   → 724px, anclado a top:60px  (entrevista · revisión · contexto)
   *   decide → 620px, centrado            (confirmación)
   *   done   → 600px, centrado            (éxito)
   *   wait   → 560px, centrado            (generando)
   */
  spinusGeometry?: 'work' | 'decide' | 'done' | 'wait'
  children: React.ReactNode
}

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconBg,
  headerRight,
  maxWidth = 'max-w-lg',
  elevated = false,
  hideClose = false,
  footer,
  fullscreenMobile = false,
  spinusGeometry,
  children,
}: Props) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return

    modalStack += 1
    const myDepth = modalStack
    if (modalStack === 1) {
      prevBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Solo el modal más interno responde al Escape
      if (modalStack === myDepth) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      modalStack -= 1
      if (modalStack === 0) {
        document.body.style.overflow = prevBodyOverflow
      }
    }
  }, [open])

  if (!open) return null

  const zClass = elevated ? 'z-[60]' : 'z-50'
  // Sin la prop, geo es null y los 5 segmentos de abajo son '': el className
  // resultante es idéntico carácter por carácter al de los 16 consumidores.
  const geo = spinusGeometry ? SP_GEO[spinusGeometry] : null
  // Header sin contenido alguno (confirmación: title/subtitle vacíos, sin ícono,
  // sin headerRight, con hideClose): renderizarlo deja una franja blanca con
  // divisor y nada dentro. El `!!geo` lo acota al funnel — para los 15
  // consumidores legacy geo es null y esto es siempre false.
  const headerVacio = !!geo && !icon && !title && !subtitle && !headerRight

  return (
    <Portal>
      <div className={`fixed inset-0 ${zClass} flex items-center justify-center p-4${fullscreenMobile ? ' max-md:p-0 max-md:items-start' : ''}${geo?.wrap ? ` ${geo.wrap}` : ''}`}>
        <div
          className={`absolute inset-0 ${geo ? 'bg-[var(--sp-backdrop)]' : 'bg-black/40 backdrop-blur-sm'} animate-fade-in`}
          onClick={onClose}
        />
        <div
          className={`relative ${geo ? 'bg-white' : 'bg-white/95 backdrop-blur-xl'} rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col animate-modal-enter overflow-hidden${fullscreenMobile ? ' max-md:h-dvh max-md:max-h-dvh max-md:max-w-full max-md:rounded-none' : ''}${geo ? ` ${geo.panel} md:rounded-[var(--sp-r-modal)] md:shadow-[var(--sp-shadow-modal)] md:transition-[max-width] md:duration-[240ms] md:ease-[cubic-bezier(.4,0,.2,1)]` : ''}`}
        >
          {!headerVacio && (
          <div className={`flex items-center justify-between px-5 py-4 border-b ${geo ? 'border-[var(--sp-line-divider)] md:px-6' : 'border-slate-100'} flex-shrink-0`}>
            <div className={`flex items-center ${geo ? 'gap-3.5' : 'gap-2.5'} min-w-0`}>
              {icon && (
                <div className={geo ? 'sp-icobox' : `w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg ?? 'bg-slate-50'}`}>
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className={geo ? 'sp-title-modal truncate' : 'text-sm font-semibold text-[#1d1d1f] truncate'}>{title}</h2>
                {subtitle && <p className={geo ? 'sp-sub-modal truncate' : 'text-[11px] text-[#86868b] truncate'}>{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerRight}
              {/* El botón de cierre NO se migra: el sistema no expone clase de
                  ícono-botón y sus colores actuales ya están cubiertos en dark
                  por ThemeProvider. */}
              {!hideClose && (
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          )}
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {children}
          </div>
          {footer && (
            <div className={`border-t ${geo ? 'border-[var(--sp-line-divider)]' : 'border-slate-100'} flex-shrink-0`}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
