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

  /* Rediseño B10: alerta destructiva del catálogo (CALMA §13). Son TRES
     salidas con los rótulos de hoy, así que van apiladas con el principal
     («Sí, borrar») arriba (§23.3). El foco entra en «Cancelar»: la alerta
     destruye (capas-a, vista 1). */
  return (
    <ModalShell
      open={open}
      onClose={deleting ? () => {} : onClose}
      title="Borrar consultorio"
      subtitle={consultorio.nombre}
      icon={<Trash2 aria-hidden="true" />}
      variante="alerta"
      tono="destruir"
      apilada
      footer={
        <>
          <button
            type="button"
            onClick={handleEditarEnLugar}
            disabled={deleting}
            className="k-b k-b-capa k-b-tonal"
          >
            Editar en lugar
          </button>
          <button
            type="button"
            autoFocus
            onClick={deleting ? undefined : onClose}
            disabled={deleting}
            className="k-b k-b-capa k-b-quieto"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-principal
            onClick={handleDelete}
            disabled={deleting}
            className="k-b k-b-capa k-b-mal"
          >
            {deleting ? 'Borrando…' : 'Sí, borrar'}
          </button>
        </>
      }
    >
      <p>¿Estás seguro de que quieres borrar este consultorio?</p>
      <div className="rounded-[12px] bg-fondo px-4 py-3 text-left" style={{ textAlignLast: 'left' }}>
        <p className="text-[15px] font-semibold leading-5 text-tinta">{consultorio.nombre}</p>
        <p className="text-[13px] leading-[18px] text-tinta2">{consultorio.direccion}</p>
        {consultorio.telefono && (
          <p className="text-[13px] leading-[18px] text-tinta2">{consultorio.telefono}</p>
        )}
      </div>
      <p>
        Las citas y consultas pasadas se conservan, pero el consultorio ya no estará disponible para nuevas citas. Esta acción no es reversible desde la app.
      </p>
    </ModalShell>
  )
}
