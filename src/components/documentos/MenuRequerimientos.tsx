'use client'

/**
 * Requerimientos especiales del internamiento — SIN fichas a la vista (pedido
 * expreso del dueño: «una vista más limpia sin que aparecieran los chips,
 * solamente si se seleccionara la opción»). Un botón abre un menú con los
 * siete de siempre como casillas y un campo «Otro»; lo elegido se muestra como
 * fichas con ✕.
 *
 * Lo guardado no cambia: `requerimientos` es la lista de los elegidos en el
 * orden en que se eligen (como hoy) y `requerimientosExtra` sigue siendo UNA
 * cadena. Por eso «Otro» con Enter la ESCRIBE (sustituye la anterior), y el
 * campo nace con la que hubiera para poder corregirla.
 *
 * El menú es una capa propia con `role="menu"`: el plegado «al tocar fuera» del
 * formulario no la cuenta como fuera. No es `fixed`: va `absolute` debajo del
 * botón, dentro de la sección.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { Check, Plus, X } from 'lucide-react'
import { alternar } from '@/components/documentos/internamientoCompacto'

export const REQUERIMIENTOS = [
  'Sangre y hemoderivados',
  'Unidad de Cuidados Intensivos (UCI)',
  'Material de osteosíntesis',
  'Implante especial',
  'Ayuno preoperatorio',
  'Profilaxis antibiótica',
  'Tromboprofilaxis',
]

interface Props {
  requerimientos: readonly string[]
  extra: string
  onRequerimientos: (lista: string[]) => void
  onExtra: (valor: string) => void
}

export default function MenuRequerimientos({ requerimientos, extra, onRequerimientos, onExtra }: Props): ReactElement {
  const [abierto, setAbierto] = useState(false)
  const [otro, setOtro] = useState('')
  const botonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra al tocar fuera del menú y de su botón.
  useEffect(() => {
    if (!abierto) return
    const alBajar = (e: PointerEvent) => {
      const t = e.target
      if (t instanceof Node && !menuRef.current?.contains(t) && !botonRef.current?.contains(t)) setAbierto(false)
    }
    document.addEventListener('pointerdown', alBajar, true)
    return () => document.removeEventListener('pointerdown', alBajar, true)
  }, [abierto])

  const items = (): HTMLElement[] =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"], input') ?? [])

  function abrir(): void {
    setOtro(extra)
    flushSync(() => setAbierto(true))
    items()[0]?.focus({ preventScroll: true })
    // Cerca del pie, el menú cae fuera de la vista: se trae entero.
    menuRef.current?.scrollIntoView({ block: 'nearest' })
  }
  function cerrar(volver: boolean): void {
    flushSync(() => setAbierto(false))
    if (volver) botonRef.current?.focus()
  }

  function teclaMenu(e: KeyboardEvent<HTMLDivElement>): void {
    const its = items()
    const i = its.findIndex(x => x === document.activeElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      its[(i + (e.key === 'ArrowDown' ? 1 : its.length - 1)) % its.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      if (document.activeElement instanceof HTMLInputElement) return
      e.preventDefault()
      its[e.key === 'Home' ? 0 : its.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar(true)
    } else if (e.key === 'Tab') {
      // Sale del menú hacia lo siguiente de la sección, como un menú del sistema.
      // Lo escrito en «Otro» se queda. Se cierra DESPUÉS del Tab: desmontar el
      // menú con el foco dentro lo tiraría al <body> y el Tab saltaría al
      // principio de la página.
      if (document.activeElement instanceof HTMLInputElement && otro.trim() !== '') confirmarOtro()
      setTimeout(() => setAbierto(false), 0)
    }
  }

  function confirmarOtro(): void {
    onExtra(otro.trim())
  }

  const elegidos = [...requerimientos, ...(extra.trim() ? [extra.trim()] : [])]

  return (
    <div className="sp-int-reqs">
      <span className="sp-int-rot" aria-hidden="true">Requiere</span>
      {requerimientos.map(r => (
        <span key={r} className="sp-int-ficha">
          {r}
          <button type="button" onClick={() => onRequerimientos(requerimientos.filter(x => x !== r))}
            aria-label={`Quitar ${r}`}><X aria-hidden="true" /></button>
        </span>
      ))}
      {extra.trim() !== '' && (
        <span className="sp-int-ficha">
          {extra.trim()}
          <button type="button" onClick={() => onExtra('')} aria-label={`Quitar ${extra.trim()}`}>
            <X aria-hidden="true" />
          </button>
        </span>
      )}
      <button ref={botonRef} type="button" className="k-b k-b-texto sp-int-reqbtn"
        aria-haspopup="menu" aria-expanded={abierto} aria-controls={abierto ? 'internamiento-requerimientos-menu' : undefined}
        onClick={() => (abierto ? cerrar(true) : abrir())}>
        <Plus aria-hidden="true" size={16} /> {elegidos.length > 0 ? 'Agregar' : 'Agregar requerimiento'}
      </button>
      {abierto && (
        <div ref={menuRef} id="internamiento-requerimientos-menu" role="menu"
          aria-label="Requerimientos especiales" className="sp-int-menu" onKeyDown={teclaMenu}>
          {REQUERIMIENTOS.map(r => {
            const marcado = requerimientos.includes(r)
            return (
              <button key={r} type="button" role="menuitemcheckbox" aria-checked={marcado}
                tabIndex={-1} className="sp-int-menu-op"
                onClick={() => onRequerimientos(alternar(requerimientos, r))}>
                <span className="sp-int-casilla" aria-hidden="true">{marcado && <Check />}</span>
                {r}
              </button>
            )
          })}
          <label className="sp-int-menu-otro">
            <span className="sp-int-rot">Otro</span>
            <input type="text" value={otro} autoComplete="off" tabIndex={-1}
              onChange={e => setOtro(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarOtro() } }}
              aria-label="Otro requerimiento" placeholder="El que no esté en la lista y Enter"
              className="sp-int-menu-fi" />
          </label>
        </div>
      )}
    </div>
  )
}
