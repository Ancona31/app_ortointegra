'use client'

import { useState } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'
import type { Documento } from '@/types'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { metaDe, tituloDe, TIPOS_DEL_CARRIL, type TipoDocumentoBD } from '@/lib/documentos/familias'
import { TIPOS_DOCUMENTO } from '@/components/documentos/SelectorTipoDocumento'
import { estadoBorrador } from '@/components/documentos/consentimientoEmbudo'

/**
 * El listado de la pestaña, convertido en carril (§8 del spec).
 *
 * ⚠️ UN SOLO CONTROL POR VIEWPORT: el carril en escritorio, el selector en
 * móvil. Sin botones de anterior y siguiente, y nunca un modal flotante.
 *
 * ⚠️ SIN BÚSQUEDA DE TEXTO. El filtro es POR TIPO, que es la operación real: el
 * médico busca «la receta», no una palabra.
 */

/** §15 pedía 236 px; con el icono del tipo y la etiqueta, 272 (rediseño B7). Alto tope 640 px. */
const ANCHO = 'w-[272px]'

/** Rótulo corto del tipo para el chip. Sale del catálogo, que es quien lo nombra. */
function rotuloTipo(tipo: string): string {
  const clave = metaDe(tipo).claveCatalogo
  const cat = clave ? TIPOS_DOCUMENTO.find(t => t.key === clave) : undefined
  return cat?.label ?? metaDe(tipo).titulo
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

/** «Borrador» o «Urgente»: como mucho una etiqueta por fila (CALMA §3, §11). */
function EtiquetaEstado({ doc }: { doc: Documento }) {
  if (doc.estado === 'borrador') {
    /* Un consentimiento a medias dice QUÉ le falta («Falta firmar», «Faltan 2
       datos»), con la misma regla que su formulario: es lo que el médico viene
       a retomar. Los demás borradores, como siempre. */
    if (doc.tipo === 'consentimiento_informado') {
      return <span className="k-etq k-etq-aviso">{estadoBorrador(doc.contenido).etiqueta}</span>
    }
    return <span className="k-etq k-etq-aviso">Borrador</span>
  }
  if ((doc.contenido as Record<string, unknown> | null)?.urgente === true) return <span className="k-etq k-etq-mal">Urgente</span>
  return null
}

/** Rediseño B7: el icono del tipo en su color (CALMA §9), el tipo en 15/600 y
 *  «fecha · referencia» debajo; la activa con fondo tonal. */
function Renglon({ doc, activo, onSelect }: { doc: Documento; activo: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={activo ? 'true' : undefined}
      className={`flex min-h-[56px] w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left transition-opacity active:opacity-70 ${activo ? 'bg-tonal' : 'hover:bg-sup2'}`}
    >
      <IconoTipoDocumento tipo={doc.tipo} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-5 text-tinta">{rotuloTipo(doc.tipo)}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Una línea con elipsis: los diagnósticos CIE-10 pasan de cien caracteres. */}
          <span className="k-num min-w-0 max-w-full truncate text-[13px] leading-[18px] text-tinta2">
            {fechaCorta(doc.created_at)} · {referenciaDe(doc)}
          </span>
          <EtiquetaEstado doc={doc} />
        </span>
      </span>
    </button>
  )
}

/** Lo que hay y lo que no cabe. NO es un «cargar más»: el tope de 50 se mantiene. */
function PieConteo({ mostrados, total }: { mostrados: number; total: number | undefined }) {
  if (total === undefined || total <= mostrados) return null
  return (
    <p className="k-t-sec border-t border-linea px-3 py-2">
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
    /* El filtro como texto con su cheurón (maqueta): un `select` nativo sin
       caja, para conservar el teclado y la hoja del sistema en el teléfono. */
    <span className="relative inline-flex min-w-0 items-center">
      <select
        value={filtro}
        onChange={e => onFiltrar(e.target.value as TipoDocumentoBD | 'todos')}
        aria-label="Filtrar documentos por tipo"
        className="h-[var(--k-toque)] min-w-0 max-w-full cursor-pointer appearance-none truncate rounded-[var(--r-control)] bg-transparent py-0 pl-2 pr-7 text-right text-[14px] font-semibold text-tinta focus-visible:outline-2 focus-visible:outline-enlace"
      >
        {opciones.map(o => (
          <option key={o.valor} value={o.valor}>{o.rotulo} ({o.n})</option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-1 text-tinta2" />
    </span>
  )

  const lista = (
    <>
      {visibles.map(d => (
        <Renglon key={d.id} doc={d} activo={d.id === activoId} onSelect={() => { onSelect(d.id); setListaMovil(false) }} />
      ))}
      {visibles.length === 0 && (
        <p className="k-t-sec px-3 py-5 text-center">
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
            className="k-b k-b-texto -ml-1 mb-2 h-[var(--k-toque)] text-[13px]"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Volver al documento
          </button>
          <div className="mb-2 flex justify-end">{selector}</div>
          <div className="flex max-h-[440px] flex-col gap-0.5 overflow-y-auto rounded-[var(--r-tarjeta)] bg-sup p-2">
            {lista}
          </div>
        </div>
      ) : activo ? (
        <button
          type="button"
          onClick={() => setListaMovil(true)}
          className="flex min-h-[56px] w-full items-center gap-3 rounded-[var(--r-tarjeta)] bg-sup px-4 py-2.5 text-left transition-opacity active:opacity-70 lg:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] text-tinta2">
              {/* Con el abierto fuera del filtro no hay posición que contar, y
                  `indice + 1` habría escrito «Documento 0 de 87». */}
              {indice >= 0 ? `Documento ${indice + 1} de ${visibles.length}` : 'Fuera del filtro actual'}
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <IconoTipoDocumento tipo={activo.tipo} />
              <span className="truncate text-[15px] font-semibold leading-5 text-tinta">
                {rotuloTipo(activo.tipo)} · {fechaCorta(activo.created_at)}
              </span>
            </span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-tinta2" />
        </button>
      ) : null}

      {/* ── Escritorio ──────────────────────────────────────────────────── */}
      <aside className={`hidden shrink-0 self-start overflow-hidden rounded-[var(--r-tarjeta-ancha)] bg-sup lg:flex lg:max-h-[640px] lg:flex-col ${ANCHO}`}>
        {/* Encabezado fijo con el conteo y el selector de tipo. Va `shrink-0`
            fuera del área que desplaza, así que no puede quedar tapado. */}
        <div className="flex shrink-0 items-center justify-between gap-2 py-1 pl-4 pr-2">
          <p className="k-t-sec k-num shrink-0">
            {total ?? documentos.length} documentos
          </p>
          {selector}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">{lista}</div>
      </aside>
    </>
  )
}
