'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { DIST, OFFSETS } from './tokens'

interface ParallaxProps {
  children: ReactNode
  /** Clase del elemento. `Parallax` ES el bloque, no lo envuelve. */
  className?: string
}

/**
 * Capa de profundidad ligada al scroll: el elemento recorre +24 → −24px
 * mientras cruza el viewport. §4.4 del maestro, tanda F2.a·a4.
 *
 * Primer consumidor de `OFFSETS.travesia`, que estaba declarado en `tokens.ts`
 * desde §5.10b sin usarse. El progreso NO pasa por estado de React (§4.3·2):
 * es un `MotionValue` derivado con `useTransform` y escrito al DOM.
 *
 * ═══ QUÉ SE MUEVE: EL BLOQUE, NUNCA EL `<h2>` SUELTO ═══
 * §4.4 decía "títulos" y la auditoría previa a a4 lo midió: es inaplicable.
 * Un `<h2>` se mueve y su bajada no, así que el recorrido se come el hueco
 * entre los dos. Medido en las seis secciones, hueco bajo el titular:
 *   Features `mt-3` = 12px · Portabilidad `mt-4` = 16px ·
 *   Expediente / Interfaz / Historia `mt-6` = 24px · Seguridad 48px
 * A ±40 solapaban cinco de seis (hasta 28px de texto sobre texto), y bajar la
 * distancia no salva nada: respetar los 12px de Features exigiría ±8, que no
 * se percibe. **El titular desnudo no es un objetivo viable a ninguna
 * distancia útil.** Por eso el consumidor pasa el bloque entero:
 *   · encabezado completo (titular + bajada) en Features, Portabilidad y
 *     Seguridad — despeja la retícula por 24px (`mb-12` = 48 menos 24);
 *   · columna de texto entera en Expediente e Interfaz, que se mueve contra
 *     la columna del mockup y no tiene hueco interno que violar;
 *   · la foto en Historia, que es el caso limpio de manual.
 * §4.4 ya está corregido. Si vuelves a leer "títulos", es una copia vieja.
 *
 * ═══ ⚠️ NO "OPTIMICES" ESTO CON UN `useScroll` DE PÁGINA ═══
 * La idea de compartir un solo `useScroll` y derivar las 7 posiciones de él se
 * evaluó y se DESCARTÓ con el código del paquete delante. `motion` ya lo hace:
 * `framer-motion/.../render/dom/scroll/track.mjs:6-8,34-55` guarda los
 * handlers en un `WeakMap` indexado por CONTENEDOR de scroll y registra el
 * listener UNA sola vez por contenedor (`if (!scrollListeners.has(container))`).
 * Las 7 instancias comparten `document.scrollingElement`, así que son **1
 * listener de scroll + 1 de resize**, no 7 de cada. El trabajo por cuadro
 * también está batcheado y en el orden correcto: `frame.read(measureAll)` mide
 * los 7 en la fase de lectura y `frame.preUpdate(notifyAll)` notifica en la de
 * escritura — que es justo lo que evita el layout thrashing.
 * Hacerlo a mano obligaría a leer `offsetTop` por elemento FUERA de esa fase,
 * o sea a provocar el forced reflow que hoy no ocurre. La medición de coste
 * real (7 recorridos de `offsetParent` por evento, `on-scroll-handler.mjs:5-24`,
 * sin un solo `getBoundingClientRect`) es trabajo de F6.
 *
 * ═══ REDUCED MOTION ═══
 * `data-lp-reveal` + `globals.css:924` fuerzan `transform: none !important` y
 * dejan el bloque clavado en su sitio. NO se ramifica con `useReducedMotion`,
 * ni siquiera en el rango de `useTransform`: en el servidor el hook devuelve
 * false y en un cliente con la preferencia activa devolvería true, así que el
 * `transform` del HTML servido y el del primer render no coincidirían — es
 * exactamente el hydration mismatch de §4.3·7 que ya dejó una sección
 * invisible (60ff25c). La suscripción sigue viva bajo la preferencia y sus
 * escrituras se descartan; es trabajo desperdiciado, no un fallo visible.
 */
export default function Parallax({ children, className }: ParallaxProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  /* `travesia` = ["start end", "end start"]: progreso 0 cuando el borde
     superior del bloque toca el borde inferior del viewport, y 1 cuando su
     borde inferior toca el superior. Los dos extremos caen FUERA de pantalla,
     así que el recorrido visible nunca llega a ±24 completos — el bloque pasa
     por 0 justo cuando está centrado, que es donde se lee. */
  const { scrollYProgress } = useScroll({ target: ref, offset: [...OFFSETS.travesia] })
  const y = useTransform(scrollYProgress, [0, 1], [DIST.parallax, -DIST.parallax])

  return (
    <motion.div ref={ref} data-lp-reveal="" className={className} style={{ y }}>
      {children}
    </motion.div>
  )
}
