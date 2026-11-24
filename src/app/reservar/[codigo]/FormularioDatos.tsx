'use client'

import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'

export interface Datos { nombre: string; telefono: string; correo: string }

interface Props {
  aviso: string
  /** La dirección del aviso integral como va escrita al final del aviso, y la ruta a la que enlaza. */
  avisoUrl: string
  avisoRuta: string
  casilla: string
  ocupado: boolean
  textoBoton: string
  onEnviar: (d: Datos) => void
  /**
   * Lo ya escrito, al volver a este paso desde cualquier otro (tanda H, punto
   * 1). La casilla del aviso vuelve DESMARCADA: es el consentimiento y se da
   * al enviar (D5), no se arrastra.
   */
  inicial?: Datos | null
  /** Cada cambio, para que quien monta el formulario lo guarde mientras la persona va y viene. */
  onCambio?: (d: Datos) => void
  /** El botón «Volver» del pie (lo pone la página). */
  volver?: ReactNode
  /**
   * Tanda J, punto 3 de Angel: en el enlace de UN SOLO USO no se pide correo
   * (antes, tanda I, era opcional). Los correos de la cita van sólo al que
   * escribió la clínica al emitir el enlace, y la página no lo enseña. En el
   * fijo sigue siendo obligatorio, con su código.
   */
  sinCorreo?: boolean
}

/**
 * El aviso simplificado, ABIERTO (privacidad 2026-12: nunca plegado ni tras un
 * clic). El texto es el aprobado, sin tocar; sólo la dirección del aviso
 * integral con la que termina se pinta como enlace, en otra pestaña para no
 * perder lo escrito.
 */
function TextoDelAviso({ aviso, url, ruta }: { aviso: string; url: string; ruta: string }): ReactElement {
  const conEnlace = url.length > 0 && aviso.endsWith(url)
  return (
    <div className="rp-aviso-legal" data-aviso-reserva>
      {conEnlace ? aviso.slice(0, -url.length) : aviso}
      {conEnlace && <a href={ruta} target="_blank" rel="noopener noreferrer">{url}</a>}
    </div>
  )
}

/** Nombre, teléfono y correo, y el aviso con su casilla (nace desmarcada). El texto del aviso NO se toca. */
export default function FormularioDatos({ aviso, avisoUrl, avisoRuta, casilla, ocupado, textoBoton, onEnviar, inicial, onCambio, volver, sinCorreo = false }: Props): ReactElement {
  const [d, setDatos] = useState<Datos>(inicial ?? { nombre: '', telefono: '', correo: '' })
  const setD = (nuevos: Datos) => { setDatos(nuevos); onCambio?.(nuevos) }
  const [acepta, setAcepta] = useState(false)
  const enviar = (e: FormEvent) => { e.preventDefault(); if (acepta) onEnviar(d) }

  return (
    <form onSubmit={enviar} className="rp-paso" style={{ animation: 'none' }}>
      <label className="rp-campo">Nombre completo
        {/* 80: el tope de NOMBRE_MAX (esquemasReserva.ts, seg1); el servidor lo vuelve a exigir. */}
        <input required maxLength={80} autoComplete="name" value={d.nombre}
          onChange={e => setD({ ...d, nombre: e.target.value })} />
      </label>
      <label className="rp-campo">Teléfono (10 dígitos)
        <input required inputMode="tel" autoComplete="tel" maxLength={20} value={d.telefono}
          onChange={e => setD({ ...d, telefono: e.target.value })} />
      </label>
      {!sinCorreo && (
        <label className="rp-campo">Correo electrónico
          <input required type="email" autoComplete="email" maxLength={254} value={d.correo}
            onChange={e => setD({ ...d, correo: e.target.value })} />
        </label>
      )}
      <TextoDelAviso aviso={aviso} url={avisoUrl} ruta={avisoRuta} />
      <label className="rp-acepto">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
        <span>{casilla}</span>
      </label>
      <div className="rp-pie">
        <div className="rp-pie__fila">
          {volver}
          <button type="submit" className="rp-btn" disabled={!acepta || ocupado}>{ocupado ? 'Un momento…' : textoBoton}</button>
        </div>
      </div>
    </form>
  )
}
