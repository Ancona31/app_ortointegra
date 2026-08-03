'use client'

import { useRef, type ReactNode } from 'react'
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
  const capa = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      ref={capa}
      data-lp-reveal=""
      /* ═══ ESTADO DE ESPERA — F6·f1b ═══════════════════════════════════════
         `data-lp-espera` significa "esta capa todavía no ha entrado en
         pantalla", y `globals.css` la pone en `visibility: hidden` mientras no
         lleve además `data-lp-visto`. Sin eso, sus controles son alcanzables
         con Tab estando a `opacity: 0` — 21 de los 31 focusables de la página
         lo estaban.

         ⚠️ ES UN ATRIBUTO NUEVO Y NO SE REUTILIZA `data-lp-reveal`, que sería
         lo cómodo. `data-lp-reveal` lo llevan también las 12 capas de carga
         del hero, las de la receta y las de `Parallax`, que NO son
         `whileInView`: nunca reciben un callback de viewport, así que con la
         regla colgada de ese atributo se quedarían ocultas PARA SIEMPRE.
         `data-lp-espera` lo ponen solo `Reveal` y `Stagger`, que son los que
         sí tienen cómo levantarlo. */
      data-lp-espera=""
      /* El nodo se marca a sí mismo en cuanto entra: mismo instante en que
         `motion` arranca la animación —los dos salen del mismo callback del
         IntersectionObserver—, así que la capa se hace visible justo cuando
         empieza a fundirse desde 0. No hay salto.
         Se escribe el atributo a mano en vez de subirlo a estado: son 94
         capas y ninguna necesita re-renderizar para esto. React no lo toca
         porque nunca se lo pasamos como prop. */
      onViewportEnter={() => capa.current?.setAttribute('data-lp-visto', '')}
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
