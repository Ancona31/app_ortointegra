'use client'

/**
 * Un enlace de reserva vigente en la pantalla de configuración (bloque D):
 * qué es, hasta cuándo vale y, si se pidió, la dirección completa para
 * copiarla. El código no se guarda en ningún sitio del navegador: vive en el
 * estado de la sección mientras la pantalla esté abierta.
 */
import { useState } from 'react'

const BOTON = 'px-2.5 py-1 rounded-lg text-sm text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)] disabled:opacity-50'

interface Props {
  titulo: string
  detalle: string
  /** La dirección completa, cuando ya se pidió el código; `null` si no. */
  url: string | null
  ocupado: boolean
  onMostrar: () => void
  onRevocar: () => void
  /** Sólo el enlace fijo se regenera. */
  onRegenerar?: () => void
}

export default function FilaEnlaceReserva({ titulo, detalle, url, ocupado, onMostrar, onRevocar, onRegenerar }: Props) {
  const [copiado, setCopiado] = useState(false)
  async function copiar(): Promise<void> {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <li className="py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--ag-text)]">{titulo}</span>
        <span className="text-sm text-[var(--ag-muted)]">{detalle}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {!url && <button type="button" className={BOTON} disabled={ocupado} onClick={onMostrar} aria-label={`Mostrar ${titulo}`}>Mostrar enlace</button>}
          {onRegenerar && <button type="button" className={BOTON} disabled={ocupado} onClick={onRegenerar} aria-label={`Regenerar ${titulo}`}>Regenerar</button>}
          <button type="button" className={BOTON} disabled={ocupado} onClick={onRevocar} aria-label={`Revocar ${titulo}`}>Revocar</button>
        </span>
      </div>
      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={url} aria-label={`Dirección de ${titulo}`} onFocus={e => e.currentTarget.select()}
            className="min-w-0 flex-1 px-2 py-1.5 text-sm rounded-lg border border-[var(--ag-border-card)] bg-[var(--ag-bg-app)] text-[var(--ag-text)]" />
          <button type="button" className={BOTON} onClick={() => void copiar()}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}
    </li>
  )
}
