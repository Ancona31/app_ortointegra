'use client'

/**
 * src/components/agenda/ConfirmModal.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.3, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { useId } from 'react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'

/* ─── Modal de confirmación genérico ───────────────────── */

export default function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { montarPanel, alPulsarTecla } = useDialogoModal(onCancel)
  const mensajeId = useId()
  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      {/* ⚠️ `aria-alertdialog` NO: el rol correcto para una confirmación es
          `alertdialog`, pero exige `aria-describedby` apuntando al mensaje y
          `role="dialog"` con el mensaje como NOMBRE hace exactamente lo que
          aquí se necesita —el lector lee la pregunta al abrir— con una pieza
          menos. El texto es corto y es lo único que hay dentro. */}
      <div
        ref={montarPanel}
        onKeyDown={alPulsarTecla}
        role="dialog"
        aria-modal="true"
        aria-labelledby={mensajeId}
        tabIndex={-1}
        className="relative focus:outline-none bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter p-6"
      >
        <p id={mensajeId} className="text-sm text-[#1d1d1f] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
