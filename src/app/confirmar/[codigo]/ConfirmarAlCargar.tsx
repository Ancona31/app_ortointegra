'use client'

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

/* ═══ K2 (punto 8 de Angel) — confirmar al abrir «Confirmo mi asistencia» del correo ═══
   El GET de la página SIGUE SIN ESCRIBIR (ver page.tsx). Lo hace ESTE
   componente, en el navegador, con el MISMO POST del botón
   (`/api/confirmar/[codigo]`, accion=confirmar: mismo token, mismas puertas de
   origen y límites, idempotente: repetido da «ya_confirmada»). Sólo se monta
   con `?paso=confirmar` (el botón del correo) y si la cita aún se puede
   confirmar.

   TANDA L (punto 1 de Angel, AG-DT-175): EL POST ESPERA UN GESTO DE LA
   PERSONA. Un revisor de enlaces que abre la página en un navegador real, con
   JavaScript, visible y con `navigator.webdriver` oculto, ya NO confirma: le
   falta el gesto. Qué cuenta como gesto (`esGestoParaConfirmar`):
     · sólo eventos de confianza (`isTrusted`): un `dispatchEvent` de la página
       o de una extensión no vale;
     · un CLIC (ratón, o un toque sin desplazar) o una TECLA, en cualquier
       sitio de la página que NO sea un control (enlace, botón, campo…). Un
       gesto sobre un control es de ESE control: el clic en «No podré asistir»
       lleva a su «¿Seguro?» sin confirmar, y el de «Confirmo mi asistencia»
       envía su formulario de siempre (no sale un segundo POST);
     · un clic y no `pointerdown`/`touchstart`: en el teléfono, el dedo que
       empieza a desplazar la página (por ejemplo, para llegar a «No podré
       asistir») no hace clic, y no debe confirmar;
     · de las teclas sólo cuentan Enter y las que escriben (una letra, un
       número), sin Ctrl/Alt/Cmd, fuera de un control (lista blanca): Tab,
       flechas, Espacio, Re Pág/Av Pág, F1-F12, Supr… no confirman, así que
       quien va con el teclado hasta «No podré asistir» no confirma por el
       camino;
     · soltar el ratón tras seleccionar texto tampoco (también es un `click`).
   Una vez por carga. Sin JavaScript queda el botón, que se pinta en el
   servidor; la ruta del POST, sus comprobaciones y sus límites no cambian.

   Además no confirma (K2): un GET o HEAD (revisores de correo, vista previa),
   un navegador automatizado (`navigator.webdriver`), una página en prerender
   ni una pestaña en segundo plano (espera a que se vea, y DESPUÉS al gesto).
   Si falla, vuelve el botón de siempre. «No podré asistir» no pasa por aquí.
   Riesgo que queda: un revisor que además SIMULE un clic de confianza fuera de
   los controles (AG-DT-175). */

type Estado = 'boton' | 'enviando'

/** El POST del botón; true si la ruta llevó a la página con su `?r=` (y se navega allí). */
async function confirmar(codigo: string): Promise<boolean> {
  const cuerpo = new FormData()
  cuerpo.set('accion', 'confirmar')
  try {
    const r = await fetch(`/api/confirmar/${encodeURIComponent(codigo)}`, { method: 'POST', body: cuerpo, cache: 'no-store', credentials: 'same-origin' })
    const destino = new URL(r.url)
    const esLaPagina = destino.origin === window.location.origin && destino.pathname === `/confirmar/${codigo}` && destino.searchParams.has('r')
    if (!r.redirected || !esLaPagina) return false
    window.location.replace(destino.pathname + destino.search)
    return true
  } catch {
    return false
  }
}

/** Llama a `listo` cuando la página ya no está en prerender y se ve; devuelve cómo dejar de esperar. */
function cuandoSeVea(listo: () => void): () => void {
  const comprobar = () => {
    if (Reflect.get(document, 'prerendering') === true || document.visibilityState !== 'visible') return
    quitar()
    listo()
  }
  const quitar = () => {
    document.removeEventListener('visibilitychange', comprobar)
    document.removeEventListener('prerenderingchange', comprobar)
  }
  document.addEventListener('visibilitychange', comprobar)
  document.addEventListener('prerenderingchange', comprobar)
  comprobar()
  return quitar
}

/** Lo que ya hace algo al pulsarlo: un gesto ahí es para ESE control (p. ej. «No podré asistir»), nunca para confirmar. */
const CONTROL = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]'
/** Las teclas que cuentan: Enter o una que escribe (una letra, un número). Espacio, no: desplaza la página. */
function esTeclaDeGesto(key: string): boolean {
  return key === 'Enter' || (key.length === 1 && key !== ' ')
}

/** Lo que se mira de un `click` o un `keydown` (así se prueba sin navegador). */
export interface Gesto {
  isTrusted: boolean
  target: EventTarget | null
  key?: string
  repeat?: boolean
  isComposing?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

function esControl(t: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && t instanceof Element && t.closest(CONTROL) !== null
}

/** Tanda L (punto 1): ¿este clic o esta tecla es de una persona sobre la página, y no sobre un control? */
export function esGestoParaConfirmar(e: Gesto): boolean {
  if (!e.isTrusted || esControl(e.target)) return false
  if (typeof e.key !== 'string') return true // un clic
  return !e.repeat && !e.isComposing && !e.altKey && !e.ctrlKey && !e.metaKey && esTeclaDeGesto(e.key)
}

/** Llama a `listo` con el primer gesto que cuente; devuelve cómo dejar de esperar. */
function cuandoHayaGesto(listo: () => void): () => void {
  const alGesto = (e: MouseEvent | KeyboardEvent) => {
    // Soltar tras seleccionar texto también es un `click`: quien selecciona para copiar no está confirmando.
    if (!esGestoParaConfirmar(e) || (e.type === 'click' && Boolean(window.getSelection()?.toString()))) return
    quitar()
    listo()
  }
  const quitar = () => {
    document.removeEventListener('click', alGesto, true)
    document.removeEventListener('keydown', alGesto, true)
  }
  document.addEventListener('click', alGesto, true)
  document.addEventListener('keydown', alGesto, true)
  return quitar
}

export default function ConfirmarAlCargar({ codigo, children }: { codigo: string; children: ReactNode }): ReactElement {
  const [estado, setEstado] = useState<Estado>('boton')
  const enviado = useRef(false)
  useEffect(() => {
    if (navigator.webdriver) return
    let sinGesto = () => {}
    const sinVista = cuandoSeVea(() => {
      sinGesto = cuandoHayaGesto(() => {
        if (enviado.current) return
        enviado.current = true
        setEstado('enviando')
        void confirmar(codigo).then(ok => { if (!ok) setEstado('boton') })
      })
    })
    return () => { sinVista(); sinGesto() }
  }, [codigo])
  if (estado === 'enviando') return <p role="status" className="rp-nota">Confirmando tu asistencia…</p>
  return <>{children}</>
}
