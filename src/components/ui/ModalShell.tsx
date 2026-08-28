'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'

/* ═══ ACCESIBILIDAD DEL DIÁLOGO (bloque 9 de la agenda) ═══════════════════════
   Lo que le faltaba a este componente: rol de diálogo, nombre accesible, foco
   inicial, foco ATRAPADO y devolución del foco al cerrar. El Escape y el bloqueo
   del scroll ya estaban.

   ⚠️ ESTA MISMA LÓGICA ESTÁ ESCRITA OTRAS DOS VECES —en `agenda/page.tsx`, como
   el hook `useDialogoModal` que comparten sus tres modales, y en
   `agenda/ModalInvitacionCita.tsx`—. Son TRES COPIAS Y SE SABE. Aquellos cuatro
   modales NO usan este componente: montan su propio portal porque su geometría
   (pantalla completa, seguimiento del `visualViewport`, áreas seguras) no cabe
   aquí, y unificarlos era arriesgar una ronda de trabajo que ya está hecha.
   Si tocas el trapo del foco, tócalo en las tres. */

/* Lo que puede recibir foco dentro de un panel, en orden de DOM. Sin `details`
   ni `iframe` ni `audio/video[controls]`: no hay ninguno en los 26 consumidores,
   y una lista corta que se entiende vale más que una exhaustiva que no. */
const SELECTOR_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* ⚠️ EL FILTRO DE VISIBILIDAD NO ES `offsetParent !== null`, y es el error
   clásico: `offsetParent` vale null también para cualquier ancestro
   `position: fixed`, o sea para TODO panel montado en un portal fijo — con esa
   comprobación la lista salía vacía siempre y el trapo no atrapaba nada.
   Medir caja sí funciona: un `display: none` mide 0×0 y lo demás no. */
function focusablesDe(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELECTOR_FOCO))
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0)
}

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

  const panelRef = useRef<HTMLDivElement | null>(null)
  /* Callback ref: React lo llama con el nodo justo cuando el portal lo monta, que
     es lo que un efecto con deps `[open]` se pierde. Ver el aviso del efecto.
     ⚠️ `useCallback` CON DEPS `[]` ES OBLIGATORIO: con identidad nueva en cada
     render React lo llamaría con `null` y con el nodo EN CADA RENDER, y el panel
     robaría el foco en cada tecla que se escriba dentro del modal.
     Foco en el PANEL y no en su primer control a propósito: ése suele ser la ✕,
     así que enfocarlo pondría «Cerrar» como lo primero que se oye de un diálogo
     recién abierto. Desde el panel, el lector lee el nombre y el Tab siguiente ya
     entra en el contenido. `preventScroll` porque el panel puede estar bajo el
     pliegue mientras entra su animación. */
  const montarPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    /* ⚠️ SÓLO SI EL FOCO NO ESTÁ YA DENTRO. Varios de los 26 consumidores llevan
       `autoFocus` en su primer campo, y React lo aplica ANTES de atar el ref del
       padre —la fase de layout va de dentro hacia fuera—, así que un `focus()` a
       secas se lo comería y el cursor saldría del campo. Que el foco caiga en un
       control de dentro no estropea el anuncio: con `role="dialog"`, `aria-modal`
       y el nombre puestos, un lector nombra el diálogo al entrar en él. */
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
  }, [])
  /* Id del <h2> de la cabecera, para `aria-labelledby`. `useId` y no una
     constante: con dos modales abiertos a la vez —que es un caso real, de ahí el
     `modalStack`— dos ids iguales dejarían el nombre del diálogo interno
     apuntando al título del externo. */
  const tituloId = useId()

  useEffect(() => {
    if (!open) return

    modalStack += 1
    const myDepth = modalStack
    if (modalStack === 1) {
      prevBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    /* Quién tenía el foco antes de abrir. Se guarda ANTES de moverlo, y se le
       devuelve al cerrar: sin esto, cerrar un modal manda el foco al <body> y
       quien navega con teclado vuelve a empezar desde arriba de la página. */
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    /* ⚠️ EL FOCO INICIAL NO PUEDE IR AQUÍ, Y AQUÍ ESTUVO SIN HACER NADA. `Portal`
       devuelve `null` en su primer render —monta a sus hijos en el segundo—, así
       que cuando este efecto corre EL PANEL NO EXISTE TODAVÍA EN EL DOM y
       `panelRef.current` vale `null`: el `focus()` era un no-op silencioso. Lo
       hace ahora `montarPanel`, el callback ref, al que React llama con el nodo
       en el commit en que aparece.
       LO DEMÁS DE ESTE EFECTO SÍ FUNCIONABA y no se toca: el Escape y el trapo
       cuelgan de `document` y leen `panelRef.current` EN EL MOMENTO DE LA TECLA,
       cuando ya está puesto; y `previo` se captura bien porque aquí el foco
       todavía no se ha movido —el callback ref corre después—. */

    const onKey = (e: KeyboardEvent) => {
      // Solo el modal más interno responde, igual que hacía ya el Escape.
      if (modalStack !== myDepth) return
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focos = focusablesDe(panel)
      /* Un panel sin nada enfocable —una confirmación de sólo texto— devuelve el
         foco a sí mismo en vez de dejarlo salir al documento de detrás. */
      if (focos.length === 0) { e.preventDefault(); panel.focus({ preventScroll: true }); return }

      const primero = focos[0]
      const ultimo  = focos[focos.length - 1]
      const activo  = document.activeElement
      /* La rama `!panel.contains(activo)` es la que cubre el estado inicial, con
         el foco en el propio panel: sin ella el primer Tab se iba al documento. */
      if (e.shiftKey && (activo === primero || !panel.contains(activo))) {
        e.preventDefault(); ultimo.focus()
      } else if (!e.shiftKey && (activo === ultimo || !panel.contains(activo))) {
        e.preventDefault(); primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      modalStack -= 1
      if (modalStack === 0) {
        document.body.style.overflow = prevBodyOverflow
      }
      previo?.focus({ preventScroll: true })
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
        {/* ⚠️ EL RELLENO VERTICAL DE LA RAMA `fullscreenMobile` ES DEL PASO 10.
            Ahí el panel es `h-dvh` de borde a borde, y desde que el viewport es
            `viewport-fit=cover` esos bordes son los FÍSICOS: la cabecera nacía
            bajo el reloj y el pie bajo la barra de gestos.
            ⚠️ VA EN EL PANEL Y NO EN LA CABECERA Y EL PIE POR SEPARADO, que era
            la otra forma. Motivo: el pie es OPCIONAL y la cabecera se oculta
            cuando está vacía (`headerVacio`), así que repartirlo daría cuatro
            combinaciones y en dos de ellas el hueco se lo comería quien no está.
            Puesto aquí, encoge lo que haya dentro sea lo que sea.
            ⚠️ Y NO DESBORDA: con `box-sizing: border-box` —el preflight de
            Tailwind— el relleno va DENTRO del `h-dvh`, así que el panel sigue
            midiendo exactamente la pantalla y su fondo llega a los cuatro
            bordes. Si alguien cambia el `h-dvh` por un alto de contenido, esto
            hay que revisarlo.
            ⚠️ SÓLO VERTICAL: los insets laterales sólo valen algo en apaisado y
            el manifiesto fija `portrait-primary`.
            ⚠️ LA OTRA RAMA NO SE TOCA. Sin `fullscreenMobile` el modal se centra
            con `p-4` y `max-h-[85vh]`, o sea que no toca ningún borde. */}
        {/* ⚠️ EL NOMBRE DEL DIÁLOGO SALE DEL <h2> CUANDO LA CABECERA SE PINTA, Y
            DEL `title` CUANDO NO. `headerVacio` esconde la cabecera entera en el
            funnel de nota, y un `aria-labelledby` apuntando a un id que no está
            en el DOM deja al diálogo SIN NOMBRE — peor que no ponerlo, porque
            parece puesto. La rama del `aria-label` cubre ese caso; si además el
            `title` viene vacío, los dos quedan en `undefined` y el diálogo se
            anuncia sin nombre, que es lo honesto.
            `tabIndex={-1}` no lo mete en el recorrido del Tab: sólo lo hace
            enfocable por programa, que es lo que pide el foco inicial. */}
        <div
          ref={montarPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={!headerVacio && title ? tituloId : undefined}
          aria-label={headerVacio && title ? title : undefined}
          tabIndex={-1}
          /* `focus:outline-none` SÍ, y no contradice la regla de «nunca
             `outline: none` sin reemplazo»: ésa protege a los CONTROLES, y este
             panel no es uno —no está en el recorrido del Tab y sólo recibe el
             foco por programa, al abrir—. Sin esto, Chrome dibuja un anillo
             alrededor del modal entero en cuanto la última interacción fue de
             teclado. Los controles de dentro conservan el suyo. */
          className={`relative focus:outline-none ${geo ? 'bg-white' : 'bg-white/95 backdrop-blur-xl'} rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col animate-modal-enter overflow-hidden${fullscreenMobile ? ' max-md:h-dvh max-md:max-h-dvh max-md:max-w-full max-md:rounded-none max-md:pt-[env(safe-area-inset-top,0px)] max-md:pb-[env(safe-area-inset-bottom,0px)]' : ''}${geo ? ` ${geo.panel} md:rounded-[var(--sp-r-modal)] md:shadow-[var(--sp-shadow-modal)] md:transition-[max-width] md:duration-[240ms] md:ease-[cubic-bezier(.4,0,.2,1)]` : ''}`}
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
                <h2 id={tituloId} className={geo ? 'sp-title-modal truncate' : 'text-sm font-semibold text-[#1d1d1f] truncate'}>{title}</h2>
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
