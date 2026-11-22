/**
 * «¿Salió el usuario de la sección abierta?» — la escucha compartida del
 * «plegado al salir» de los formularios compactos (receta, imagen,
 * internamiento, suplementos y consentimiento). Antes cada uno tenía su copia y
 * sólo el consentimiento llevaba el arreglo de abajo.
 *
 * ⚠️ LA CAUSA DEL DEFECTO (internamiento: pulsar el TEXTO de una casilla la
 * plegaba sin marcarla). En el `pointerdown` sobre algo NO enfocable —un
 * `<label>`, un párrafo, un título— el navegador lleva el foco al ancestro
 * enfocable más cercano, que es el panel del selector de tipo (`tabIndex=-1`),
 * FUERA de la sección. Ese `focusin` se leía como «salió con el teclado» y
 * plegaba en el acto; el clic llegaba después a un nodo ya desmontado. Por eso
 * mientras dura un gesto de puntero (hasta su `click`) el `focusin` no decide
 * nada: con el puntero decide sólo el `pointerdown` (¿empezó fuera?) y se
 * pliega al soltar. Con el dedo hacía falta esperar al `click`: el foco se
 * mueve en el `mousedown` emulado, que llega DESPUÉS del `pointerup`.
 *
 * Con el puntero se pliega al SOLTAR y con un `setTimeout`: plegar cambia el
 * alto de la página, y hacerlo antes movería el destino del clic. Un
 * desplazamiento con el dedo termina en `pointercancel` y no pliega. Con el
 * teclado (Tab que sale), en el `focusin`. Las capas (diálogos, alertas,
 * listas, menús y lo que abre una capa) no cuentan como fuera.
 */

/** Lo que no cuenta como «fuera» aunque esté fuera de la sección. */
export const SELECTOR_CAPAS = '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], [aria-haspopup]'

/** Lo mínimo de un `Element` que hace falta para decidir (así se prueba sin DOM). */
export interface Destino { closest(selector: string): unknown }

/** El destino está fuera de la sección y no es una capa. Sin destino, no. */
export function destinoFuera<T extends Destino>(t: T | null, dentro: (t: T) => boolean): boolean {
  return t !== null && !dentro(t) && !t.closest(SELECTOR_CAPAS)
}

/** Un `focusin` sólo pliega si no hay un puntero pulsado y su destino está fuera. */
export function focoPliega(presionando: boolean, fuera: boolean): boolean {
  return !presionando && fuera
}

/**
 * Engancha la escucha al documento; devuelve la función que la quita (para el
 * `return` de un `useEffect`). `dentro` dice si un elemento es de la sección (o
 * de sus acciones); `alSalir` pliega.
 */
export function escucharSalida(dentro: (el: Element) => boolean, alSalir: () => void): () => void {
  // `presionando` dura del `pointerdown` al `click` (o 700 ms tras soltar si no
  // llega ninguno: un arrastre). No basta con el `pointerup`: con el DEDO el
  // navegador emula el `mousedown` —y mueve el foco— DESPUÉS del `pointerup`.
  let presionando = false
  let abajoFuera = false
  let reloj: ReturnType<typeof setTimeout> | undefined
  const fuera = (t: EventTarget | null): boolean => destinoFuera(t instanceof Element ? t : null, dentro)
  const suelta = () => { clearTimeout(reloj); presionando = false }
  const alBajar = (e: PointerEvent) => { clearTimeout(reloj); presionando = true; abajoFuera = fuera(e.target) }
  const alSoltar = () => {
    clearTimeout(reloj)
    reloj = setTimeout(suelta, 700)
    if (!abajoFuera) return
    abajoFuera = false
    setTimeout(alSalir, 0)
  }
  const alCancelar = () => { suelta(); abajoFuera = false }
  const alEnfocar = (e: FocusEvent) => { if (focoPliega(presionando, fuera(e.target))) alSalir() }
  document.addEventListener('pointerdown', alBajar, true)
  document.addEventListener('pointerup', alSoltar, true)
  document.addEventListener('pointercancel', alCancelar, true)
  document.addEventListener('click', suelta, true)
  document.addEventListener('focusin', alEnfocar)
  return () => {
    clearTimeout(reloj)
    document.removeEventListener('pointerdown', alBajar, true)
    document.removeEventListener('pointerup', alSoltar, true)
    document.removeEventListener('pointercancel', alCancelar, true)
    document.removeEventListener('click', suelta, true)
    document.removeEventListener('focusin', alEnfocar)
  }
}
