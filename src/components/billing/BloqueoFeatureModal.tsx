'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'

type Props = {
  isOpen: boolean
  onClose: () => void
  role: string
}

const ADMIN_ROLES = ['admin', 'super_admin'] as const

export default function BloqueoFeatureModal({ isOpen, onClose, role }: Props) {
  const router = useRouter()
  const isAdmin = ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])

  function handleReactivar() {
    onClose()
    router.push('/billing')
  }

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Función no disponible"
      subtitle="Suscripción terminada"
      icon={<AlertCircle size={16} className="text-amber-600" />}
      iconBg="bg-amber-50"
      maxWidth="max-w-md"
      elevated
      footer={
        <div className="flex justify-end gap-2 px-5 py-3.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
          {isAdmin && (
            <button
              onClick={handleReactivar}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              Reactivar suscripción
            </button>
          )}
        </div>
      }
    >
      <div className="px-5 py-5 space-y-3">
        <p className="text-sm text-[#1d1d1f] leading-relaxed">
          Esta es una característica disponible para suscripciones activas.
          Tu cuenta excedió el límite del plan gratuito.
        </p>
        {!isAdmin && (
          <p className="text-sm text-[#86868b] leading-relaxed">
            Pídele a tu administrador que reactive la suscripción para
            recuperar el acceso completo.
          </p>
        )}
      </div>
    </ModalShell>
  )
}
