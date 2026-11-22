'use client'

import { resumenSuplemento } from '@/components/documentos/suplementosCompacto'

interface Props {
  numero: number
  nombre: string
  marca: string
  dosis: string
  justificacion: string
  onAbrir: () => void
}

/**
 * Suplemento PLEGADO del plan compacto: una línea-resumen que es un solo botón
 * (tocarla o Enter la abre y pliega la abierta). Nombre en negrita y la marca
 * al lado; dosis · justificación recortadas en el segundo renglón. Sin dosis,
 * lo dice en rojo. Mismas piezas visuales que la línea de la receta (§26.1).
 */
export default function LineaSuplemento({ numero, nombre, marca, dosis, justificacion, onAbrir }: Props) {
  const sinDosis = dosis.trim() === ''
  return (
    <button type="button" className="sp-rx-linea" onClick={onAbrir} data-suplemento-linea={numero}>
      <span className="sp-rx-num" aria-hidden="true">{numero}</span>
      <span className="sp-rx-linea-t">
        <span className="sp-rx-linea-1">
          <span className="sr-only">Suplemento {numero}: </span>
          <span className="sp-rx-com">{nombre}</span>
          {marca.trim() && <span className="sp-rx-det">{marca.trim()}</span>}
        </span>
        <span className="sp-rx-ind">{resumenSuplemento(dosis, justificacion)}</span>
      </span>
      {sinDosis && <span className="sp-rx-via sp-rx-via--falta">Falta la dosis</span>}
    </button>
  )
}
