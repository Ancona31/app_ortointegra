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
 * B13 · AG9 (rediseño, maqueta `ag-config`): una fila de la lista de la ficha; título 15/600 con la etiqueta de
 * estado del kit (`.k-etq`) a su lado y el detalle debajo (el orden del DOM no cambia: título, detalle,
 * etiqueta); acciones de TEXTO azul a la derecha («Revocar» en rojo).
 */
import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { BOTON_TEXTO, BOTON_TEXTO_ROJO, CAMPO_NUEVO } from '@/components/agenda/configuracion/estilosConfig'

const BOTON = BOTON_TEXTO

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

/** El estado del enlace, en la etiqueta del kit: verde si abre; ámbar si no o si abre sin horarios. */
function Pildora({ aviso, textoAbre }: { aviso: string | null; textoAbre: string }) {
  if (!aviso) return <span className="k-etq k-etq-ok order-2"><Check aria-hidden="true" />{textoAbre}</span>
  return <span className="k-etq k-etq-aviso order-2">{aviso.startsWith('No abrirá') ? 'No abrirá' : 'Sin horarios'}</span>
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
    <li className="flex flex-col gap-[6px] py-[8px] pl-[16px] pr-[8px] ih:pl-[20px] iv:pl-[20px] esc:pl-[20px] ih:pr-[12px] iv:pr-[12px] esc:pr-[12px]">
      <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
        <span className="order-1 text-[15px] font-semibold leading-[20px] text-tinta">{titulo}</span>
        <span className="order-3 basis-full text-[13px] leading-[18px] text-tinta2 ih:order-4 iv:order-4 esc:order-4">{detalle}</span>
        <Pildora aviso={aviso} textoAbre={textoAbre} />
        <span className="order-4 -ml-[8px] flex flex-wrap ih:order-3 iv:order-3 esc:order-3 ih:ml-auto iv:ml-auto esc:ml-auto">
          {onCompletar && <button type="button" className={BOTON} disabled={ocupado} onClick={onCompletar}
            aria-label={`Completar ${titulo}`}>Completar</button>}
          {!url && <button type="button" className={BOTON} disabled={ocupado} onClick={onMostrar} aria-label={`Mostrar ${titulo}`}>Mostrar enlace</button>}
          {onRegenerar && <button type="button" className={BOTON} disabled={ocupado} onClick={onRegenerar} aria-label={`Regenerar ${titulo}`}>Regenerar</button>}
          <button type="button" className={BOTON_TEXTO_ROJO} disabled={ocupado} onClick={onRevocar} aria-label={`Revocar ${titulo}`}>Revocar</button>
        </span>
      </div>
      {aviso && (
        <p role="status" className="m-0 flex items-start gap-[6px] pr-[8px] text-[13px] leading-[18px] text-aviso-tinta">
          <AlertTriangle size={16} aria-hidden="true" className="mt-[1px] shrink-0" /><span>{aviso}</span>
        </p>
      )}
      {url && (
        <div className="flex flex-wrap items-center gap-[8px] pr-[8px]">
          <input readOnly value={url} aria-label={`Dirección de ${titulo}`} onFocus={e => e.currentTarget.select()}
            className={`${CAMPO_NUEVO} min-w-0 flex-1 font-mono`} />
          <button type="button" className={BOTON} onClick={() => void copiar()}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}
    </li>
  )
}
