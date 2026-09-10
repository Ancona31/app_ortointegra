'use client'

import { useState } from 'react'
import { ChevronDown, ArrowLeft } from 'lucide-react'
import type { Documento } from '@/types'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { metaDe, tituloDe, TIPOS_DEL_CARRIL, type TipoDocumentoBD } from '@/lib/documentos/familias'
import { TIPOS_DOCUMENTO } from '@/components/documentos/SelectorTipoDocumento'

/**
 * El listado de la pestaña, convertido en carril (§8 del spec).
 *
 * ⚠️ UN SOLO CONTROL POR VIEWPORT: el carril en escritorio, el selector en
 * móvil. Sin botones de anterior y siguiente, y nunca un modal flotante.
 *
 * ⚠️ SIN BÚSQUEDA DE TEXTO. El filtro es POR TIPO, que es la operación real: el
 * médico busca «la receta», no una palabra.
 */

/** §15: 236 px de ancho, alto tope 640 px. */
const ANCHO = 'w-[236px]'

/** Rótulo corto del tipo para el chip. Sale del catálogo, que es quien lo nombra. */
function rotuloTipo(tipo: string): string {
  const clave = metaDe(tipo).claveCatalogo
  const cat = clave ? TIPOS_DOCUMENTO.find(t => t.key === clave) : undefined
  return cat?.label ?? metaDe(tipo).titulo
}

/**
 * ⚠️ EL COLOR SALE DE LA CLAVE DEL CATÁLOGO, NO DE `documentos.tipo`. Los dos
 * solo coinciden en «receta»: sin traducir, siete de los ocho chips saldrían en
 * blanco. La traducción vive en `familias.ts`.
 */
function colorTipo(tipo: string): string {
  const clave = metaDe(tipo).claveCatalogo
  const cat = clave ? TIPOS_DOCUMENTO.find(t => t.key === clave) : undefined
  return cat ? `var(--sp-doc-${cat.token})` : 'var(--sp-ink-350)'
}

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try { return renderEnTZ(iso, 'd MMM yy', TZ_CLINICA) } catch { return '—' }
}

/** La referencia de una línea: lo que distingue este documento de otro igual. */
function referenciaDe(doc: Documento): string {
  const c = (doc.contenido ?? {}) as Record<string, unknown>
  for (const v of [c.diagnostico, c.asunto, c.procedimiento, c.motivo, doc.nombre_original]) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return tituloDe(doc.tipo, c)
}

function ChipTipo({ tipo }: { tipo: string }) {
  const color = colorTipo(tipo)
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-[var(--sp-r-pill)] px-[7px] py-[2px] text-[10.5px] font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--sp-surface))` }}
    >
      {rotuloTipo(tipo)}
    </span>
  )
}

function Renglon({ doc, activo, onSelect }: { doc: Documento; activo: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={activo ? 'true' : undefined}
      className="flex w-full flex-col gap-[3px] border-l-[var(--sp-bw-bar)] px-[12px] py-[11px] text-left transition-colors"
      style={activo
        ? { borderLeftColor: 'var(--sp-primary)', background: 'var(--sp-primary-bg-faint)' }
        : { borderLeftColor: 'transparent' }}
    >
      <span className="flex items-center gap-[var(--sp-1-5)]">
        <ChipTipo tipo={doc.tipo} />
        <span className="shrink-0 text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">{fechaCorta(doc.created_at)}</span>
      </span>
      {/* Una línea con elipsis: los diagnósticos CIE-10 pasan de cien caracteres. */}
      <span
        className="truncate text-[length:var(--sp-fs-label)] font-semibold"
        style={{ color: activo ? 'var(--sp-ink-800)' : 'var(--sp-ink-600)' }}
      >
        {referenciaDe(doc)}
      </span>
    </button>
  )
}

/** Lo que hay y lo que no cabe. NO es un «cargar más»: el tope de 50 se mantiene. */
function PieConteo({ mostrados, total }: { mostrados: number; total: number | undefined }) {
  if (total === undefined || total <= mostrados) return null
  return (
    <p className="border-t border-[color:var(--sp-line-divider)] px-[12px] py-[var(--sp-2)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
      Mostrando {mostrados} de {total}
    </p>
  )
}

export default function CarrilDocumentos({
  documentos, total, activoId, onSelect, filtro, onFiltrar,
}: {
  /** Ya filtrados los que esta pestaña no lista. */
  documentos: Documento[]
  total: number | undefined
  activoId: string | null
  onSelect: (id: string) => void
  filtro: TipoDocumentoBD | 'todos'
  onFiltrar: (t: TipoDocumentoBD | 'todos') => void
}) {
  const [listaMovil, setListaMovil] = useState(false)

  const visibles = filtro === 'todos' ? documentos : documentos.filter(d => d.tipo === filtro)
  const indice = visibles.findIndex(d => d.id === activoId)
  /* ⚠️ EL ABIERTO SE BUSCA EN LA LISTA COMPLETA CUANDO EL FILTRO LO EXCLUYE, y
     no es un detalle: aquí decía `indice >= 0 ? visibles[indice] : null`, o sea
     que al filtrar por un tipo distinto del documento abierto `activo` caía a
     `null` y con él DESAPARECÍA EL CONTROL DE MÓVIL de abajo — que es la única
     puerta a la lista y al selector de filtro, porque los dos viven dentro de
     él. Camino real: abrir la lista, filtrar por otro tipo, «Volver al
     documento», y quedarse sin forma de volver a abrirla.
     El visor sigue enseñando ese documento —el filtro filtra la LISTA, no lo
     que se está leyendo—, así que su control tiene que seguir ahí. */
  const activo = indice >= 0 ? visibles[indice] : (documentos.find(d => d.id === activoId) ?? null)

  /* El selector presenta «Todos los tipos» más los ocho del catálogo EN SU
     ORDEN FIJO, cada uno con su conteo, y los conteos salen de lo cargado. */
  const opciones = [
    { valor: 'todos' as const, rotulo: 'Todos los tipos', n: documentos.length },
    ...TIPOS_DEL_CARRIL.map(t => ({
      valor: t,
      rotulo: rotuloTipo(t),
      n: documentos.filter(d => d.tipo === t).length,
    })),
  ]

  const selector = (
    <select
      value={filtro}
      onChange={e => onFiltrar(e.target.value as TipoDocumentoBD | 'todos')}
      aria-label="Filtrar documentos por tipo"
      className="h-[36px] w-full rounded-[var(--sp-r-field-sm)] border border-[color:var(--sp-line-control)] bg-[var(--sp-surface)] px-[var(--sp-2)] text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-700)]"
    >
      {opciones.map(o => (
        <option key={o.valor} value={o.valor}>{o.rotulo} ({o.n})</option>
      ))}
    </select>
  )

  const lista = (
    <>
      {visibles.map(d => (
        <Renglon key={d.id} doc={d} activo={d.id === activoId} onSelect={() => { onSelect(d.id); setListaMovil(false) }} />
      ))}
      {visibles.length === 0 && (
        <p className="px-[12px] py-[var(--sp-5)] text-center text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
          Sin documentos de este tipo.
        </p>
      )}
      <PieConteo mostrados={documentos.length} total={total} />
    </>
  )

  return (
    <>
      {/* ── Móvil ───────────────────────────────────────────────────────── */}
      {listaMovil ? (
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setListaMovil(false)}
            className="inline-flex items-center gap-[var(--sp-1)] pb-[var(--sp-2-5)] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-ink-500)]"
          >
            <ArrowLeft size={13} /> Volver al documento
          </button>
          <div className="mb-[var(--sp-2-5)]">{selector}</div>
          <div className="max-h-[440px] overflow-y-auto rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)]">
            {lista}
          </div>
        </div>
      ) : activo ? (
        <button
          type="button"
          onClick={() => setListaMovil(true)}
          className="flex w-full items-center gap-[var(--sp-2-5)] rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[13px] py-[11px] text-left lg:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
              {/* Con el abierto fuera del filtro no hay posición que contar, y
                  `indice + 1` habría escrito «Documento 0 de 87». */}
              {indice >= 0 ? `Documento ${indice + 1} de ${visibles.length}` : 'Fuera del filtro actual'}
            </span>
            <span className="mt-[2px] flex items-center gap-[var(--sp-1-5)]">
              <ChipTipo tipo={activo.tipo} />
              <span className="truncate text-[13.5px] font-semibold text-[var(--sp-ink-800)]">
                {fechaCorta(activo.created_at)}
              </span>
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-[var(--sp-ink-icon)]" />
        </button>
      ) : null}

      {/* ── Escritorio ──────────────────────────────────────────────────── */}
      <aside className={`hidden shrink-0 self-start overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:flex lg:max-h-[640px] lg:flex-col ${ANCHO}`}>
        {/* Encabezado fijo con el conteo y el selector de tipo. Va `shrink-0`
            fuera del área que desplaza, así que no puede quedar tapado. */}
        <div className="shrink-0 border-b border-[color:var(--sp-line-divider)] px-[12px] py-[var(--sp-2-5)]">
          <p className="mb-[var(--sp-2)] text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
            {total ?? documentos.length} documentos
          </p>
          {selector}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{lista}</div>
      </aside>
    </>
  )
}
