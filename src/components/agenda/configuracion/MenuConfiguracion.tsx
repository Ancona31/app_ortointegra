'use client'

/**
 * Las pestañas de la configuración de la agenda (tanda H, punto 5 de Angel:
 * «Pestañas por sección, en lugar de una página larga de texto»). Antes (G2)
 * eran anclas a secciones de una sola página; ahora cada sección es un panel
 * y sólo se ve el de la pestaña elegida.
 *
 * Patrón «Tabs» de la WAI-ARIA APG con activación automática: `role="tablist"`
 * con `role="tab"`, `aria-selected`, `aria-controls` al panel y foco
 * itinerante (sólo la elegida está en el orden de tabulación). Flechas
 * izquierda/derecha y arriba/abajo pasan a la anterior o la siguiente (con
 * vuelta), Inicio y Fin a la primera y la última. En escritorio (≥ lg) es una
 * columna a la izquierda; en el teléfono, una fila que se DESPLAZA de lado
 * (sin envolver), y la elegida se trae a la vista.
 *
 * «Primeros pasos» lleva cuántos faltan, en ámbar, mientras falte alguno.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react'

export type ClavePestana = 'pasos' | 'horario' | 'tipos' | 'enlaces' | 'plazos' | 'bloqueados' | 'restablecer'
export interface Pestana { clave: ClavePestana; texto: string; nota?: string }

export const idPestana = (c: ClavePestana) => `config-pestana-${c}`
export const idPanel = (c: ClavePestana) => `config-panel-${c}`

const SIGUIENTE: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n, ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n, ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0, End: (_i, n) => n - 1,
}

interface Props {
  pestanas: readonly Pestana[]
  /** `null` mientras se decide (la lista de enlaces aún no llega). */
  activa: ClavePestana | null
  elegir: (c: ClavePestana) => void
}

export default function MenuConfiguracion({ pestanas, activa, elegir }: Props) {
  const lista = useRef<HTMLDivElement | null>(null)
  /* La elegida, a la vista en la fila desplazable del teléfono. */
  useEffect(() => {
    if (!activa) return
    lista.current?.querySelector<HTMLElement>(`#${idPestana(activa)}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activa])

  function alTeclear(e: KeyboardEvent<HTMLDivElement>): void {
    const mover = SIGUIENTE[e.key]
    if (!mover || pestanas.length === 0) return
    e.preventDefault()
    const i = Math.max(0, pestanas.findIndex(p => p.clave === activa))
    const destino = pestanas[mover(i, pestanas.length)]
    if (!destino) return
    elegir(destino.clave)
    lista.current?.querySelector<HTMLElement>(`#${idPestana(destino.clave)}`)?.focus()
  }

  return (
    <div ref={lista} role="tablist" aria-label="Secciones de la configuración" onKeyDown={alTeclear}
      className="-mx-[var(--ag-1)] flex gap-[var(--ag-2)] overflow-x-auto px-[var(--ag-1)] pb-[var(--ag-1)] lg:sticky lg:top-[var(--ag-4)] lg:mx-0 lg:flex-col lg:gap-[var(--ag-1)] lg:overflow-visible lg:px-0">
      {pestanas.map((p, i) => {
        const elegida = p.clave === activa
        return (
          <button key={p.clave} type="button" role="tab" id={idPestana(p.clave)} data-clave={p.clave}
            aria-selected={elegida} aria-controls={idPanel(p.clave)} tabIndex={elegida || (!activa && i === 0) ? 0 : -1}
            onClick={() => elegir(p.clave)}
            className={`flex min-h-10 shrink-0 items-center justify-between gap-[var(--ag-2)] whitespace-nowrap rounded-[var(--ag-r-btn)] border px-[var(--ag-3)] text-left text-sm lg:whitespace-normal ${elegida
              ? 'border-[var(--ag-control-primario-border)] bg-[var(--ag-primary-bg-faint)] font-semibold text-[var(--ag-brand-legible)]'
              : 'border-[var(--ag-control-border)] bg-[var(--ag-control-bg)] font-medium text-[var(--ag-text)] hover:bg-[var(--ag-control-bg-hover)]'}`}>
            <span>{p.texto}</span>
            {p.nota && <small className="text-xs font-bold text-[var(--ag-aviso-text)]">{p.nota}</small>}
          </button>
        )
      })}
    </div>
  )
}
