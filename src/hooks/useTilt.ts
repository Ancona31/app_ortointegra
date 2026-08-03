'use client'

import { useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
  type Transition,
} from 'motion/react'
import { DIST, SPRING, TILT } from '@/components/landing/motion/tokens'

/**
 * Inclinación de card hacia el cursor — §4.4 del maestro, tanda F2.a·a3.
 *
 * ═══ POR QUÉ ES UN HOOK Y NO UN COMPONENTE ═══
 * Decisión de PM (B3), y la alternativa estaba descartada por el propio
 * sistema: un `<Tilt>` envolvente reintroduce el wrapper que §4.4 prohíbe, y
 * lo haría justo sobre la card con `sm:col-span-2` — el wrapper pasaría a ser
 * el ítem de la retícula y la card DICOM perdería el doble ancho. Es el mismo
 * defecto que obligó a reescribir `Stagger` en a2. La otra salida —repetir
 * ocho props inline en las cinco cards— deja la mecánica esparcida y sin un
 * sitio donde documentarla.
 *
 * ═══ QUÉ ABSORBE ═══
 * Hasta a2 las cards del bento llevaban `hover:-translate-y-1` y
 * `active:scale-[0.98]` en CSS. Las dos quedaron MUERTAS en cuanto la card
 * pasó a animar `y` con el Stagger: `motion` escribe `transform` inline y el
 * inline gana a la utilidad de Tailwind (verificado en el paquete embarcado,
 * `motion-dom/.../build-transform.mjs:65-67`, que además emite `transform:
 * none` cuando los valores vuelven a su default). Este hook las reproduce como
 * gestos de motion, que es la única forma de que convivan con la inclinación.
 *
 * ═══ RENDIMIENTO ═══
 * El puntero NO pasa por estado de React (§4.3·2): son `MotionValue` que se
 * escriben al DOM directamente. El `getBoundingClientRect` se cachea al entrar
 * y no se vuelve a leer durante el movimiento, para no forzar reflow en cada
 * `pointermove`.
 *
 * ⚠️ EXCEPCIÓN DECLARADA A §4.3·1 — LA SOMBRA NO ES `transform` NI `opacity`.
 * §4.3·1 solo admite esas dos propiedades, pero §4.4 pide explícitamente que la
 * sombra siga al ángulo, y una sombra no se puede mover con `transform` sin
 * sacarla a una capa propia dentro de cada card. Se acepta el repintado porque
 * está acotado: ocurre en UNA card cada vez, solo con ratón, solo mientras el
 * cursor está encima, y `box-shadow` repinta pero no reflota el layout. Si en
 * F6 la medición dice que cuesta cuadros, la salida es una capa absoluta por
 * card con `opacity` — no quitar la sombra.
 */
export interface TiltProps {
  style: MotionStyle
  whileHover: { y: number; transition: Transition }
  whileTap: { scale: number; transition: Transition }
  onPointerMove: (evento: ReactPointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
}

export function useTilt(): TiltProps {
  /* NO ramifica el render (§4.3·7): el hook devuelve SIEMPRE la misma forma y
     los mismos props. Lo único que cambia es que el handler no escribe nada.
     Ver el bloque de reduced-motion al final de este comentario. */
  const sinMovimiento = useReducedMotion()

  const anguloX = useMotionValue(0)
  const anguloY = useMotionValue(0)
  const intensidad = useMotionValue(0)
  const marco = useRef<DOMRect | null>(null)

  /* `SPRING.snap` (300/30) — declarado en tokens.ts desde §5.10b y sin
     consumidores hasta ahora. Es lo que da la respuesta <100ms que pide §4.4:
     con `SPRING.soft` (120/20) la card persigue al cursor con retraso visible
     y se siente gelatinosa. */
  const muelle = { stiffness: SPRING.snap.stiffness, damping: SPRING.snap.damping }
  const suaveX = useSpring(anguloX, muelle)
  const suaveY = useSpring(anguloY, muelle)
  const suaveIntensidad = useSpring(intensidad, muelle)

  /* La sombra se deriva del MISMO par de ángulos, así que no puede
     desincronizarse de la inclinación. Se emiten DOS sombras: la de reposo
     (idéntica al `shadow-sm` que la card tenía en clase) y la de acento, cuyo
     alfa escala con la intensidad — en reposo es 0 y la card se ve exactamente
     como antes de a3. El desplazamiento va en sentido contrario al ángulo:
     si el borde cercano se levanta hacia el cursor, la sombra huye de él. */
  const sombra = useTransform(
    [suaveX, suaveY, suaveIntensidad],
    (valores: number[]) => {
      const [gradosX, gradosY, i] = valores
      const dx = (gradosY / TILT.angulo) * TILT.sombraRecorrido
      const dy = (-gradosX / TILT.angulo) * TILT.sombraRecorrido + DIST.elevacionHover
      const alfa = TILT.sombraAlfa * i
      return `${TILT.sombraReposo}, ${dx}px ${dy}px ${TILT.sombraBlur}px rgb(var(--lp-accent-rgb) / ${alfa})`
    },
  )

  const alMover = (evento: ReactPointerEvent<HTMLElement>): void => {
    /* ⚠️ EL DESCARTE TÁCTIL VA AQUÍ, EN EL HANDLER, Y NO EN UN HOOK DE MEDIA
       QUERY. Un `useMediaQuery('(hover: hover)')` es un valor solo-cliente:
       usarlo para decidir qué se renderiza reintroduce exactamente el hydration
       mismatch de §4.3·7 que ya costó una sección invisible (commit 60ff25c).
       Esto es una comprobación en tiempo de ejecución sobre un evento — el
       árbol de DOM es idéntico en servidor y cliente, y en un dispositivo sin
       ratón simplemente no entra nunca.
       Sin el guard, `pointerenter` dispara al tocar en varios navegadores y la
       card se queda torcida sin gesto que la enderece: en táctil no hay
       `pointerleave` fiable.
       `!== 'mouse'` es más estricto que el filtro propio de motion, que solo
       descarta `touch` y deja pasar `pen`. */
    if (sinMovimiento || evento.pointerType !== 'mouse') return

    if (!marco.current) marco.current = evento.currentTarget.getBoundingClientRect()
    const caja = marco.current

    /* Normalizado a −0.5…0.5 desde el centro de la card. */
    const px = (evento.clientX - caja.left) / caja.width - 0.5
    const py = (evento.clientY - caja.top) / caja.height - 0.5

    /* Signos: en CSS 3D el eje Y apunta hacia ABAJO, así que `rotateX`
       positivo acerca el borde INFERIOR y `rotateY` positivo aleja el borde
       DERECHO. Para que la card se incline HACIA el cursor (§4.4) hacen falta
       estos dos signos y no los intuitivos. Si alguien los "corrige", la card
       huye del cursor en vez de seguirlo. */
    anguloX.set(py * 2 * TILT.angulo)
    anguloY.set(-px * 2 * TILT.angulo)
    intensidad.set(1)
  }

  const alSalir = (): void => {
    marco.current = null
    anguloX.set(0)
    anguloY.set(0)
    intensidad.set(0)
  }

  return {
    style: {
      rotateX: suaveX,
      rotateY: suaveY,
      boxShadow: sombra as unknown as CSSProperties['boxShadow'],
      transformPerspective: TILT.perspectiva,
    },
    /* El levantamiento y el pulsado llevan su transición DENTRO del gesto, no
       en el prop `transition` de la card: ese lo ocupa la entrada del Stagger
       (420ms), y un hover a 420ms no es un hover. */
    whileHover: { y: -DIST.elevacionHover, transition: SPRING.snap },
    whileTap: { scale: TILT.pulsado, transition: SPRING.snap },
    onPointerMove: alMover,
    onPointerLeave: alSalir,
  }
}

/* ═══ REDUCED MOTION — SE RESUELVE SOLO, Y NO ES UN BUG ═══
   Las cards del bento llevan `data-lp-reveal` por ser hijas del `Stagger`, y
   `globals.css:924` les fuerza `transform: none !important` bajo
   `prefers-reduced-motion`. Eso aplana la inclinación, el levantamiento y el
   pulsado de una vez, sin que este hook tenga que hacer nada: el `!important`
   de la hoja gana a los estilos inline de motion.
   El guard de `alMover` añade la segunda capa —no escribir siquiera los
   valores— para que la SOMBRA tampoco se mueva: la sombra no es `transform` y
   la regla CSS no la cubre, así que sin el guard el card se quedaría quieto
   pero su sombra seguiría al cursor, que se lee peor que cualquiera de las dos
   cosas por separado.
   Si alguien reporta "el tilt no funciona", lo primero que hay que mirar es si
   tiene la preferencia activa en el sistema. */

/* ═══ DESBORDAMIENTO — VERIFICADO POR CÁLCULO (§5.10b manda dejarlo escrito) ═══
   La lección de `SeccionControl.tsx:125-136` es que "solo transform y opacity"
   protege del jank pero NO del desbordamiento: un transform no provoca
   relayout, pero sí cuenta para el área desbordable. `rotateY` con perspectiva
   ensancha la arista cercana, así que hay que comprobar que no gane scroll
   horizontal.

   Proyección de la arista a 3° con P = 1000px, para una card de ancho W:
     z  = (W/2)·sen 3°                    → acercamiento de la arista
     x' = (W/2)·cos 3°·P/(P − z)          → media anchura proyectada
     ensanchamiento = x' − W/2

   Peor caso = la card más ancha (DICOM, `sm:col-span-2`) en el viewport donde
   menos holgura queda, que es 1152px exactos: ahí `max-w-6xl` ya topó y el
   único aire es el `px-8` de 32px por lado.
     ancho útil = 1152 − 64 = 1088 · columna = (1088 − 32)/3 = 352
     DICOM = 2 columnas + gap = 720 → W/2 = 360
     z  = 360 × 0.05234 = 18.84
     x' = 360 × 0.99863 × 1000/981.16 = 366.4
     ensanchamiento = 6.4px  contra 32px de holgura → 5× de margen
   Comprobado también en los dos extremos de la retícula de 3 columnas:
     a 640px (donde entra `sm:grid-cols-3`): DICOM = 378.7 → +1.6px / 32 de holgura
     a 1440px: la holgura sube a 176px (margen del contenedor + px-8)
   Y por debajo de `sm` la retícula es de una columna, así que la card más
   ancha es la del viewport menos `px-4`: a 500px son 468 → +2.6px contra 16 de
   holgura. (Ese caso solo se da con un ratón en una ventana estrecha; con dedo
   el handler no entra.)
   NINGÚN caso desborda. Si una tanda futura sube el ángulo o baja la
   perspectiva, RECALCULA: el ensanchamiento crece con las dos cosas. */
