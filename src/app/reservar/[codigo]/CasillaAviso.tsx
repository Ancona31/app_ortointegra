'use client'

import { useId, useRef, type MouseEvent, type ReactElement } from 'react'

/* ═══ La casilla del aviso de privacidad de la reserva y la capa que lo abre ═══
   (privacidad 2026-12; decisión de Angel: el aviso NO va desplegado en «Tus
   datos», ocupa demasiado; va la casilla y un enlace que lo abre).

   ⚠️ NI UNA LETRA: `casilla` y `aviso` son los textos aprobados, los de la
   huella (`avisoReserva.ts`). Aquí sólo cambia la PRESENTACIÓN: dentro de la
   casilla, las palabras «aviso de privacidad» son el botón que abre la capa,
   y en el aviso la dirección del integral con la que termina es un enlace. El
   texto que lee la persona es, carácter a carácter, el mismo.

   LA CAPA es un `<dialog>` nativo con `showModal()`: el navegador pone el
   foco dentro, lo encierra, cierra con Escape y lo devuelve al botón. Sin
   dependencias y sin sacar a la persona del formulario: lo escrito no se
   pierde. El aviso integral abre en otra pestaña por lo mismo.

   La casilla nace desmarcada y abrir o cerrar la capa no la marca. */

const FRASE = 'aviso de privacidad'

interface Props {
  casilla: string
  aviso: string
  /** La dirección del aviso integral como va escrita al final del aviso, y la ruta a la que enlaza. */
  avisoUrl: string
  avisoRuta: string
  acepta: boolean
  onAcepta: (acepta: boolean) => void
}

/** El aviso simplificado, íntegro; sólo la dirección final se pinta como enlace. */
function TextoDelAviso({ aviso, url, ruta }: { aviso: string; url: string; ruta: string }): ReactElement {
  const conEnlace = url.length > 0 && aviso.endsWith(url)
  return (
    <div className="rp-aviso-legal" data-aviso-reserva>
      {conEnlace ? aviso.slice(0, -url.length) : aviso}
      {conEnlace && <a href={ruta} target="_blank" rel="noopener noreferrer">{url}</a>}
    </div>
  )
}

export default function CasillaAviso({ casilla, aviso, avisoUrl, avisoRuta, acepta, onAcepta }: Props): ReactElement {
  const capa = useRef<HTMLDialogElement>(null)
  const encabezado = useRef<HTMLHeadingElement>(null)
  const titulo = useId()
  const corte = casilla.indexOf(FRASE)
  // `preventDefault`: el botón vive dentro del <label> y no debe marcar la casilla.
  const abrir = (e: MouseEvent) => {
    e.preventDefault()
    capa.current?.showModal()
    /* `showModal` enfoca lo primero enfocable, que es el enlace del FINAL del
       aviso, y la capa abriría ya desplazada hasta abajo. El foco va al título
       y la capa empieza arriba: el aviso se lee desde su primera línea. */
    encabezado.current?.focus()
    if (capa.current) capa.current.scrollTop = 0
  }
  const boton = (texto: string) => <button type="button" className="rp-aviso-abrir" aria-haspopup="dialog" onClick={abrir}>{texto}</button>
  return (
    <>
      <label className="rp-acepto">
        <input type="checkbox" checked={acepta} onChange={e => onAcepta(e.target.checked)} />
        {corte >= 0
          ? <span>{casilla.slice(0, corte)}{boton(FRASE)}{casilla.slice(corte + FRASE.length)}</span>
          : <span>{casilla}</span>}
      </label>
      {corte < 0 && boton('Ver el aviso de privacidad')}
      <dialog ref={capa} className="rp-capa" aria-labelledby={titulo}>
        <h2 id={titulo} ref={encabezado} tabIndex={-1} className="rp-titulo">Aviso de privacidad</h2>
        <TextoDelAviso aviso={aviso} url={avisoUrl} ruta={avisoRuta} />
        <button type="button" className="rp-btn" onClick={() => capa.current?.close()}>Cerrar</button>
      </dialog>
    </>
  )
}
