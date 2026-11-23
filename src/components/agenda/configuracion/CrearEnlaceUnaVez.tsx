'use client'

/**
 * «¿Para quién es? (solo lo ves tú)» + «Crear enlace de una vez» y, ya creado,
 * su dirección con «Copiar» (maqueta `Main.dc.html`, cierre). Lo usan el
 * cierre del funnel y «Enlaces de una vez» de la pestaña «Tu enlace».
 * Guarda con `POST /api/agenda/enlaces` (`clase:'unico'`), la ruta de siempre.
 *
 * Integración de la tanda J (J2 ↔ J5): también «Correo del paciente
 * (opcional)», el de J2 (punto 3), que la maqueta no dibuja. Sin él, la
 * pantalla nueva no tenía cómo darle correo a un único y la reserva por ese
 * enlace no mandaba comprobante ni avisos a nadie.
 *
 * B13 · AG9/AG10 (rediseño, maquetas `ag-config` y `ag-pv`): campos del kit; «Crear enlace de una vez» es tonal
 * (el único relleno de la pantalla es «Copiar enlace»); creado, la dirección en letra de máquina y «Copiar» como
 * acción de texto.
 */
import { useId, useState } from 'react'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import { emitirEnlace, urlReserva } from '@/components/agenda/configuracion/accionesConfig'
import { AYUDA, BOTON_BLANCO, BOTON_CHICO, BOTON_TEXTO, CAMPO_NUEVO, DIRECCION, ERROR } from '@/components/agenda/configuracion/estilosConfig'

interface Props {
  medicoId: string
  /** Tras crearlo: releer la lista y avisar «Guardado». */
  alCrear: () => void
  /** El botón de cancelar (en la pestaña; el cierre no lo tiene). */
  alCancelar?: () => void
}

const ETIQUETA = 'k-etiqueta flex min-w-0 flex-[1_1_220px] flex-col gap-[4px]'

export default function CrearEnlaceUnaVez({ medicoId, alCrear, alCancelar }: Props) {
  const id = useId()
  const [etiqueta, setEtiqueta] = useState('')
  const [correo, setCorreo] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function crear(): Promise<void> {
    setEnviando(true)
    const r = await emitirEnlace(medicoId, 'unico', etiqueta.trim() || null, correo.trim() || null)
    setEnviando(false)
    if (!r.ok) { setError(r.motivo); return }
    setError(null)
    setUrl(r.valor.codigo ? urlReserva(r.valor.codigo) : null)
    alCrear()
  }
  if (url) {
    return (
      <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
        <span data-enlace-una-vez className={`${DIRECCION} flex-[1_1_240px]`}>{url}</span>
        <BotonCopiar texto={url} ariaLabel="Copiar el enlace de una vez" className={BOTON_TEXTO} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-end gap-[12px]">
        <label htmlFor={`${id}-q`} className={ETIQUETA}>¿Para quién es? (solo lo ves tú)
          <input id={`${id}-q`} type="text" maxLength={60} placeholder="Ej.: Sra. López, revisión" className={CAMPO_NUEVO}
            value={etiqueta} onChange={e => setEtiqueta(e.target.value)} />
        </label>
        <label htmlFor={`${id}-c`} className={ETIQUETA}>Correo del paciente (opcional)
          <input id={`${id}-c`} type="email" autoComplete="off" maxLength={254} aria-describedby={`${id}-n`} className={CAMPO_NUEVO}
            value={correo} onChange={e => setCorreo(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-[8px]">
        <button type="button" className={BOTON_CHICO} disabled={enviando} onClick={() => void crear()}>
          {enviando ? 'Creando…' : 'Crear enlace de una vez'}
        </button>
        {alCancelar && <button type="button" className={BOTON_BLANCO} onClick={alCancelar}>Cancelar</button>}
      </div>
      <p id={`${id}-n`} className={`m-0 ${AYUDA}`}>El comprobante y los avisos de la cita irán sólo a este correo; sin él, no se manda ninguno.</p>
      {error && <p role="alert" className={ERROR}>{error}</p>}
    </div>
  )
}
