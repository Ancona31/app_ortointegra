/**
 * Navegación dentro de un formulario largo, sin `scrollIntoView`.
 *
 * `scrollIntoView` decide él la posición final y en un contenedor con barra de
 * acciones fija deja el campo debajo de ella. Aquí el desplazamiento es
 * explícito: el campo queda a 24px del borde superior del scroller.
 *
 * El scroller de esta app NO es la ventana: `(app)/layout.tsx` monta
 * `<main class="overflow-y-auto">` dentro de un `h-screen overflow-hidden`.
 */

/** Ancestro que hace scroll de verdad. Cae a scrollingElement. */
export function scrollerDe(el: HTMLElement): HTMLElement {
  let n: HTMLElement | null = el.parentElement
  while (n) {
    const { overflowY } = getComputedStyle(n)
    // Desbordado de verdad: un contenedor `auto` que no scrollea aceptaría el
    // scrollTop y lo descartaría, y el desplazamiento fallaría en silencio.
    if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n
    n = n.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/**
 * Enfoca el campo y lo acerca a 24px del borde superior del scroller.
 *
 * La diferencia de rectángulos y NO `el.offsetTop`: offsetTop es relativo al
 * `offsetParent` —la card que contiene el campo—, no al scroller, así que
 * usarlo directamente desplaza de menos por toda la altura acumulada de los
 * bloques anteriores.
 *
 * `preventScroll` en el foco para que el navegador no haga su propio ajuste
 * antes del nuestro y el campo acabe en dos sitios distintos.
 */
export function enfocarYAcercar(el: HTMLElement | null, margen = 24): void {
  if (!el) return
  el.focus({ preventScroll: true })
  const scroller = scrollerDe(el)
  const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margen
  scroller.scrollTop = Math.max(0, scroller.scrollTop + delta)
}
