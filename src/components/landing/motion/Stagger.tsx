'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DIST, STAGGER } from './tokens'

/**
 * Variantes del HIJO de un `<Stagger>`. Se importan y se pasan tal cual a cada
 * `motion.*` que anima dentro del contenedor.
 *
 * Solo VALORES, sin `transition`: la duración la pone cada consumidor con el
 * prop `transition`, porque es donde vive su `useReducedMotion` (§4.3·7 prohíbe
 * ramificar el render, así que la preferencia se resuelve en la transición, no
 * en el árbol). El patrón completo, copiable, está en `SeccionSeguridad.tsx`.
 */
export const VARIANTES_ITEM = {
  oculto: { opacity: 0, y: DIST.reveal },
  visible: { opacity: 1, y: 0 },
} as const

/**
 * Variante para contenedores que PINTAN UN FONDO DETRÁS de sus ítems. Solo
 * `opacity`, sin `y`.
 *
 * ⚠️ NO es una preferencia estética, es una corrección. Cuando el ítem ES la
 * celda de la retícula y el contenedor tiene fondo propio, desplazarlo en `y`
 * deja al descubierto ese fondo durante toda la entrada: el hueco que el ítem
 * vacía por arriba se pinta del color del padre. El caso vivo es la franja de
 * `SeccionPortabilidad.tsx`, cuyo `gap-px` sobre `bg-[var(--lp-border)]` dibuja
 * los divisores — con `y: 24` aparecería una banda #e6ebf2 de 24px sobre cada
 * tarjeta mientras dura el reveal. Es el MISMO defecto que la auditoría de F2.a
 * atribuyó a los wrappers, entrando por otra puerta: no lo causaba el wrapper,
 * lo causa el desplazamiento vertical sobre un fondo visible.
 *
 * Regla para futuras tandas: si el contenedor del `Stagger` tiene `bg-*` que se
 * ve entre sus hijos, el hijo va con esta variante.
 */
export const VARIANTES_ITEM_FUNDIDO = {
  oculto: { opacity: 0 },
  visible: { opacity: 1 },
} as const

interface StaggerProps {
  children: ReactNode
  /** Clase del contenedor (típicamente el `grid` o `flex` que ya existía). */
  className?: string
  /** Retraso antes del primer hijo, en SEGUNDOS (`delayChildren`). */
  delay?: number
  /** Separación entre hermanos, en SEGUNDOS. 70ms por defecto (`STAGGER.siblings`). */
  gap?: number
}

/**
 * Contenedor que revela a sus hijos en cascada. **NO emite ningún elemento
 * propio más que él mismo**: es el `grid`/`flex` que ya existía, y sus hijos
 * animan porque son `motion.*` con `VARIANTES_ITEM`, no porque este componente
 * los envuelva.
 *
 * ═══ POR QUÉ SE REESCRIBIÓ (F2.a·a2, decisión B2 del PM) ═══
 * La versión anterior hacía `Children.map` y metía un `motion.div` alrededor de
 * cada hijo. Ese wrapper pasaba a ser el ítem de la retícula, y eso rompía tres
 * cosas distintas — las tres verificadas en la auditoría de F2.a:
 *   · el `sm:col-span-2` de la card DICOM caía en un hijo del ítem, no en el
 *     ítem, y la card perdía el doble ancho (§4.4 ya lo advertía);
 *   · la franja de Portabilidad dibuja sus divisores con `gap-px` sobre un
 *     fondo de borde: el wrapper se estiraba con la fila pero el `<div>` blanco
 *     de dentro no, así que asomaba una banda #e6ebf2 bajo las tarjetas cortas;
 *   · el `items-stretch` de Seguridad —que es lo que sustituyó a la escalera
 *     descartada en LP-DT-20— dejaba de igualar alturas por el mismo motivo.
 * Se pudo reescribir sin migración porque NO TENÍA UN SOLO CONSUMIDOR: existía
 * desde F0.a y ninguna sección llegó a importarlo.
 *
 * El patrón de referencia es `SeccionFAQ.tsx:424-446`, que ya lo hacía a mano
 * porque un `<div>` entre `<ul>` y `<li>` es HTML inválido. Ahora es la norma y
 * no la excepción.
 *
 * `prefers-reduced-motion` NO ramifica el render (§4.3·7): el árbol es idéntico
 * siempre. Aquí se anula la orquestación; el estado final de cada hijo lo fuerza
 * la regla `[data-lp-reveal]` de globals.css:922, que es la que de verdad manda.
 * Por eso `data-lp-reveal` va en los HIJOS, que son los que animan — este
 * contenedor no anima nada propio y no lo lleva.
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
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        oculto: {},
        visible: {
          transition: reducedMotion
            ? { staggerChildren: 0, delayChildren: 0 }
            : { staggerChildren: gap, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
