'use client'

import { useState } from 'react'
import { PanelLeftOpen, PanelLeftClose, ChevronDown, ArrowLeft } from 'lucide-react'
import type { Consulta } from '@/types'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'

/**
 * La navegación entre consultas de la pestaña. §4 de la adenda.
 *
 * ⚠️ UN SOLO CONTROL POR VIEWPORT. En escritorio, el carril; en móvil, el
 * selector. **No hay «Consulta anterior» / «Consulta siguiente» en ninguno de
 * los dos**: el carril ya resuelve la navegación y esos enlaces competían con
 * la acción de imprimir. Si alguien los echa de menos, la respuesta es el
 * carril expandido.
 *
 * ⚠️ SIN BUSCADOR. Lo tenía el historial viejo y el spec base lo retira por
 * petición explícita.
 */

/** §11: 44 px colapsado, 230 px expandido. */
const ANCHO_COLAPSADO = 'w-[44px]'
const ANCHO_EXPANDIDO = 'w-[230px]'

/** Una línea con la fecha y el diagnóstico, que es lo que identifica la consulta. */
function resumenDe(c: Consulta): { fecha: string; diagnostico: string } {
  const dx = c.diagnosticos?.find(d => d.descripcion?.trim())
  const diagnostico = dx
    ? (dx.codigo_cie10 ? `${dx.codigo_cie10} · ${dx.descripcion}` : dx.descripcion)
    : c.motivo_consulta?.trim() || 'Consulta sin detalles'
  let fecha = '—'
  try {
    if (c.fecha && !Number.isNaN(new Date(c.fecha).getTime())) {
      fecha = renderEnTZ(c.fecha, 'd MMM yy', TZ_CLINICA)
    }
  } catch { /* fecha corrupta → guion, la consulta sigue navegable */ }
  return { fecha, diagnostico }
}

/** El renglón del carril expandido y de la lista de móvil: misma información. */
function Renglon({ consulta, activa, onSelect }: {
  consulta: Consulta
  activa: boolean
  onSelect: () => void
}) {
  const { fecha, diagnostico } = resumenDe(consulta)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={activa ? 'true' : undefined}
      className="flex w-full flex-col gap-[2px] border-l-[var(--sp-bw-bar)] px-[12px] py-[10px] text-left transition-colors"
      style={activa
        ? { borderLeftColor: 'var(--sp-primary)', background: 'var(--sp-primary-bg-faint)' }
        : { borderLeftColor: 'transparent' }}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {fecha}
      </span>
      {/* Una línea con elipsis: las descripciones CIE-10 pasan de cien caracteres. */}
      <span
        className="truncate text-[length:var(--sp-fs-label)] font-semibold"
        style={{ color: activa ? 'var(--sp-ink-800)' : 'var(--sp-ink-600)' }}
      >
        {diagnostico}
      </span>
    </button>
  )
}

/** Pie del carril: lo que hay y lo que no cabe. */
function PieConteo({ mostradas, total }: { mostradas: number; total: number | undefined }) {
  /* ⚠️ NO ES UN «CARGAR N MÁS», Y ES DELIBERADO. El spec lo pide, pero la
     pestaña trae las consultas acotadas a 50 —el tope que la vista conserva—,
     así que un botón ahí no tendría de dónde traer nada. Mismo criterio que la
     línea de tiempo del Resumen: se dice qué falta, sin fingir una acción. */
  if (total === undefined || total <= mostradas) return null
  return (
    <p className="border-t border-[color:var(--sp-line-divider)] px-[12px] py-[var(--sp-2)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
      Mostrando {mostradas} de {total}
    </p>
  )
}

export default function CarrilConsultas({
  consultas, total, activaId, onSelect, expandido, onToggleExpandido,
}: {
  consultas: Consulta[]
  /** El conteo REAL; `consultas` viene acotado a 50. */
  total: number | undefined
  activaId: string | null
  onSelect: (id: string) => void
  expandido: boolean
  onToggleExpandido: () => void
}) {
  /** La lista completa de móvil se abre como vista propia con retorno. */
  const [listaMovil, setListaMovil] = useState(false)

  const indiceActiva = consultas.findIndex(c => c.id === activaId)
  const activa = indiceActiva >= 0 ? consultas[indiceActiva] : null

  /* ── Móvil: el selector es el único control ───────────────────────── */
  const selectorMovil = activa && (() => {
    const { fecha, diagnostico } = resumenDe(activa)
    return (
      <button
        type="button"
        onClick={() => setListaMovil(true)}
        className="flex w-full items-center gap-[var(--sp-2-5)] rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[13px] py-[11px] text-left lg:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
            Consulta {indiceActiva + 1} de {total ?? consultas.length}
          </span>
          <span className="block truncate text-[13.5px] font-semibold text-[var(--sp-ink-800)]">
            {fecha} · {diagnostico}
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-[var(--sp-ink-icon)]" />
      </button>
    )
  })()

  const vistaListaMovil = listaMovil && (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setListaMovil(false)}
        className="inline-flex items-center gap-[var(--sp-1)] pb-[var(--sp-2-5)] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-ink-500)]"
      >
        <ArrowLeft size={13} /> Volver a la nota
      </button>
      <div className="overflow-hidden rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)]">
        {consultas.map(c => (
          <Renglon
            key={c.id}
            consulta={c}
            activa={c.id === activaId}
            onSelect={() => { onSelect(c.id); setListaMovil(false) }}
          />
        ))}
        <PieConteo mostradas={consultas.length} total={total} />
      </div>
    </div>
  )

  /* ── Escritorio: el carril es el único control ────────────────────── */
  return (
    <>
      {listaMovil ? vistaListaMovil : selectorMovil}

      <aside
        className={`hidden shrink-0 self-start overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:block ${expandido ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO}`}
      >
        {/* Encabezado fijo con el conteo y el control de plegar. Colapsado, el
            conteo no cabe al lado del botón y se va debajo. */}
        <div className={`border-b border-[color:var(--sp-line-divider)] ${expandido ? 'flex items-center justify-between gap-[var(--sp-2)] px-[12px] py-[var(--sp-2)]' : 'flex flex-col items-center gap-[2px] py-[var(--sp-2)]'}`}>
          {expandido && (
            <span className="text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
              {total ?? consultas.length} consultas
            </span>
          )}
          <button
            type="button"
            onClick={onToggleExpandido}
            aria-expanded={expandido}
            aria-label={expandido ? 'Colapsar el carril de consultas' : 'Expandir el carril de consultas'}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-[var(--sp-r-btn-sm)] text-[var(--sp-ink-icon)] transition-colors hover:bg-[var(--sp-surface-muted)] hover:text-[var(--sp-ink-700)]"
          >
            {expandido ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          {!expandido && (
            <span className="text-[length:var(--sp-fs-legal)] font-bold tabular-nums text-[var(--sp-ink-350)]">
              {total ?? consultas.length}
            </span>
          )}
        </div>

        {expandido ? (
          /* Alto tope con desplazamiento propio: la lista no alarga la página. */
          <div className="max-h-[560px] overflow-y-auto">
            {consultas.map(c => (
              <Renglon key={c.id} consulta={c} activa={c.id === activaId} onSelect={() => onSelect(c.id)} />
            ))}
            <PieConteo mostradas={consultas.length} total={total} />
          </div>
        ) : (
          /* Colapsado: una marca por consulta, en orden cronológico inverso —el
             mismo en que llegan—. La activa, más larga y en acento. Cada marca
             revela su fecha al pasar el cursor, que es todo lo que cabe decir
             en 44 px. */
          <div className="flex max-h-[560px] flex-col items-center gap-[var(--sp-2)] overflow-y-auto py-[var(--sp-3)]">
            {consultas.map(c => {
              const esActiva = c.id === activaId
              const { fecha, diagnostico } = resumenDe(c)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  title={`${fecha} · ${diagnostico}`}
                  aria-current={esActiva ? 'true' : undefined}
                  aria-label={`${fecha} · ${diagnostico}`}
                  className="h-[3px] shrink-0 rounded-[var(--sp-r-pill)] transition-all"
                  style={{
                    width: esActiva ? '20px' : '12px',
                    background: esActiva ? 'var(--sp-primary)' : 'var(--sp-ink-150)',
                  }}
                />
              )
            })}
          </div>
        )}
      </aside>
    </>
  )
}
