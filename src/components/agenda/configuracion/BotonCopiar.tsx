'use client'

/**
 * «Copiar enlace» → «Copiado» (maquetas de J5). Si el navegador no deja
 * escribir en el portapapeles (http sin TLS, permiso negado), lo dice en vez
 * de fingir que copió. `texto` puede ser una promesa: el código de un enlace de
 * una vez se pide al servidor al pulsar.
 */
import { useState, type ReactNode } from 'react'

interface Props {
  texto: string | (() => Promise<string | null>)
  className: string
  etiqueta?: string
  /** Para lectores de pantalla cuando hay varios «Copiar» seguidos. */
  ariaLabel?: string
  icono?: ReactNode
}

export default function BotonCopiar({ texto, className, etiqueta = 'Copiar', ariaLabel, icono }: Props) {
  const [estado, setEstado] = useState<'nada' | 'copiado' | 'error'>('nada')
  async function copiar(): Promise<void> {
    try {
      const t = typeof texto === 'string' ? texto : await texto()
      if (!t) { setEstado('error'); return }
      await navigator.clipboard.writeText(t)
      setEstado('copiado')
    } catch {
      setEstado('error')
    }
  }
  return (
    <button type="button" className={className} aria-label={ariaLabel && estado === 'copiado' ? `${ariaLabel}: copiado` : ariaLabel} onClick={() => void copiar()}>
      {icono}
      {estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : etiqueta}
    </button>
  )
}
