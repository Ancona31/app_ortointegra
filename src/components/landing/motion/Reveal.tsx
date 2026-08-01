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
 *
 * ⚠️ DURA `--lp-dur-section` (420ms), NO `--sp-dur-base` (240ms). Decisión de
 * PM en F2.a·a1 (B1), y CORRIGE una contradicción que estaba viva en dos
 * sitios: §4.2 del maestro decía «--sp-dur-base 240ms (reveals)» y este
 * archivo lo implementaba así, pero las fichas §5.2 y §5.10b daban
 * `--lp-dur-section` para la entrada de bloque — y `SeccionControl.tsx:147`
 * ya animaba a 420. O sea que había DOS duraciones en producción para el
 * mismo gesto. La que manda es 420: 240ms queda para micro-interacciones y
 * cross-fades, y los hovers de la landing bajan a `--sp-dur-micro` (120ms).
 * §4.2 del maestro ya está corregido; si lo lees a 240, es una copia vieja.
 *
 * `prefers-reduced-motion` NO ramifica el render: el árbol de DOM es idéntico
 * en servidor y cliente (`useReducedMotion` es un valor solo-cliente y
 * ramificar con él provocaba hydration mismatch, dejando el `opacity: 0` del
 * SSR pegado y la sección invisible). La preferencia se resuelve en dos capas:
 *   1. aquí, poniendo la duración en 0 para que la animación no corra;
 *   2. en `globals.css`, con la regla `[data-lp-reveal]` dentro del bloque
 *      `@media (prefers-reduced-motion: reduce)`, que fuerza el estado final
 *      visible por encima de los estilos inline de `motion`.
 * El atributo `data-lp-reveal` debe estar SIEMPRE presente: es el gancho de
 * esa regla CSS.
 */
export default function Reveal({ children, className, delay = 0 }: RevealProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      data-lp-reveal=""
      className={className}
      initial={{ opacity: 0, y: DIST.reveal }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={
        reducedMotion
          ? { duration: 0, delay: 0 }
          : { duration: DUR.section, ease: EASE.out, delay }
      }
    >
      {children}
    </motion.div>
  )
}
