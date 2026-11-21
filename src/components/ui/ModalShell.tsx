'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { animate } from 'motion/react'
import Portal from '@/components/ui/Portal'
import { leerFormato } from '@/lib/formatoPantalla'

/* ═══ CAPA DEL CATÁLOGO: MODAL Y ALERTA (rediseño B3, CALMA §13, §25, §26) ═════
   La MISMA API de siempre (`title`, `footer`, `elevated`, `fullscreenMobile`,
   `spinusGeometry`…) con el aspecto y el movimiento del kit. El CSS vive en
   `sistema.css` («CAPAS DEL CATÁLOGO»): `.k-capa`, `.k-velo`, `.k-capa-panel`.

   PRESENTACIÓN POR FORMATO, SÓLO CON CSS (ningún marcado depende del formato):
     ext  tarjeta centrada de 310 en el área de contenido (sin riel ni franja)
     tel  hoja desde abajo, arrastrable para cerrar (la alerta, centrada)
     ih / iv / esc  tarjeta centrada en el área de contenido

   AÑADIDO (opcional; sin él, todo es como antes):
     variante="alerta"  patrón único de alerta: icono en círculo de 48 (el
                        `icon`, de 28), título centrado, `children` como
                        mensaje y `footer` como los BOTONES SUELTOS (un
                        Fragment, secundario primero; el principal con
                        `data-principal`). Dos lado a lado; con `apilada`, a
                        todo el ancho con el principal arriba (rótulos largos,
                        §23.3). El velo NO la cierra; Esc sí. Rol
                        `alertdialog` salvo que `rol` diga otra cosa.
                        Foco: pon `autoFocus` en el principal, o en
                        «Cancelar» si la alerta destruye (capas-a, vista 1).
     tono               color del círculo: confirmar (tonal), destruir
                        (rojo suave), avisar (ámbar).

   SALIDA ANIMADA: con `open={false}` la capa se queda montada 260 ms, inerte y
   sin recibir clics, mientras sale por el mismo camino por el que entró. El
   foco vuelve al disparador y el scroll se libera AL EMPEZAR a salir, no al
   final. Reabrir a medio salir invierte la transición desde donde esté.

   ⚠️ ESTA LÓGICA DE FOCO ESTÁ ESCRITA OTRAS DOS VECES —`useDialogoModal` de la
   agenda y `agenda/ModalInvitacionCita.tsx`—, que no usan este componente. Si
   tocas el trapo del foco, tócalo en las tres. */

/* Lo que puede recibir foco dentro de un panel, en orden de DOM. */
const SELECTOR_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* ⚠️ EL FILTRO DE VISIBILIDAD NO ES `offsetParent !== null`: vale null para
   todo lo que cuelga de un portal `position: fixed`. Medir caja sí funciona. */
export function focusablesDe(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELECTOR_FOCO))
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0)
}

/** Lo que tarda en irse una capa (la transición más larga de salida, 240 ms, más margen). */
const MS_SALIDA = 260

/**
 * Montaje con salida animada. `montada` sigue en true `MS_SALIDA` ms después
 * de `open={false}`; mientras, la capa pinta `data-fase="sale"`.
 * El ajuste al abrir va DURANTE el render (el patrón de React para reaccionar a
 * una prop), no en un efecto: un efecto pintaría un fotograma sin la capa.
 */
export function useCapaMontada(open: boolean): boolean {
  const [montada, setMontada] = useState(open)
  const [previo, setPrevio] = useState(open)
  if (previo !== open) {
    setPrevio(open)
    if (open) setMontada(true)
  }
  useEffect(() => {
    if (open || !montada) return
    const t = window.setTimeout(() => setMontada(false), MS_SALIDA)
    return () => window.clearTimeout(t)
  }, [open, montada])
  return montada
}

/* ── Arrastre de la hoja de teléfono (capas-a, vista 3; skill apple-design
   §2, §5, §6, §9) ──────────────────────────────────────────────────────────
   Umbral de 10 px; luego sigue al dedo 1:1; hacia arriba, rubber-band. Al
   soltar se proyecta la inercia (deceleración .998): si el punto proyectado
   pasa de la mitad, cierra; si no, vuelve. La velocidad del dedo pasa al
   resorte de `motion`. El velo sigue al dedo. */
interface Gesto { panel: HTMLElement; velo: HTMLElement | null; y0: number; alto: number; tomado: boolean; pos: number; muestras: { y: number; t: number }[] }

const NO_ARRASTRA = 'input, textarea, select, [contenteditable="true"], .k-capa-cuerpo, .k-menu-l'

function pintarGesto(g: Gesto, y: number): void {
  g.pos = y
  g.panel.style.transform = `translateY(${y}px)`
  if (g.velo) g.velo.style.opacity = String(Math.max(0, Math.min(1, 1 - y / g.alto)))
}

function limpiarGesto(g: Gesto): void {
  g.panel.style.transform = ''
  g.panel.style.transition = ''
  if (g.velo) { g.velo.style.opacity = ''; g.velo.style.transition = '' }
}

function velocidadDe(g: Gesto): number {
  const ahora = performance.now()
  const recientes = g.muestras.filter(m => ahora - m.t < 100)
  if (recientes.length < 2) return 0
  const a = recientes[0]
  const b = recientes[recientes.length - 1]
  return b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0
}

function soltarGesto(g: Gesto, alCerrar: () => void): void {
  const v = velocidadDe(g)
  const proyectado = g.pos + ((v / 1000) * 0.998) / (1 - 0.998)
  const cierra = proyectado > g.alto / 2
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducido) {
    if (cierra) alCerrar(); else limpiarGesto(g)
    return
  }
  const rapido = Math.abs(v) > 300
  animate(g.pos, cierra ? g.alto : 0, {
    type: 'spring', velocity: v, bounce: rapido ? 0.2 : 0, duration: rapido ? 0.3 : 0.36,
    onUpdate: y => pintarGesto(g, y),
    onComplete: () => {
      if (!cierra) { limpiarGesto(g); return }
      alCerrar()
      /* Si quien la abrió no la cierra (pide confirmar, por ejemplo), la hoja
         no se queda escondida: vuelve a su sitio. */
      window.setTimeout(() => {
        if (g.panel.isConnected && g.panel.parentElement?.dataset.fase === 'abierta') {
          animate(g.pos, 0, { type: 'spring', bounce: 0, duration: 0.36, onUpdate: y => pintarGesto(g, y), onComplete: () => limpiarGesto(g) })
        }
      }, 60)
    },
  })
}

function moverGesto(g: Gesto, e: PointerEvent): void {
  const dy = e.clientY - g.y0
  if (!g.tomado) {
    if (Math.abs(dy) < 10) return
    g.tomado = true
    g.y0 = e.clientY
    g.panel.style.transition = 'none'
    if (g.velo) g.velo.style.transition = 'none'
  }
  const y = e.clientY - g.y0
  /* Rubber-band (c = .55): cuanto más pasa del tope, menos sigue. */
  const pos = y >= 0 ? y : -((-y * g.alto * 0.55) / (g.alto + 0.55 * -y))
  g.muestras.push({ y: e.clientY, t: performance.now() })
  if (g.muestras.length > 8) g.muestras.shift()
  pintarGesto(g, pos)
}

/** Devuelve el `onPointerDown` de la hoja. `puede()` se pregunta al tocar (el formato puede cambiar). */
export function useArrastreHoja(
  panelRef: RefObject<HTMLElement | null>,
  veloRef: RefObject<HTMLElement | null>,
  puede: () => boolean,
  alCerrar: () => void,
): (e: React.PointerEvent<HTMLElement>) => void {
  const cerrarRef = useRef(alCerrar)
  const puedeRef = useRef(puede)
  useEffect(() => { cerrarRef.current = alCerrar; puedeRef.current = puede }, [alCerrar, puede])
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    const panel = panelRef.current
    if (!panel || e.button !== 0 || !puedeRef.current()) return
    if (e.target instanceof Element && e.target.closest(NO_ARRASTRA)) return
    const g: Gesto = { panel, velo: veloRef.current, y0: e.clientY, alto: panel.offsetHeight - 80, tomado: false, pos: 0, muestras: [] }
    const mover = (ev: PointerEvent): void => moverGesto(g, ev)
    const soltar = (): void => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      if (g.tomado) soltarGesto(g, () => cerrarRef.current())
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }, [panelRef, veloRef])
}

/* ── Foco atrapado, Escape y bloqueo del scroll ──────────────────────────── */
// Contador global para el bloqueo del scroll con modales anidados: sólo el
// primero en abrir bloquea; sólo el último en cerrar libera.
let modalStack = 0
let prevBodyOverflow = ''

function teclaDelModal(e: KeyboardEvent, panel: HTMLElement | null, cerrar: () => void): void {
  if (e.key === 'Escape') { cerrar(); return }
  if (e.key !== 'Tab' || !panel) return
  const focos = focusablesDe(panel)
  /* Sin nada enfocable, el foco vuelve al panel en vez de salir al documento. */
  if (focos.length === 0) { e.preventDefault(); panel.focus({ preventScroll: true }); return }
  const primero = focos[0]
  const ultimo = focos[focos.length - 1]
  const activo = document.activeElement
  /* `!panel.contains(activo)` cubre el estado inicial, con el foco en el panel. */
  if (e.shiftKey && (activo === primero || !panel.contains(activo))) {
    e.preventDefault(); ultimo.focus()
  } else if (!e.shiftKey && (activo === ultimo || !panel.contains(activo))) {
    e.preventDefault(); primero.focus()
  }
}

/**
 * Mientras `open`: bloquea el scroll, atrapa el Tab y cierra con Escape (sólo
 * el modal más interno). Al cerrar —al EMPEZAR a salir— devuelve el foco a
 * quien lo tenía antes de abrir. El foco inicial lo pone el callback ref del
 * panel: aquí el panel todavía no existe (`Portal` monta en su 2.º render).
 */
function useFocoDelModal(open: boolean, panelRef: RefObject<HTMLElement | null>, cerrarRef: RefObject<() => void>): void {
  useEffect(() => {
    if (!open) return
    modalStack += 1
    const myDepth = modalStack
    if (modalStack === 1) {
      prevBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: KeyboardEvent): void => {
      if (modalStack !== myDepth) return
      teclaDelModal(e, panelRef.current, () => cerrarRef.current())
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      modalStack -= 1
      if (modalStack === 0) document.body.style.overflow = prevBodyOverflow
      previo?.focus({ preventScroll: true })
    }
  }, [open, panelRef, cerrarRef])
}

// Ancho del sistema de diseño anterior, por forma de estado (sólo ≥ 768 px).
// Strings literales completos: el escáner de Tailwind lee el fuente como texto.
const SP_GEO = {
  work:   'md:max-w-[724px] md:max-h-[calc(100vh-120px)]',
  decide: 'md:max-w-[620px]',
  done:   'md:max-w-[600px]',
  wait:   'md:max-w-[560px]',
} as const

type Tono = 'confirmar' | 'destruir' | 'avisar'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  iconBg?: string
  headerRight?: React.ReactNode
  /** Tailwind max-w-* class. Default: max-w-lg (en `ext`, 310 como mucho; en `tel`, todo el ancho). */
  maxWidth?: string
  /** z-50 por defecto. elevated=true usa z-[60] para apilarse sobre otro ModalShell */
  elevated?: boolean
  /** Oculta el botón X del header (y en teléfono, el arrastre para cerrar). */
  hideClose?: boolean
  /** Contenido fijo al pie. No se desplaza con el cuerpo. El consumidor pone su relleno. En la alerta: los botones sueltos. */
  footer?: React.ReactNode
  /** En teléfono la capa ocupa la pantalla completa, sin arrastre. Default: false. */
  fullscreenMobile?: boolean
  /**
   * Ancho del sistema anterior (sólo funnel de nota). Ausente = el de `maxWidth`.
   *   work 724 · decide 620 · done 600 · wait 560
   */
  spinusGeometry?: 'work' | 'decide' | 'done' | 'wait'
  /** Patrón único de alerta (ver la cabecera del archivo). */
  variante?: 'alerta'
  /** Color del icono de la alerta. Default: confirmar. */
  tono?: Tono
  /** Alerta con los botones apilados, el principal (`data-principal`) arriba. */
  apilada?: boolean
  /** Rol del panel. Default: `dialog`, y `alertdialog` en la alerta. */
  rol?: 'dialog' | 'alertdialog'
  children: React.ReactNode
}

interface CabeceraProps {
  tituloId: string; title: string; subtitle?: string; icon?: ReactNode; iconBg?: string
  geo: boolean; headerRight?: ReactNode; hideClose: boolean; onClose: () => void
}

function CabeceraModal({ tituloId, title, subtitle, icon, iconBg, geo, headerRight, hideClose, onClose }: CabeceraProps): ReactElement {
  return (
    <div className="k-capa-cab">
      {icon && <div className={geo ? 'sp-icobox' : `k-capa-ico ${iconBg ?? 'bg-slate-50'}`}>{icon}</div>}
      <div className="k-capa-tits">
        <h2 id={tituloId} className="k-capa-tit">{title}</h2>
        {subtitle && <p className="k-capa-sub">{subtitle}</p>}
      </div>
      <div className="k-capa-acc">
        {headerRight}
        {!hideClose && (
          <button type="button" onClick={onClose} className="k-b k-b-icono" aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

interface AlertaProps {
  tituloId: string; title: string; subtitle?: string; icon?: ReactNode; tono: Tono; apilada: boolean
  footer?: ReactNode; children: ReactNode
}

function CuerpoAlerta({ tituloId, title, subtitle, icon, tono, apilada, footer, children }: AlertaProps): ReactElement {
  return (
    <div className="k-al">
      {icon && <span className={`k-al-i k-al-i-${tono}`} aria-hidden="true">{icon}</span>}
      <h2 id={tituloId} className="k-al-tit">{title}</h2>
      {subtitle && <p className="k-al-sub">{subtitle}</p>}
      <div className="k-al-t">{children}</div>
      {footer && <div className={`k-al-b${apilada ? ' k-al-pila' : ''}`}>{footer}</div>}
    </div>
  )
}

/** Qué presentación pide la capa en teléfono (el CSS la aplica sólo en `tel`). */
function modoDe(variante: Props['variante'], fullscreenMobile: boolean): 'hoja' | 'completa' | undefined {
  if (variante === 'alerta') return undefined
  return fullscreenMobile ? 'completa' : 'hoja'
}

export default function ModalShell({
  open, onClose, title, subtitle, icon, iconBg, headerRight,
  maxWidth = 'max-w-lg', elevated = false, hideClose = false, footer,
  fullscreenMobile = false, spinusGeometry, variante, tono = 'confirmar', apilada = false, rol, children,
}: Props): ReactElement | null {
  const montada = useCapaMontada(open)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const panelRef = useRef<HTMLDivElement | null>(null)
  const veloRef = useRef<HTMLDivElement | null>(null)
  /* Callback ref: React lo llama con el nodo cuando el portal lo monta.
     ⚠️ DEPS `[]` OBLIGATORIAS: con identidad nueva en cada render robaría el
     foco en cada tecla. Foco en el PANEL y no en su primer control (suele ser
     la ✕), y SÓLO SI NO ESTÁ YA DENTRO: un `autoFocus` de dentro gana. */
  const montarPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
  }, [])
  /* `useId`: con dos modales abiertos, dos ids iguales cruzarían los nombres. */
  const tituloId = useId()
  useFocoDelModal(open, panelRef, onCloseRef)

  const esAlerta = variante === 'alerta'
  const modo = modoDe(variante, fullscreenMobile)
  const arrastra = modo === 'hoja' && !hideClose
  const puedeArrastrar = useCallback(() => arrastra && leerFormato() === 'tel', [arrastra])
  const cerrar = useCallback(() => onCloseRef.current(), [])
  const alPulsar = useArrastreHoja(panelRef, veloRef, puedeArrastrar, cerrar)

  if (!montada) return null

  const geo = spinusGeometry ? SP_GEO[spinusGeometry] : ''
  // Cabecera sin nada (funnel de nota, con hideClose): no se pinta, y el nombre
  // del diálogo sale entonces de `aria-label` (un `aria-labelledby` a un id
  // ausente lo dejaría sin nombre).
  const headerVacio = !!geo && !icon && !title && !subtitle && !headerRight
  const nombrado = esAlerta || !headerVacio

  return (
    <Portal>
      <div
        className={`k-capa fixed inset-0 ${elevated ? 'z-[60]' : 'z-50'}`}
        data-fase={open ? 'abierta' : 'sale'} data-modo={modo} data-variante={variante}
        inert={!open || undefined} aria-hidden={!open || undefined}
      >
        <div ref={veloRef} className="k-velo" onClick={esAlerta ? undefined : onClose} />
        <div
          ref={montarPanel}
          role={rol ?? (esAlerta ? 'alertdialog' : 'dialog')}
          aria-modal="true"
          aria-labelledby={nombrado && title ? tituloId : undefined}
          aria-label={!nombrado && title ? title : undefined}
          tabIndex={-1}
          lang="es"
          onPointerDown={alPulsar}
          className={`k-capa-panel${esAlerta ? '' : ` ${maxWidth} ${geo}`}`}
        >
          {arrastra && <div className="k-capa-asa" aria-hidden="true" />}
          {esAlerta ? (
            <CuerpoAlerta tituloId={tituloId} title={title} subtitle={subtitle} icon={icon} tono={tono} apilada={apilada} footer={footer}>
              {children}
            </CuerpoAlerta>
          ) : (
            <>
              {!headerVacio && (
                <CabeceraModal tituloId={tituloId} title={title} subtitle={subtitle} icon={icon} iconBg={iconBg}
                  geo={!!geo} headerRight={headerRight} hideClose={hideClose} onClose={onClose} />
              )}
              <div className="k-capa-cuerpo">{children}</div>
              {footer && <div className="k-capa-pie">{footer}</div>}
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}
