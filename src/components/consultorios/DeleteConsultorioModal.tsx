'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  consultorio: Consultorio
  onEditarEnLugar: () => void
  onConfirmDelete: () => Promise<void>
}

export default function DeleteConsultorioModal({
  open,
  onClose,
  consultorio,
  onEditarEnLugar,
  onConfirmDelete,
}: Props) {
  const [deleting, setDeleting] = useState(false)

  // Resetear estado al abrir
  useEffect(() => {
    if (open) {
      setDeleting(false)
    }
  }, [open])

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onConfirmDelete()
      // Si onConfirmDelete tuvo éxito, el padre se encarga de cerrar el modal
      // y de actualizar la lista. No llamamos onClose() aquí para evitar doble cierre.
    } catch {
      // Si falla, el padre debe haber mostrado el toast de error; mantenemos el modal abierto
      setDeleting(false)
    }
  }

  const handleEditarEnLugar = () => {
    if (deleting) return
    onEditarEnLugar()
  }

  return (
    <ModalShell
      open={open}
      onClose={deleting ? () => {} : onClose}
      title="Borrar consultorio"
      subtitle={consultorio.nombre}
      icon={<Trash2 size={18} className="text-red-600" />}
      iconBg="bg-red-50"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-3.5">
          <button
            type="button"
            onClick={deleting ? undefined : onClose}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEditarEnLugar}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--cp)] bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Editar en lugar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Borrando…' : 'Sí, borrar'}
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 space-y-3">
        <p className="text-sm text-slate-700">
          ¿Estás seguro de que quieres borrar este consultorio?
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{consultorio.nombre}</p>
          <p className="text-xs text-slate-500">{consultorio.direccion}</p>
          {consultorio.telefono && (
            <p className="text-xs text-slate-500">{consultorio.telefono}</p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Las citas y consultas pasadas se conservan, pero el consultorio ya no estará disponible para nuevas citas. Esta acción no es reversible desde la app.
        </p>
      </div>
    </ModalShell>
  )
}
