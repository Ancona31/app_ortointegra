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
 * `opacity` (regla permanente 2 de CLAUDE.md).
 *
 * `prefers-reduced-motion` NO ramifica el render: el árbol de DOM (incluidos
 * los wrappers por hijo) es idéntico en servidor y cliente. Ver el comentario
 * largo de `Reveal.tsx` para el porqué y para las dos capas que resuelven la
 * preferencia. `data-lp-reveal` va en los wrappers, que son los que animan.
 */
export default function Stagger({
  children,
  className,
  delay = 0,
  gap = STAGGER.siblings,
}: StaggerProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: {
          transition: reducedMotion
            ? { staggerChildren: 0, delayChildren: 0 }
            : { staggerChildren: gap, delayChildren: delay },
        },
      }}
    >
      {Children.map(children, (child, i) => (
        <motion.div
          key={i}
          data-lp-reveal=""
          variants={{
            hidden: { opacity: 0, y: DIST.reveal },
            visible: {
              opacity: 1,
              y: 0,
              transition: reducedMotion
                ? { duration: 0 }
                : { duration: DUR.base, ease: EASE.out },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
