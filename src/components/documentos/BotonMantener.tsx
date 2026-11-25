'use client'

/**
 * Botón que sólo actúa si se MANTIENE pulsado ~1,2 s (maqueta
 * `consentimiento.html`, aprobada). Es el «gesto del médico» del modo de
 * firmado: con el dispositivo en manos del paciente, un toque suelto no saca
 * del modo ni devuelve el control al médico.
 *
 * Teclado: mantener Enter o Espacio hace lo mismo (sin repetición). Soltar
 * antes de tiempo cancela. El relleno que avanza sólo anima `transform`; con
 * movimiento reducido no se anima, pero el tiempo es el mismo.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'

const MANTENER_MS = 1200

interface Props {
  texto: string
  onCumplido: () => void
  disabled?: boolean
  /** Grande y centrado («Soy el médico»), o pequeño en la esquina («Médico: salir»). */
  grande?: boolean
}

export default function BotonMantener({ texto, onCumplido, disabled = false, grande = false }: Props): ReactElement {
  const [pulsado, setPulsado] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alCumplir = useRef(onCumplido)
  useEffect(() => { alCumplir.current = onCumplido })
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])

  function empezar(): void {
    if (disabled || reloj.current) return
    setPulsado(true)
    reloj.current = setTimeout(() => { reloj.current = null; setPulsado(false); alCumplir.current() }, MANTENER_MS)
  }
  function soltar(): void {
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = null
    setPulsado(false)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${texto}. Mantén pulsado para continuar`}
      data-pulsado={pulsado || undefined}
      className={`sp-mantener${grande ? ' sp-mantener--grande' : ''}`}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); empezar() }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); empezar() } }}
      onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') soltar() }}
      onBlur={soltar}
    >
      <span className="sp-mantener-relleno" aria-hidden="true" />
      <span className="sp-mantener-t">{texto} · mantén pulsado</span>
    </button>
  )
}
