'use client'

import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'

interface Props {
  correo: string
  ocupado: boolean
  onVerificar: (codigo: string) => void
  onReenviar: () => void
  /** El botón «Volver» a «Tus datos» (tanda H, punto 1), con lo escrito allí intacto. */
  volver?: ReactNode
}

/** El código de 6 dígitos que llegó al correo (sólo el enlace fijo). */
export default function PasoCodigo({ correo, ocupado, onVerificar, onReenviar, volver }: Props): ReactElement {
  const [codigo, setCodigo] = useState('')
  const enviar = (e: FormEvent) => { e.preventDefault(); if (/^[0-9]{6}$/.test(codigo)) onVerificar(codigo) }
  return (
    <form onSubmit={enviar} className="rp-paso" style={{ animation: 'none' }}>
      <p className="rp-sub">Te enviamos un código de 6 dígitos a <strong style={{ color: 'var(--ag-ink)', overflowWrap: 'anywhere' }}>{correo}</strong>. Vence en 10 minutos.</p>
      <label className="rp-campo rp-campo--codigo">Código
        <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo}
          onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} />
      </label>
      <div className="rp-pie">
        <div className="rp-pie__fila">
          {volver}
          <button type="submit" className="rp-btn" disabled={ocupado || codigo.length !== 6}>{ocupado ? 'Un momento…' : 'Verificar y reservar'}</button>
        </div>
        <button type="button" className="rp-enlace" disabled={ocupado} onClick={onReenviar}>Enviar otro código</button>
      </div>
    </form>
  )
}
