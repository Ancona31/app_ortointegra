'use client'

/**
 * src/components/agenda/CapaBarra.tsx — la capa que cuelga de un botón de la
 * barra de la agenda v2 (tanda I, puntos 15 y 16): el panel de la campana, el
 * menú del engrane y la leyenda de estados. Tres usos reales en este encargo.
 *
 * Hace sólo lo que los tres comparten: va en un `Portal` con la pinta de las
 * capas de la agenda (`.ag-capa`, sin estética nueva), se coloca DEBAJO de su
 * botón alineada a su borde derecho y ajustada a la ventana (en el teléfono,
 * casi a todo el ancho), y se cierra al tocar fuera. El teclado (Escape, foco,
 * flechas del menú) lo pone quien la usa: un diálogo con `useDialogoModal`, el
 * menú con su propio manejador.
 *
 * ⚠️ PORTAL Y `position: fixed` A PROPÓSITO: `.ag-controles` es un contenedor
 * de consultas (`container-type`), que hace de bloque contenedor de sus
 * descendientes fijos; dentro de él, una capa fija se colocaría respecto a la
 * barra y no a la ventana.
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import Portal from '@/components/ui/Portal'
import { ALTO_MINIMO_CAPA, MARGEN_VENTANA, SEPARACION_CAPA, ventanaParaCapas } from '@/lib/agenda/posicionCapa'

/** Debajo del botón, con su borde derecho; dentro de la ventana visible. */
function colocarBajo(nodo: HTMLElement, boton: Element): void {
  /* B13 · AG8 (CALMA §25–§28, maqueta `ag-herr`): sólo en computadora cuelga del botón, sin velo; en
     Duo y teléfono es tarjeta centrada u hoja con velo, por CSS («.ag-capa-barra»). Aquí no se coloca y
     se quita lo que se hubiera puesto antes de cambiar de formato. */
  const formato = document.documentElement.dataset.formato
  if (formato !== undefined && formato !== 'esc') {
    for (const k of ['left', 'top', 'maxHeight', 'transformOrigin'] as const) nodo.style[k] = ''
    return
  }
  const r = boton.getBoundingClientRect()
  /* B13 · AG8: dentro del área de contenido, sin el cromo (riel en `ext`, barra en `ih`). */
  const v = ventanaParaCapas()
  const desde = v.left ?? 0
  const alto = window.visualViewport?.height ?? window.innerHeight
  const w = nodo.offsetWidth
  const left = Math.max(desde + MARGEN_VENTANA, Math.min(r.right - w, desde + v.width - w - MARGEN_VENTANA))
  const top = r.bottom + SEPARACION_CAPA
  nodo.style.left = `${left}px`
  nodo.style.top = `${top}px`
  nodo.style.maxHeight = `${Math.max(ALTO_MINIMO_CAPA, alto - top - MARGEN_VENTANA)}px`
  nodo.style.transformOrigin = 'top right'
}

interface Props {
  /** El botón del que cuelga (su caja manda; tocarlo con la capa abierta lo cierra él, no la capa). */
  boton: HTMLElement
  rol: 'dialog' | 'menu'
  etiqueta: string
  clase?: string
  alCerrar: () => void
  /** El ref de quien pone el foco (`montarPanel` de `useDialogoModal`, o el del menú). */
  alMontar?: (nodo: HTMLDivElement | null) => void
  alPulsarTecla?: (e: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
  /** Marcas para las pruebas y el CSS (`data-*`). */
  datos?: Record<`data-${string}`, string>
}

export function CapaBarra({ boton, rol, etiqueta, clase, alCerrar, alMontar, alPulsarTecla, children, datos }: Props): ReactElement {
  const panel = useRef<HTMLDivElement | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    panel.current = nodo
    if (nodo) colocarBajo(nodo, boton)
    alMontar?.(nodo)
  }, [boton, alMontar])
  useEffect(() => {
    const recolocar = (): void => { if (panel.current) colocarBajo(panel.current, boton) }
    const alTocar = (e: PointerEvent): void => {
      if (!panel.current || !(e.target instanceof Node)) return
      if (panel.current.contains(e.target) || boton.contains(e.target)) return
      // Con OTRO diálogo modal abierto encima (un aviso), el toque es suyo —también en su velo, que es hermano—.
      const otro = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(d => d !== panel.current)
      if (otro) return
      alCerrar()
    }
    window.addEventListener('resize', recolocar)
    document.addEventListener('pointerdown', alTocar, true)
    return () => {
      window.removeEventListener('resize', recolocar)
      document.removeEventListener('pointerdown', alTocar, true)
    }
  }, [boton, alCerrar])
  return (
    <Portal>
      {/* B13 · AG8 · el velo del catálogo fuera de computadora (en `esc` no se pinta: CSS). */}
      <div className="ag-capa-velo ag-capa-barra-velo" aria-hidden="true" />
      <div ref={montar} role={rol} aria-label={etiqueta} aria-modal={rol === 'dialog' ? true : undefined} tabIndex={-1}
        onKeyDown={alPulsarTecla} className={`ag-capa ag-capa-barra${clase ? ` ${clase}` : ''}`} data-estado="abierta" {...datos}>
        {children}
      </div>
    </Portal>
  )
}
