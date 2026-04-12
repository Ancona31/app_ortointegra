'use client'

/**
 * DeadLetterDrawer — UI para gestionar items fallidos permanentemente.
 *
 * Muestra una lista de items de la Dead Letter Queue (DLQ) del
 * outbox-engine. Cada item incluye tipo, fecha, status HTTP, error
 * message. Permite:
 *   - Reintentar individual (vuelve a pending con retries=0)
 *   - Descartar individual (con confirmación)
 *   - Descartar todos (con doble confirmación)
 *
 * Diseño:
 *   - Drawer modal slide-in desde la derecha
 *   - Backdrop clickeable
 *   - z-[70] backdrop / z-[71] drawer (arriba del ConnectionBanner z-[60])
 *   - Empty state amigable cuando no hay errores
 *   - role="dialog" + aria-label para accesibilidad
 */

import { useEffect, useState, useCallback } from 'react'
import { X, RotateCcw, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import {
  getDeadLetterQueue,
  retryDeadLetterItem,
  discardDeadLetterItem,
  clearDeadLetter,
  type DeadLetterItem,
} from '@/lib/outbox-engine'

interface Props {
  open: boolean
  onClose: () => void
}

function formatResource(item: DeadLetterItem): string {
  switch (item.resource) {
    case 'document':
      return `Documento · ${item.subtype ?? 'sin tipo'}`
    case 'note':
      return 'Nota clínica'
    case 'patient':
      return 'Paciente'
    case 'appointment':
      return 'Cita'
    default:
      return 'Item desconocido'
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function DeadLetterDrawer({ open, onClose }: Props) {
  const [items, setItems] = useState<DeadLetterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getDeadLetterQueue()
      // Orden: más recientes primero
      const sorted = [...list].sort(
        (a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime(),
      )
      setItems(sorted)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()
  }, [open, refresh])

  async function handleRetry(itemId: string) {
    setActioningId(itemId)
    try {
      await retryDeadLetterItem(itemId)
      await refresh()
    } finally {
      setActioningId(null)
    }
  }

  async function handleDiscard(itemId: string) {
    if (!confirm('¿Descartar este item permanentemente? Esta acción no se puede deshacer.')) return
    setActioningId(itemId)
    try {
      await discardDeadLetterItem(itemId)
      await refresh()
    } finally {
      setActioningId(null)
    }
  }

  async function handleDiscardAll() {
    if (items.length === 0) return
    const first = confirm(
      `¿Descartar TODOS los ${items.length} items con error?\n\nEsta acción NO se puede deshacer y perderás los datos permanentemente.`,
    )
    if (!first) return
    const second = confirm('Confirmación final: ¿estás completamente seguro?')
    if (!second) return
    setLoading(true)
    try {
      await clearDeadLetter()
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer slide-in */}
      <div
        role="dialog"
        aria-label="Errores de sincronización"
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[71] flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Errores de sincronización</h2>
              <p className="text-[11px] text-slate-500">
                {items.length === 0
                  ? 'Sin errores pendientes'
                  : `${items.length} item${items.length > 1 ? 's' : ''} con error permanente`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <AlertCircle size={20} className="text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Sin errores</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Todos los datos se sincronizaron correctamente o están pendientes en la outbox.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map(item => (
                <li key={item.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">
                        {formatResource(item)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Falló el {formatDate(item.failedAt)}
                      </p>
                    </div>
                    {item.httpStatus && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                        HTTP {item.httpStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono leading-relaxed break-words">
                    {item.finalError.slice(0, 200)}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleRetry(item.id)}
                      disabled={actioningId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#1e5fa8] bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw size={12} />
                      Reintentar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiscard(item.id)}
                      disabled={actioningId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={12} />
                      Descartar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer: Descartar todos */}
        {items.length > 0 && (
          <div className="border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleDiscardAll}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={13} />
              Descartar todos ({items.length})
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Acción irreversible. Requiere doble confirmación.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
