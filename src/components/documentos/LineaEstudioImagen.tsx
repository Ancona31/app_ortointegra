'use client'

import { colorModalidad, componer, modalidadDe, nombreFalta, type EstudioEditor, type Falta } from '@/components/documentos/imagenCompuesta'

interface Props {
  numero: number
  estudio: EstudioEditor
  /** Lo que le falta (si tiene datos); se dice en rojo aunque no se haya intentado imprimir. */
  faltas: readonly Falta[]
  onAbrir: () => void
}

/**
 * Estudio PLEGADO de la solicitud de imagen: una línea que es un solo botón
 * (tocarlo o Enter lo abre y pliega el que estuviera abierto). Etiqueta corta
 * del tipo con color (sólo pantalla), región + lado en negrita, el tipo
 * completo, y proyecciones · indicación en el segundo renglón.
 */
export default function LineaEstudioImagen({ numero, estudio, faltas, onAbrir }: Props) {
  const s = componer(estudio)
  const m = modalidadDe(estudio.modalidad)
  const detalle = [s.proyecciones.trim(), s.indicacion.trim()].filter(Boolean).join(' · ')
    || (m?.proyecciones ? 'Sin proyecciones' : 'Sin indicación específica')

  return (
    <button type="button" className="sp-rx-linea sp-img-linea" onClick={onAbrir} data-imagen-linea={numero}>
      <span className={`sp-img-etq sp-img-etq--${colorModalidad(estudio.modalidad)}`}>
        {m && <span className="sr-only">{m.nombre}: </span>}{m?.corto ?? '—'}
      </span>
      <span className="sp-rx-num" aria-hidden="true">{numero}</span>
      <span className="sp-rx-linea-t">
        <span className="sp-rx-linea-1">
          <span className="sr-only">Estudio {numero}: </span>
          <span className="sp-rx-com">{s.region.trim() || 'Sin región'}</span>
          {s.tipo.trim() && <span className="sp-rx-det">{s.tipo}</span>}
        </span>
        <span className="sp-rx-ind">{detalle}</span>
      </span>
      {faltas.length > 0 && (
        <span className="sp-rx-via sp-rx-via--falta">Falta {nombreFalta(faltas[0], estudio)}</span>
      )}
    </button>
  )
}
