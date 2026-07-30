'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useSubscriptionGate } from './SubscriptionGateProvider'

type Props = {
  /**
   * Si true, en desktop (lg+) el banner se desplaza `lg:ml-64` para no
   * superponerse al sidebar fixed de (app)/layout.tsx (ancho 240px,
   * mismo offset que usa <main>). En launcher (sin sidebar) NO se pasa.
   */
  desktopSidebarOffset?: boolean
}

/**
 * SuscripcionBanner — banner sticky persistente cuando la suscripción
 * está cancelada, la clínica no es VIP y tiene >5 pacientes activos.
 * Aparece en todas las páginas autenticadas de (app)/* y en (launcher)/inicio.
 *
 * Política Fase 8.1/8.2:
 *   - Solo se muestra a ex-clientes pagados (>5 pacientes activos).
 *     Free de buena fe (≤5 pacientes) NO ve el banner.
 *   - Pacientes existentes: lectura/edición permitida.
 *   - Crear pacientes/consultas/documentos/citas nuevos: bloqueado vía
 *     RLS RESTRICTIVE + gates en endpoints + layouts server-side.
 *   - Banner informa al usuario y ofrece CTA → /billing para reactivar.
 *
 * Fase 8.2: el banner consume el SubscriptionGateProvider en vez de
 * hacer fetch propio. Single source of truth con los intercepts de UI
 * y los layouts-guard. Sin waterfalls cliente-servidor.
 *
 * Paleta amber consistente con OfflineAlert.
 */
export default function SuscripcionBanner({ desktopSidebarOffset = false }: Props = {}) {
  const { state } = useSubscriptionGate()
  if (!state.isBlocked) return null

  const offsetClass = desktopSidebarOffset ? ' lg:ml-64' : ''

  return (
    <div className={`sticky top-0 z-40 border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30${offsetClass}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <AlertCircle
            size={20}
            className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            Tu suscripción terminó. Tienes acceso a tus datos pero no puedes
            crear nuevos pacientes, consultas ni documentos.
          </p>
        </div>
        <Link
          href="/billing"
          className="flex-shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
        >
          Reactivar suscripción
        </Link>
      </div>
    </div>
  )
}
