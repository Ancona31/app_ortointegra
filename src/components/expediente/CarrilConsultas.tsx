'use client'

import { useState } from 'react'
import { PanelLeftOpen, PanelLeftClose, ChevronDown, ChevronLeft } from 'lucide-react'
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

/** El renglón del carril expandido y de la lista de móvil: misma información.
 *  Rediseño B7: el diagnóstico (15/600) arriba y la fecha debajo; la activa,
 *  con fondo tonal (maqueta `final-expediente`). */
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
      className={`flex min-h-[52px] w-full flex-col justify-center gap-0.5 rounded-[10px] px-3 py-2 text-left transition-opacity active:opacity-70 ${activa ? 'bg-tonal' : 'hover:bg-sup2'}`}
    >
      {/* Dos líneas como mucho: las descripciones CIE-10 pasan de cien caracteres. */}
      <span className={`line-clamp-2 text-[15px] font-semibold leading-5 ${activa ? 'text-tonal-tinta' : 'text-tinta'}`}>
        {diagnostico}
      </span>
      <span className={`k-num text-[13px] leading-[18px] ${activa ? 'text-tonal-tinta' : 'text-tinta2'}`}>{fecha}</span>
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
    <p className="k-t-sec border-t border-linea px-3 py-2">
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
        className="flex min-h-[56px] w-full items-center gap-3 rounded-[var(--r-tarjeta)] bg-sup px-4 py-2.5 text-left transition-opacity active:opacity-70 lg:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-[18px] text-tinta2">
            Consulta {indiceActiva + 1} de {total ?? consultas.length}
          </span>
          <span className="block truncate text-[15px] font-semibold leading-5 text-tinta">
            {fecha} · {diagnostico}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-tinta2" />
      </button>
    )
  })()

  const vistaListaMovil = listaMovil && (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setListaMovil(false)}
        className="k-b k-b-texto -ml-1 mb-2 h-[var(--k-toque)] text-[13px]"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Volver a la nota
      </button>
      <div className="flex flex-col gap-0.5 rounded-[var(--r-tarjeta)] bg-sup p-2">
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
        className={`hidden shrink-0 self-start overflow-hidden rounded-[var(--r-tarjeta-ancha)] bg-sup lg:block ${expandido ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO}`}
      >
        {/* Encabezado fijo con el conteo y el control de plegar. Colapsado, el
            conteo no cabe al lado del botón y se va debajo. */}
        <div className={`${expandido ? 'flex items-center justify-between gap-2 py-1 pl-4 pr-1' : 'flex flex-col items-center gap-0.5 py-1'}`}>
          {expandido && (
            <span className="k-t-sec k-num">
              {total ?? consultas.length} consultas
            </span>
          )}
          <button
            type="button"
            onClick={onToggleExpandido}
            aria-expanded={expandido}
            aria-label={expandido ? 'Colapsar el carril de consultas' : 'Expandir el carril de consultas'}
            className="k-b k-b-icono"
          >
            {expandido ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
          </button>
          {!expandido && (
            <span className="k-num text-[13px] text-tinta2">
              {total ?? consultas.length}
            </span>
          )}
        </div>

        {expandido ? (
          /* Alto tope con desplazamiento propio: la lista no alarga la página. */
          <div className="flex max-h-[560px] flex-col gap-0.5 overflow-y-auto px-2 pb-2">
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
          <div className="flex max-h-[560px] flex-col items-center overflow-y-auto pb-2">
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
                  /* El área es la fila entera de 36 px (toque de esc); la marca, la raya de dentro. */
                  className="flex h-9 w-full shrink-0 items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-[3px] rounded-full ${esActiva ? 'w-[20px] bg-accion' : 'w-[12px] bg-tinta3'}`}
                  />
                </button>
              )
            })}
          </div>
        )}
      </aside>
    </>
  )
}
