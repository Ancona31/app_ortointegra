'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useArrastreHoja, useCapaMontada } from '@/components/ui/ModalShell'
import { leerFormato } from '@/lib/formatoPantalla'

/* ═══ MENÚ DEL CATÁLOGO (rediseño B3; capas-a vista 4; CALMA §11, §21, §25, §26)
   Para «···», orden, filtros y selectores: lo que se usa poco. Una sola pieza
   que se presenta según el formato (lo lee al ABRIR, nunca en el primer render):
     esc            desplegable anclado a su botón, SIN velo, contorno fino;
                    se abre hacia arriba si abajo no cabe
     ext / ih / iv  tarjeta centrada de 280 en el área de contenido, con velo
     tel            hoja corta desde abajo, arrastrable para cerrar

   API
     <CapaMenu
       abierto={bool}             // el consumidor guarda el estado
       alCerrar={() => …}         // Esc, velo, clic fuera, desplazar (esc), Tab,
                                  // elegir una opción, arrastre (tel)
       ancla={refDelBoton}        // el «···»: ancla el desplegable y recibe el
                                  // foco al cerrar
       titulo="Acciones del paciente"   // nombre del menú; título visible
                                        // en tarjeta y hoja
       opciones={[{ id, texto, icono?, detalle?, peligro?, marcada?,
                    deshabilitada?, alElegir }]}
       seleccion                  // opcional: `menuitemradio` con palomita en
                                  // la `marcada` (orden, filtros)
     />
   El BOTÓN es del consumidor y lleva `aria-haspopup="menu"`,
   `aria-expanded={abierto}` y su `aria-label`; su `onClick` alterna `abierto`
   (el clic en el ancla no cuenta como «fuera»).
   Las opciones con `peligro` van al final, tras una línea, en rojo. Iconos de
   20 (18 en computadora) en `--enlace`.

   TECLADO: el foco entra en la opción marcada o en la primera; ↑ ↓ Inicio Fin;
   Enter/Espacio elige; Esc cierra y devuelve el foco al ancla; Tab cierra.
   ════════════════════════════════════════════════════════════════════════════ */

export interface OpcionMenu {
  id: string
  texto: string
  icono?: ReactNode
  /** Segunda línea, en `--tinta2` (no en el desplegable de computadora si no hace falta). */
  detalle?: string
  peligro?: boolean
  marcada?: boolean
  deshabilitada?: boolean
  alElegir: () => void
}

interface Props {
  abierto: boolean
  alCerrar: () => void
  ancla: RefObject<HTMLElement | null>
  titulo: string
  opciones: readonly OpcionMenu[]
  seleccion?: boolean
}

type Modo = 'pop' | 'centro' | 'hoja'

function modoActual(): Modo {
  const f = leerFormato()
  if (f === 'tel') return 'hoja'
  if (f === 'esc' || (f === 'desconocido' && window.innerWidth >= 1024)) return 'pop'
  return 'centro'
}

/** Coloca el desplegable bajo su botón (o encima si no cabe) y fija el origen de la escala. */
function colocar(panel: HTMLElement, ancla: HTMLElement): void {
  const b = ancla.getBoundingClientRect()
  const w = panel.offsetWidth
  const h = panel.offsetHeight
  const izq = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8))
  const abajo = b.bottom + 6 + h <= window.innerHeight - 8
  const arr = abajo ? b.bottom + 6 : Math.max(8, b.top - 6 - h)
  panel.style.left = `${izq}px`
  panel.style.top = `${arr}px`
  panel.style.setProperty('--k-origen', `${b.left + b.width / 2 - izq}px ${abajo ? 0 : h}px`)
}

function moverFoco(lista: HTMLElement, e: React.KeyboardEvent): void {
  const ops = Array.from(lista.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'))
  if (ops.length === 0) return
  const i = ops.findIndex(o => o === document.activeElement)
  const destino: Record<string, number> = {
    ArrowDown: (i + 1) % ops.length, ArrowUp: (i - 1 + ops.length) % ops.length, Home: 0, End: ops.length - 1,
  }
  if (destino[e.key] === undefined) return
  e.preventDefault()
  ops[destino[e.key]].focus()
}

/** Cierra al tocar fuera (no el ancla) o al desplazar la página. Sólo en el desplegable. */
function useCierreFuera(activo: boolean, panelRef: RefObject<HTMLElement | null>, ancla: RefObject<HTMLElement | null>, cerrar: () => void): void {
  useEffect(() => {
    if (!activo) return
    const fuera = (e: Event): void => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (panelRef.current?.contains(t) || ancla.current?.contains(t)) return
      cerrar()
    }
    document.addEventListener('pointerdown', fuera, true)
    window.addEventListener('scroll', fuera, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('pointerdown', fuera, true)
      window.removeEventListener('scroll', fuera, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [activo, panelRef, ancla, cerrar])
}

function Opcion({ o, rol, alElegir }: { o: OpcionMenu; rol: string; alElegir: (o: OpcionMenu) => void }): ReactElement {
  return (
    <button
      type="button" role={rol} className="k-menu-op" tabIndex={-1}
      aria-checked={rol === 'menuitemradio' ? !!o.marcada : undefined}
      data-peligro={o.peligro || undefined} disabled={o.deshabilitada}
      onClick={() => alElegir(o)}
    >
      {o.icono && <span className="k-menu-ic" aria-hidden="true">{o.icono}</span>}
      <span className="k-menu-tx">{o.texto}{o.detalle && <small>{o.detalle}</small>}</span>
      {rol === 'menuitemradio' && <Check className="k-menu-chk" aria-hidden="true" />}
    </button>
  )
}

export default function CapaMenu({ abierto, alCerrar, ancla, titulo, opciones, seleccion = false }: Props): ReactElement | null {
  const montada = useCapaMontada(abierto)
  const [modo, setModo] = useState<Modo>('centro')
  const [abiertoPrevio, setAbiertoPrevio] = useState(false)
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto)
    if (abierto) setModo(modoActual())
  }
  const panelRef = useRef<HTMLDivElement | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const veloRef = useRef<HTMLDivElement | null>(null)
  const cerrarRef = useRef(alCerrar)
  useEffect(() => { cerrarRef.current = alCerrar }, [alCerrar])
  const cerrar = useCallback(() => cerrarRef.current(), [])

  useCierreFuera(abierto && modo === 'pop', panelRef, ancla, cerrar)
  const puede = useCallback(() => modo === 'hoja' && leerFormato() === 'tel', [modo])
  const alPulsar = useArrastreHoja(panelRef, veloRef, puede, cerrar)

  /* Al abrir: colocar (desplegable) y llevar el foco a la marcada o la primera.
     Al cerrar (al EMPEZAR a salir): el foco vuelve al ancla. */
  useLayoutEffect(() => {
    if (!abierto) return
    const panel = panelRef.current
    const a = ancla.current
    if (panel && a && modo === 'pop') colocar(panel, a)
    const lista = listaRef.current
    const inicial = lista?.querySelector<HTMLElement>('[aria-checked="true"]') ?? lista?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')
    inicial?.focus({ preventScroll: true })
    return () => { if (a?.isConnected) a.focus({ preventScroll: true }) }
  }, [abierto, modo, ancla])

  /* `createPortal` directo y no `Portal`: éste monta en su 2.º render y el
     efecto de arriba no encontraría el panel para colocarlo y enfocarlo. Sólo
     se monta tras un gesto (nunca en el servidor con `abierto`). */
  if (!montada || typeof document === 'undefined') return null

  const rol = seleccion ? 'menuitemradio' : 'menuitem'
  const normales = opciones.filter(o => !o.peligro)
  const peligrosas = opciones.filter(o => o.peligro)
  const elegir = (o: OpcionMenu): void => { cerrarRef.current(); o.alElegir() }
  const alTeclear = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); cerrarRef.current(); return }
    if (listaRef.current) moverFoco(listaRef.current, e)
  }

  return createPortal(
    <div className="k-capa fixed inset-0 z-[60]" data-fase={abierto ? 'abierta' : 'sale'} data-modo={modo}
      inert={!abierto || undefined} aria-hidden={!abierto || undefined}>
      <div ref={veloRef} className="k-velo" onClick={cerrar} />
      <div ref={panelRef} className="k-capa-panel k-menu" onPointerDown={alPulsar} onKeyDown={alTeclear} lang="es">
        {modo === 'hoja' && <div className="k-capa-asa" aria-hidden="true" />}
        <p className="k-menu-t" aria-hidden="true">{titulo}</p>
        <div ref={listaRef} role="menu" aria-label={titulo} className="k-menu-l">
          {normales.map(o => <Opcion key={o.id} o={o} rol={rol} alElegir={elegir} />)}
          {peligrosas.length > 0 && normales.length > 0 && <div role="separator" className="k-menu-sep" />}
          {peligrosas.map(o => <Opcion key={o.id} o={o} rol={rol} alElegir={elegir} />)}
        </div>
      </div>
    </div>,
    document.body,
  )
}
