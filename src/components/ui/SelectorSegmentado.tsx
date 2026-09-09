'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Selector segmentado: opciones dentro de un carril, con una pastilla que se
 * desplaza sobre la activa.
 *
 * ⚠️ NO SUSTITUYE A `.sp-doc-segmented`, Y NO SON EL MISMO CONTROL. Aquél es un
 * CAMPO DE FORMULARIO —el tipo de documento, la divisa—: mide 38-44 px, reparte
 * las opciones a partes iguales y pinta la activa RELLENA de acento, porque
 * elegir ahí fija un valor del documento. Éste es CROMO DE VISTA: filtra lo que
 * ya se está mirando, así que es más pequeño y su activa es una pastilla clara
 * sobre el carril, no una mancha de color. Además `.sp-doc-segmented--tipo` vive
 * dentro de un `@container docform` y fuera de él se descoloca. Unificarlos
 * daría a un filtro el peso visual de un campo.
 *
 * Consumidores: el filtro de tipo de la línea de tiempo del Resumen, el de
 * formato de los archivos clínicos y el de rango temporal de las mediciones.
 */

export interface OpcionSegmentada<T extends string> {
  valor: T
  rotulo: string
}

export default function SelectorSegmentado<T extends string>({
  opciones, valor, onChange, etiqueta,
}: {
  opciones: readonly OpcionSegmentada<T>[]
  valor: T
  onChange: (valor: T) => void
  /** Para el lector de pantalla: qué se está filtrando. */
  etiqueta: string
}) {
  const carril = useRef<HTMLDivElement>(null)
  const botones = useRef(new Map<T, HTMLButtonElement>())
  const [pastilla, setPastilla] = useState<{ left: number; width: number } | null>(null)

  /* La pastilla se MIDE, no se calcula por índice: los rótulos tienen anchos
     distintos («Todo» contra «12 meses») y repartir el carril a partes iguales
     dejaría aire a los lados de los cortos. `useLayoutEffect` para que la
     posición esté puesta antes del primer pintado y no se vea saltar. */
  useLayoutEffect(() => {
    const medir = () => {
      const activo = botones.current.get(valor)
      if (!activo) { setPastilla(null); return }
      setPastilla({ left: activo.offsetLeft, width: activo.offsetWidth })
    }
    medir()
    const caja = carril.current
    if (!caja || typeof ResizeObserver === 'undefined') return
    /* El carril cambia de ancho al envolver la fila que lo contiene, y entonces
       la pastilla quedaría donde estaba el botón antes de moverse. */
    const ro = new ResizeObserver(medir)
    ro.observe(caja)
    return () => ro.disconnect()
  }, [valor, opciones])

  return (
    <div
      ref={carril}
      role="group"
      aria-label={etiqueta}
      className="relative inline-flex shrink-0 rounded-[var(--sp-r-pill)] bg-[var(--sp-surface-muted)] p-[3px]"
    >
      {pastilla && (
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] rounded-[var(--sp-r-pill)] bg-[var(--sp-surface)] shadow-[var(--sp-shadow-flat)] transition-[left,width] duration-[var(--sp-dur-micro)] ease-[var(--sp-ease-out)] motion-reduce:transition-none"
          style={{ left: pastilla.left, width: pastilla.width }}
        />
      )}
      {opciones.map(o => {
        const activo = o.valor === valor
        return (
          <button
            key={o.valor}
            ref={el => {
              if (el) botones.current.set(o.valor, el)
              else botones.current.delete(o.valor)
            }}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.valor)}
            /* `relative` para que el texto quede POR ENCIMA de la pastilla, que
               es hermana suya y va absoluta. */
            className="relative whitespace-nowrap rounded-[var(--sp-r-pill)] px-[12px] py-[6px] text-[12.5px] transition-colors"
            style={activo
              ? { color: 'var(--sp-ink-800)', fontWeight: 'var(--sp-fw-bold)' }
              : { color: 'var(--sp-ink-500)', fontWeight: 'var(--sp-fw-semi)' }}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
