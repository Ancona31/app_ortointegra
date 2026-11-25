'use client'

import { useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'

interface Props {
  correo: string
  ocupado: boolean
  onVerificar: (codigo: string) => void
  onReenviar: () => void
  /** K2 (punto 10): antes de este instante (ms) el reenviar cuenta hacia atrás; lo fija lo que dijo el servidor. */
  reenviarDesde: number
  /** K2 (punto 9): el código que trajo «Continuar mi reserva»; sólo rellena, no verifica. */
  codigoInicial?: string | null
  /** El botón «Volver» a «Tus datos» (tanda H, punto 1), con lo escrito allí intacto. */
  volver?: ReactNode
}

/** El código de 6 dígitos que llegó al correo (sólo el enlace fijo). */
export default function PasoCodigo({ correo, ocupado, onVerificar, onReenviar, reenviarDesde, codigoInicial, volver }: Props): ReactElement {
  const [codigo, setCodigo] = useState(codigoInicial ?? '')
  const faltan = useCuentaAtras(reenviarDesde)
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
        <button type="button" className="rp-enlace" disabled={ocupado || faltan > 0} onClick={onReenviar}>
          {faltan > 0 ? `Enviar otro código en ${faltan} s` : 'Enviar otro código'}
        </button>
      </div>
    </form>
  )
}

/** Segundos enteros que faltan hasta `hasta` (ms), al segundo; 0 cuando ya se puede. */
function useCuentaAtras(hasta: number): number {
  const calcular = () => Math.max(0, Math.ceil((hasta - Date.now()) / 1000))
  const [faltan, setFaltan] = useState(calcular)
  useEffect(() => {
    setFaltan(calcular())
    if (hasta <= Date.now()) return
    const reloj = setInterval(() => {
      const f = calcular()
      setFaltan(f)
      if (f === 0) clearInterval(reloj)
    }, 1000)
    return () => clearInterval(reloj)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `calcular` sólo depende de `hasta`
  }, [hasta])
  return faltan
}
