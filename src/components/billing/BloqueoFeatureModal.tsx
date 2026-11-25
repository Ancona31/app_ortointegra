'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { canManageClinica } from '@/lib/permissions'
import type { Role } from '@/hooks/useProfile'

type Props = {
  isOpen: boolean
  onClose: () => void
  role: string
  esAdminDeClinica: boolean
}

export default function BloqueoFeatureModal({ isOpen, onClose, role, esAdminDeClinica }: Props) {
  const router = useRouter()
  const isAdmin = canManageClinica({ role: role as Role, es_admin_de_clinica: esAdminDeClinica })

  function handleReactivar() {
    onClose()
    router.push('/billing')
  }

  /* Alerta de aviso del catálogo (CALMA §13). Rol `dialog` y no
     `alertdialog`: así la nombra la e2e `agenda-f-burbuja`. «Reactivar
     suscripción» no cabe en media alerta: con él, los botones van apilados y
     el principal arriba (§23.3), sin acortar el rótulo. */
  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Función no disponible"
      subtitle="Suscripción terminada"
      icon={<AlertCircle aria-hidden="true" />}
      variante="alerta"
      tono="avisar"
      rol="dialog"
      apilada={isAdmin}
      elevated
      footer={
        <>
          <button type="button" onClick={onClose} className="k-b k-b-capa k-b-quieto">
            Cerrar
          </button>
          {isAdmin && (
            <button type="button" autoFocus data-principal onClick={handleReactivar} className="k-b k-b-capa k-b-prim">
              Reactivar suscripción
            </button>
          )}
        </>
      }
    >
      <p>
        Esta es una característica disponible para suscripciones activas.
        Tu cuenta excedió el límite del plan gratuito.
      </p>
      {!isAdmin && (
        <p>
          Pídele a tu administrador que reactive la suscripción para
          recuperar el acceso completo.
        </p>
      )}
    </ModalShell>
  )
}
