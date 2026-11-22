'use client'

/**
 * Grupo de botones de un toque con semántica de `radiogroup` (tipo de
 * internamiento y ASA en la solicitud de internamiento). Un SEGUNDO toque
 * deselecciona: los dos campos son opcionales hoy y un `<select>` permitía
 * volver a «Seleccionar…».
 *
 * Teclado (como la maqueta aprobada): una sola parada de Tab (la marcada, o la
 * primera); ←/→ (y ↑/↓) mueven el foco sin elegir; Espacio o Enter eligen o
 * quitan. Elegir con las flechas cambiaría el valor con sólo recorrer.
 */

import { useRef, type KeyboardEvent, type ReactElement } from 'react'

export interface Opcion { valor: string; etiqueta: string }

interface Props {
  id: string
  /** Nombre accesible del grupo («Tipo de internamiento»). */
  nombre: string
  opciones: readonly Opcion[]
  valor: string
  onCambio: (valor: string) => void
}

export default function OpcionesRapidas({ id, nombre, opciones, valor, onCambio }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const parada = opciones.some(o => o.valor === valor) ? valor : opciones[0]?.valor

  function tecla(e: KeyboardEvent<HTMLDivElement>): void {
    const adelante = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const atras = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!adelante && !atras) return
    e.preventDefault()
    const bs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
    const i = bs.findIndex(b => b === document.activeElement)
    bs[(i + (adelante ? 1 : bs.length - 1)) % bs.length]?.focus()
  }

  return (
    <div ref={ref} id={id} role="radiogroup" aria-label={nombre} className="sp-int-opciones" onKeyDown={tecla}>
      {opciones.map(o => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
          tabIndex={o.valor === parada ? 0 : -1} className="sp-int-op"
          onClick={() => onCambio(valor === o.valor ? '' : o.valor)}>
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}
