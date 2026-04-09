'use client'

import { useCallback, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import type { ChangeEvent, ReactElement } from 'react'
import PageHeader from '@/components/super-admin/PageHeader'
import { LoadingView, ErrorView } from '@/components/super-admin/StateView'
import { useAsyncResource } from '@/hooks/useAsyncResource'
import {
  auditLogResponseSchema,
  type AuditLogEntry,
  type AuditLogResponse,
} from '@/lib/super-admin/types'

interface Filters {
  q: string
  accion: string
  fechaDesde: string
  fechaHasta: string
  page: number
}

const FILTROS_INIT: Filters = { q: '', accion: '', fechaDesde: '', fechaHasta: '', page: 1 }

function buildUrl(f: Filters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.accion) p.set('accion', f.accion)
  if (f.fechaDesde) p.set('fechaDesde', f.fechaDesde)
  if (f.fechaHasta) p.set('fechaHasta', f.fechaHasta)
  p.set('page', String(f.page))
  return `/api/super-admin/dashboard/audit?${p.toString()}`
}

function buildCsvUrl(f: Filters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.accion) p.set('accion', f.accion)
  if (f.fechaDesde) p.set('fechaDesde', f.fechaDesde)
  if (f.fechaHasta) p.set('fechaHasta', f.fechaHasta)
  p.set('format', 'csv')
  return `/api/super-admin/dashboard/audit?${p.toString()}`
}

export default function AuditPage(): ReactElement {
  const [filters, setFilters] = useState<Filters>(FILTROS_INIT)
  const [draftQ, setDraftQ] = useState('')
  const [draftAccion, setDraftAccion] = useState('')
  const [draftDesde, setDraftDesde] = useState('')
  const [draftHasta, setDraftHasta] = useState('')

  const fetcher = useCallback(async (): Promise<AuditLogResponse> => {
    const res = await fetch(buildUrl(filters), { cache: 'no-store' })
    const json: unknown = await res.json()
    if (!res.ok) {
      const err =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: unknown }).error)
          : 'Error del servidor'
      throw new Error(err)
    }
    const parsed = auditLogResponseSchema.safeParse(json)
    if (!parsed.success) throw new Error('Respuesta inválida del servidor')
    return parsed.data
  }, [filters])

  const { state, reload } = useAsyncResource<AuditLogResponse>(fetcher, [filters])
  const handleReload = useCallback((): void => reload(), [reload])

  function applyFilters(): void {
    setFilters({ q: draftQ, accion: draftAccion, fechaDesde: draftDesde, fechaHasta: draftHasta, page: 1 })
  }

  function changePage(delta: number): void {
    setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page + delta) }))
  }

  const totalPages = state.status === 'success' ? state.data.totalPages : 1
  const currentPage = filters.page

  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Audit log"
        subtitle="Registro inmutable de acciones del sistema"
        actions={
          <div className="flex items-center gap-2">
            <a
              href={buildCsvUrl(filters)}
              download
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Download size={13} />
              Exportar CSV
            </a>
            <button
              type="button"
              onClick={handleReload}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <RefreshCw size={13} className={state.status === 'loading' ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-slate-500" />
          <span className="text-[12px] font-medium text-slate-400">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por usuario / descripción"
            value={draftQ}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftQ(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#1e5fa8]"
          />
          <input
            type="text"
            placeholder="Acción exacta (ej. ver_expediente)"
            value={draftAccion}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftAccion(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#1e5fa8]"
          />
          <input
            type="date"
            value={draftDesde}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftDesde(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-400 focus:outline-none focus:border-[#1e5fa8]"
          />
          <input
            type="date"
            value={draftHasta}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftHasta(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12.5px] text-slate-400 focus:outline-none focus:border-[#1e5fa8]"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-medium px-4 py-1.5 rounded-lg bg-[#1e5fa8] hover:bg-[#1a4f8f] text-white transition-colors"
        >
          Aplicar filtros
        </button>
      </div>

      {state.status === 'loading' || state.status === 'idle' ? (
        <LoadingView label="Cargando audit log..." />
      ) : state.status === 'error' ? (
        <ErrorView message={state.message} onRetry={handleReload} />
      ) : (
        <>
          <AuditTable items={state.data.items} total={state.data.total} />
          {/* Paginación */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px] text-slate-500">
              {state.data.total.toLocaleString('es-MX')} registros totales
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(-1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] text-slate-400 tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => changePage(1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AuditTable({
  items,
  total,
}: {
  items: ReadonlyArray<AuditLogEntry>
  total: number
}): ReactElement {
  if (items.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
        <ScrollText size={28} className="text-slate-700" />
        <p className="text-[13px] text-slate-500">No hay registros que coincidan con los filtros.</p>
      </div>
    )
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
        <ScrollText size={14} className="text-[#1e5fa8]" />
        <h3 className="text-[14px] font-semibold text-slate-100">Entradas recientes</h3>
        <span className="text-[11px] text-slate-500 ml-auto">
          {total.toLocaleString('es-MX')} total
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
              <th className="text-left font-semibold px-4 py-3">Fecha</th>
              <th className="text-left font-semibold px-3 py-3">Usuario</th>
              <th className="text-left font-semibold px-3 py-3">Acción</th>
              <th className="text-left font-semibold px-3 py-3">Tabla / ID</th>
              <th className="text-left font-semibold px-3 py-3">IP</th>
              <th className="text-left font-semibold px-3 py-3">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }): ReactElement {
  const fecha = new Date(entry.createdAtIso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const isSa = entry.accion.startsWith('sa_')
  const isError = entry.accion.startsWith('error_') || entry.accion === 'acceso_denegado'

  return (
    <tr className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fecha}</td>
      <td className="px-3 py-2.5">
        <div className="text-slate-200 truncate max-w-[140px]">
          {entry.userNombre ?? entry.userId.slice(0, 8) + '…'}
        </div>
        <div className="text-[10px] text-slate-600 font-mono truncate max-w-[140px]">
          {entry.userId}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
            isError
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : isSa
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                : 'bg-slate-700/40 text-slate-300 border-slate-600'
          }`}
        >
          {entry.accion}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-500 font-mono text-[10.5px]">
        {entry.tabla ? (
          <span>
            {entry.tabla}
            {entry.registroId ? (
              <span className="block text-[9.5px] text-slate-700 truncate max-w-[100px]">
                {entry.registroId}
              </span>
            ) : null}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-500 font-mono text-[10.5px] whitespace-nowrap">
        {entry.ip ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-slate-400 max-w-[200px] truncate">
        {entry.descripcion ?? '—'}
      </td>
    </tr>
  )
}
