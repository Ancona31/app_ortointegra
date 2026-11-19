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
 * Tanda L (punto 17): fila gris y botones chicos de 44 px de la configuración nueva; mismos nombres.
 * Con borde y fondo (tanda H, punto 7): la maqueta no los dibuja como texto, así que no van en la lista
 * de botones de texto que acepta `agenda-h2-configuracion` 7.
 */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BOTON_CHICO, CAMPO_NUEVO } from '@/components/agenda/configuracion/estilosConfig'

const BOTON = BOTON_CHICO

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

const PILDORA = 'shrink-0 rounded-[var(--ag-r-pill)] border px-[var(--ag-2)] py-px text-[13px] font-semibold whitespace-nowrap'

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
    <li className="flex flex-col gap-[8px] rounded-[10px] bg-[var(--ag-surface-sunken)] px-[16px] py-[10px]">
      <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px]">
        <span className="text-[15px] font-semibold text-[var(--ag-ink)]">{titulo}</span>
        <span className="text-[13.5px] text-[var(--ag-ink-600)]">{detalle}</span>
        <Pildora aviso={aviso} textoAbre={textoAbre} />
        <span className="ml-auto flex flex-wrap gap-[8px]">
          {onCompletar && <button type="button" className={BOTON} disabled={ocupado} onClick={onCompletar}
            aria-label={`Completar ${titulo}`}>Completar</button>}
          {!url && <button type="button" className={BOTON} disabled={ocupado} onClick={onMostrar} aria-label={`Mostrar ${titulo}`}>Mostrar enlace</button>}
          {onRegenerar && <button type="button" className={BOTON} disabled={ocupado} onClick={onRegenerar} aria-label={`Regenerar ${titulo}`}>Regenerar</button>}
          <button type="button" className={BOTON} disabled={ocupado} onClick={onRevocar} aria-label={`Revocar ${titulo}`}>Revocar</button>
        </span>
      </div>
      {aviso && (
        <p role="status" className="m-0 flex items-start gap-[6px] text-[14px] text-[var(--ag-aviso-text)]">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{aviso}</span>
        </p>
      )}
      {url && (
        <div className="flex flex-wrap items-center gap-[8px]">
          <input readOnly value={url} aria-label={`Dirección de ${titulo}`} onFocus={e => e.currentTarget.select()}
            className={`${CAMPO_NUEVO} min-w-0 flex-1`} />
          <button type="button" className={BOTON} onClick={() => void copiar()}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}
    </li>
  )
}
