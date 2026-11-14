'use client'

import { useState, type FormEvent, type ReactElement } from 'react'

export interface Datos { nombre: string; telefono: string; correo: string }

interface Props {
  aviso: string
  casilla: string
  ocupado: boolean
  textoBoton: string
  onEnviar: (d: Datos) => void
  /** Lo ya escrito, al volver del paso del código. La casilla vuelve desmarcada. */
  inicial?: Datos | null
}

/** Nombre, teléfono y correo, y el aviso con su casilla (nace desmarcada). El texto del aviso NO se toca. */
export default function FormularioDatos({ aviso, casilla, ocupado, textoBoton, onEnviar, inicial }: Props): ReactElement {
  const [d, setD] = useState<Datos>(inicial ?? { nombre: '', telefono: '', correo: '' })
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
      <label className="rp-campo">Correo electrónico
        <input required type="email" autoComplete="email" maxLength={254} value={d.correo}
          onChange={e => setD({ ...d, correo: e.target.value })} />
      </label>
      <details className="rp-aviso-legal">
        <summary>Aviso de privacidad</summary>
        <div style={{ marginTop: 'var(--ag-2)', whiteSpace: 'pre-line' }}>{aviso}</div>
      </details>
      <label className="rp-acepto">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
        <span>{casilla}</span>
      </label>
      <div className="rp-pie">
        <button type="submit" className="rp-btn" disabled={!acepta || ocupado}>{ocupado ? 'Un momento…' : textoBoton}</button>
      </div>
    </form>
  )
}
