'use client'

import { useEffect } from 'react'

/**
 * Escotilla de teclado del sistema de reveals (F6·f1b). No pinta nada.
 *
 * ═══ EL PROBLEMA QUE RESUELVE, Y POR QUÉ EL ARREGLO OBVIO ERA PEOR ═════════
 * `Reveal` y `Stagger` revelan al entrar en pantalla (`whileInView`,
 * `once: true`). Antes de revelarse, sus controles seguían en el orden de
 * tabulación estando a `opacity: 0`: 21 de los 31 focusables de la página.
 *
 * El arreglo evidente —sacarlos del orden de tabulación mientras están
 * ocultos— es, POR SÍ SOLO, una regresión peor que el defecto: el navegador
 * salta el control por estar oculto, y por tanto nunca lo desplaza a la vista,
 * y por tanto el `IntersectionObserver` nunca dispara. Con 75 capas servidas
 * ocultas, el Tab se sale del documento después del hero y **el resto de la
 * página deja de ser alcanzable por teclado** (fallo 2.1.1). Se comprobó antes
 * de aplicarlo; no es una hipótesis.
 *
 * Por eso el ocultado va SIEMPRE acompañado de esta escotilla: a la primera
 * señal de navegación sin ratón, todas las capas de tejido se revelan de golpe
 * y ya no vuelven a ocultarse. A partir de ahí el orden de tabulación no
 * miente.
 *
 * ⚠️ LA REVELACIÓN ES IRREVERSIBLE EN LA SESIÓN, a propósito. El atributo solo
 * se pone, nunca se quita, y los listeners se desmontan al primer disparo. Si
 * volviera a ocultarse al pasar al ratón, un usuario que alterna teclado y
 * ratón —que son la mayoría— se encontraría la página cambiando de estado bajo
 * los pies, y volvería a haber ventanas donde el Tab no llega.
 *
 * ⚠️ NO TOCA `useReducedMotion` NI RAMIFICA EL RENDER. Todo lo que hace es
 * poner un atributo en `<html>`; quien decide qué significa es `globals.css`.
 * Bajo `prefers-reduced-motion` el estado de espera ni siquiera se aplica —lo
 * anula la misma hoja— así que esta escotilla es inocua ahí.
 */
export default function RevelarPorTeclado(): null {
  useEffect(() => {
    const raiz = document.documentElement
    if (raiz.hasAttribute('data-lp-teclado')) return

    function soltar(): void {
      document.removeEventListener('keydown', alPulsar, true)
      document.removeEventListener('focusin', alEnfocar, true)
    }

    function revelar(): void {
      raiz.setAttribute('data-lp-teclado', '')
      soltar()
    }

    /* Tab en captura: corre ANTES de que el navegador mueva el foco, así que
       cuando el foco aterriza la capa de destino ya está visible. Y en captura
       para que nada que llame a `stopPropagation` por el camino nos lo quite. */
    function alPulsar(e: KeyboardEvent): void {
      if (e.key === 'Tab') revelar()
    }

    /* ⚠️ EL `focusin` NO ES REDUNDANTE CON EL Tab, y es la mitad del arreglo.
       Hay navegación sin ratón que no emite `keydown Tab`: lectores de pantalla
       moviendo el foco por su cursor virtual, conmutadores, control por voz
       ("clic en Empezar gratis"), y el propio Tab de algunos ATs. Todas ellas
       mueven el foco, así que `focusin` las cubre.
       El filtro es `:focus-visible`: es exactamente el discriminante que el
       navegador ya usa para decidir si un foco merece anillo, o sea "esto no
       vino de un clic". Sin él, cualquiera que pulse un botón con el ratón
       revelaría la página entera y se quedaría sin coreografía. */
    function alEnfocar(e: FocusEvent): void {
      const objetivo = e.target
      if (objetivo instanceof Element && objetivo.matches(':focus-visible')) revelar()
    }

    document.addEventListener('keydown', alPulsar, true)
    document.addEventListener('focusin', alEnfocar, true)
    return soltar
  }, [])

  /* UN SOLO listener de documento para las 94 capas, y por eso esto es un
     componente montado una vez en `page.tsx` y no un `useEffect` dentro de
     `Reveal`: ahí serían 94 registros del mismo handler. */
  return null
}
