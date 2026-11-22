'use client'

/**
 * Selector segmentado: opciones dentro de un carril; la activa, en blanco sobre
 * la pista (`.k-seg` / `.k-seg-op` de `sistema.css`, rediseño B7).
 *
 * ⚠️ NO SUSTITUYE A `.sp-doc-segmented`, Y NO SON EL MISMO CONTROL. Aquél es un
 * CAMPO DE FORMULARIO —el tipo de documento, la divisa—: reparte las opciones a
 * partes iguales y pinta la activa RELLENA de acento, porque elegir ahí fija un
 * valor del documento. Éste es CROMO DE VISTA: filtra lo que ya se está
 * mirando, así que es más pequeño y su activa es una pastilla clara sobre el
 * carril, no una mancha de color. Unificarlos daría a un filtro el peso visual
 * de un campo.
 *
 * ⚠️ SIN PASTILLA DESLIZANTE. La de antes se movía animando `left` y `width`,
 * que provocan relayout; el sistema sólo anima `transform` y `opacity`. La
 * activa se marca con `aria-pressed` y la pinta la primitiva.
 *
 * Consumidores: el filtro de tipo de la línea de tiempo del Resumen, el de
 * formato de los archivos clínicos y el de rango temporal de las mediciones.
 */

export interface OpcionSegmentada<T extends string> {
  valor: T
  rotulo: string
}

export default function SelectorSegmentado<T extends string>({
  opciones, valor, onChange, etiqueta, className = '',
}: {
  opciones: readonly OpcionSegmentada<T>[]
  valor: T
  onChange: (valor: T) => void
  /** Para el lector de pantalla: qué se está filtrando. */
  etiqueta: string
  className?: string
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`k-seg max-w-full ${className}`}>
      {opciones.map(o => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className="k-seg-op"
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
