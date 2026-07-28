'use client'

import { Children, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DIST, DUR, EASE, STAGGER } from './tokens'

interface StaggerProps {
  children: ReactNode
  /** Clase del contenedor (típicamente el `grid` o `flex` que ya existía). */
  className?: string
  /** Retraso antes del primer hijo, en SEGUNDOS. */
  delay?: number
  /** Separación entre hermanos, en SEGUNDOS. 70ms por defecto (`STAGGER.siblings`). */
  gap?: number
}

/**
 * Revela a sus hijos en cascada con 70ms de separación entre hermanos.
 *
 * Cada hijo se envuelve en un `motion.div`, así que el wrapper —no el hijo—
 * pasa a ser el item del grid/flex del contenedor. Solo anima `transform` y
 * `opacity` (regla permanente 2 de CLAUDE.md). Con `prefers-reduced-motion`
 * el contenedor se renderiza tal cual, sin wrappers ni animación.
 */
export default function Stagger({
  children,
  className,
  delay = 0,
  gap = STAGGER.siblings,
}: StaggerProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {Children.map(children, (child, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: DIST.reveal },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: DUR.base, ease: EASE.out },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
