'use client'

/**
 * «¿Para quién es? (solo lo ves tú)» + «Crear enlace de una vez» y, ya creado,
 * su dirección con «Copiar» (maqueta `Main.dc.html`, cierre). Lo usan el
 * cierre del funnel y «Enlaces de una vez» de la pestaña «Tu enlace».
 * Guarda con `POST /api/agenda/enlaces` (`clase:'unico'`), la ruta de siempre.
 */
import { useId, useState } from 'react'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import { emitirEnlace, urlReserva } from '@/components/agenda/configuracion/accionesConfig'
import { CAMPO_NUEVO, ERROR } from '@/components/agenda/configuracion/estilosConfig'

interface Props {
  medicoId: string
  /** Tras crearlo: releer la lista y avisar «Guardado». */
  alCrear: () => void
  /** El botón de cancelar (en la pestaña; el cierre no lo tiene). */
  alCancelar?: () => void
}

const BOTON_CONTORNO =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[10px] border border-[var(--ag-brand-secondary)] bg-[var(--ag-surface)] px-[20px] text-[16px] font-semibold text-[var(--ag-brand-legible)] disabled:cursor-not-allowed disabled:opacity-60'

export default function CrearEnlaceUnaVez({ medicoId, alCrear, alCancelar }: Props) {
  const id = useId()
  const [etiqueta, setEtiqueta] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function crear(): Promise<void> {
    setEnviando(true)
    const r = await emitirEnlace(medicoId, 'unico', etiqueta.trim() || null)
    setEnviando(false)
    if (!r.ok) { setError(r.motivo); return }
    setError(null)
    setUrl(r.valor.codigo ? urlReserva(r.valor.codigo) : null)
    alCrear()
  }
  if (url) {
    return (
      <div className="flex flex-wrap items-center gap-[10px] rounded-[10px] border border-[var(--ag-border-card)] bg-[var(--ag-surface-sunken)] px-[14px] py-[12px]">
        <span data-enlace-una-vez className="flex-[1_1_260px] break-all font-mono text-[15px] text-[var(--ag-ink)]">{url}</span>
        <BotonCopiar texto={url} ariaLabel="Copiar el enlace de una vez"
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[10px] border-0 bg-[var(--ag-brand-secondary)] px-[18px] text-[15px] font-semibold text-white" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex flex-wrap items-end gap-[10px]">
        <label htmlFor={`${id}-q`} className="flex flex-[1_1_260px] flex-col gap-[6px] text-[14px] text-[var(--ag-text)]">¿Para quién es? (solo lo ves tú)
          <input id={`${id}-q`} type="text" maxLength={60} placeholder="Ej.: Sra. López, revisión" className={`${CAMPO_NUEVO} px-[12px] py-[10px]`}
            value={etiqueta} onChange={e => setEtiqueta(e.target.value)} />
        </label>
        <button type="button" className={BOTON_CONTORNO} disabled={enviando} onClick={() => void crear()}>
          {enviando ? 'Creando…' : 'Crear enlace de una vez'}
        </button>
        {alCancelar && <button type="button" className={BOTON_CONTORNO} onClick={alCancelar}>Cancelar</button>}
      </div>
      {error && <p role="alert" className={ERROR}>{error}</p>}
    </div>
  )
}
