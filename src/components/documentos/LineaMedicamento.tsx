'use client'

import { colorVia, etiquetaVia, NOMBRE_FALTA, type Falta, type MedicamentoConVia } from '@/components/documentos/recetaCompacta'

interface Props {
  numero: number
  med: MedicamentoConVia
  /** Lo que le falta; sólo se pinta tras el primer intento de imprimir. */
  faltas: readonly Falta[]
  onAbrir: () => void
}

/**
 * Medicamento PLEGADO de la receta compacta: una línea-resumen que es un solo
 * botón (tocarlo o Enter lo abre y pliega el que estuviera abierto). Comercial
 * en negrita, presentación · genérico, las indicaciones recortadas en un
 * segundo renglón y la vía como etiqueta de color (sólo pantalla).
 */
export default function LineaMedicamento({ numero, med, faltas, onAbrir }: Props) {
  const comercial = med.nombre_comercial.trim()
  const generico = med.principio_activo?.trim() ?? ''
  const titulo = comercial || generico || 'Sin nombre'
  const detalle = [med.presentacion?.trim(), comercial ? generico : ''].filter(Boolean).join(' · ')
  const via = med.via_administracion?.trim() ?? ''

  let etiqueta: { texto: string; clase: string }
  if (faltas.length > 0) etiqueta = { texto: `Falta ${faltas.map(f => NOMBRE_FALTA[f]).join(' y ')}`, clase: 'sp-rx-via--falta' }
  else if (via) etiqueta = { texto: etiquetaVia(via), clase: `sp-rx-via--${colorVia(via)}` }
  else etiqueta = { texto: 'Sin vía', clase: 'sp-rx-via--falta' }

  return (
    <button type="button" className="sp-rx-linea" onClick={onAbrir} data-receta-linea={numero}>
      <span className="sp-rx-num" aria-hidden="true">{numero}</span>
      <span className="sp-rx-linea-t">
        <span className="sp-rx-linea-1">
          <span className="sr-only">Medicamento {numero}: </span>
          <span className="sp-rx-com">{titulo}</span>
          {detalle && <span className="sp-rx-det">{detalle}</span>}
        </span>
        <span className="sp-rx-ind">{med.indicacion.trim() || 'Sin indicaciones'}</span>
      </span>
      <span className={`sp-rx-via ${etiqueta.clase}`}>
        {via && faltas.length === 0 && <span className="sr-only">Vía: </span>}
        {etiqueta.texto}
      </span>
    </button>
  )
}
