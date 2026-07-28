'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DIST, DUR, EASE } from './tokens'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Retraso antes de arrancar, en SEGUNDOS. Usa `STAGGER.*` de tokens.ts. */
  delay?: number
}

/**
 * Entrada de un bloque al entrar en viewport: sube 24px con fade, una sola vez.
 *
 * Solo anima `transform` y `opacity` (regla permanente 2 de CLAUDE.md).
 * Con `prefers-reduced-motion` NO hay animación acelerada: el contenido se
 * renderiza directamente, sin `motion` de por medio.
 */
export default function Reveal({ children, className, delay = 0 }: RevealProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: DIST.reveal }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: DUR.base, ease: EASE.out, delay }}
    >
      {children}
    </motion.div>
  )
}
