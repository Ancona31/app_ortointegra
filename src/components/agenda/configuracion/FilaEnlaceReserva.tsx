'use client'

/**
 * Un enlace de reserva vigente en la pantalla de configuración (bloque D):
 * qué es, hasta cuándo vale y, si se pidió, la dirección completa para
 * copiarla. El código no se guarda en ningún sitio del navegador: vive en el
 * estado de la sección mientras la pantalla esté abierta.
 *
 * Tanda T2, punto 8: `aviso` = por qué no abrirá (o abrirá sin horarios),
 * con la regla de la página pública; va debajo del título, a la vista.
 * G2 (punto 5, la maqueta): cada enlace lleva su ESTADO en una píldora
 * («Activo» / «Sin usar» / «No abrirá» / «Sin horarios») y, si no va a abrir
 * por algo que se arregla aquí, «Completar», que abre lo que falta en la ficha.
 */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BOTON_FILA, CAMPO } from '@/components/agenda/configuracion/clasesConfig'

const BOTON = BOTON_FILA

interface Props {
  titulo: string
  detalle: string
  /** «No abrirá: …» o «Abrirá sin horarios: …»; `null` si abre. */
  aviso: string | null
  /** La dirección completa, cuando ya se pidió el código; `null` si no. */
  url: string | null
  ocupado: boolean
  onMostrar: () => void
  onRevocar: () => void
  /** Sólo el enlace fijo se regenera. */
  onRegenerar?: () => void
  /** «Activo» (fijo) o «Sin usar» (único) cuando abre. */
  textoAbre: string
  /** G2: abre lo que falta en la ficha; sólo si se puede arreglar aquí. */
  onCompletar?: () => void
}

const PILDORA = 'shrink-0 rounded-[var(--ag-r-pill)] border px-[var(--ag-2)] py-px text-xs font-semibold whitespace-nowrap'

/** El estado del enlace, en la píldora de la maqueta: verde si abre; ámbar si no o si abre sin horarios. */
function Pildora({ aviso, textoAbre }: { aviso: string | null; textoAbre: string }) {
  if (!aviso) return <span className={`${PILDORA} border-[var(--ag-success-border)] bg-[var(--ag-success-bg)] text-[var(--ag-success-text)]`}>{textoAbre}</span>
  return (
    <span className={`${PILDORA} border-[var(--ag-aviso-border)] bg-[var(--ag-aviso-bg)] text-[var(--ag-aviso-text)]`}>
      {aviso.startsWith('No abrirá') ? 'No abrirá' : 'Sin horarios'}
    </span>
  )
}

export default function FilaEnlaceReserva({ titulo, detalle, aviso, url, ocupado, onMostrar, onRevocar, onRegenerar, textoAbre, onCompletar }: Props) {
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
    <li className="flex flex-col gap-[var(--ag-2)] py-[var(--ag-2-5)]">
      <div className="flex flex-wrap items-center gap-x-[var(--ag-3)] gap-y-[var(--ag-1)]">
        <span className="text-sm font-medium text-[var(--ag-text)]">{titulo}</span>
        <span className="text-sm text-[var(--ag-muted)]">{detalle}</span>
        <Pildora aviso={aviso} textoAbre={textoAbre} />
        <span className="ml-auto flex flex-wrap gap-[var(--ag-1)]">
          {onCompletar && <button type="button" className={`${BOTON} font-semibold text-[var(--ag-brand-legible)]`} disabled={ocupado} onClick={onCompletar}
            aria-label={`Completar ${titulo}`}>Completar</button>}
          {!url && <button type="button" className={BOTON} disabled={ocupado} onClick={onMostrar} aria-label={`Mostrar ${titulo}`}>Mostrar enlace</button>}
          {onRegenerar && <button type="button" className={BOTON} disabled={ocupado} onClick={onRegenerar} aria-label={`Regenerar ${titulo}`}>Regenerar</button>}
          <button type="button" className={BOTON} disabled={ocupado} onClick={onRevocar} aria-label={`Revocar ${titulo}`}>Revocar</button>
        </span>
      </div>
      {aviso && (
        <p role="status" className="flex items-start gap-[var(--ag-1-5)] text-sm font-medium text-[var(--ag-aviso-text)]">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{aviso}</span>
        </p>
      )}
      {url && (
        <div className="flex flex-wrap items-center gap-[var(--ag-2)]">
          <input readOnly value={url} aria-label={`Dirección de ${titulo}`} onFocus={e => e.currentTarget.select()}
            className={`${CAMPO} min-w-0 flex-1 bg-[var(--ag-bg-app)]`} />
          <button type="button" className={BOTON} onClick={() => void copiar()}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}
    </li>
  )
}
