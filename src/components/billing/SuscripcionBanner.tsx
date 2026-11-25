'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useSubscriptionGate } from './SubscriptionGateProvider'

type Props = {
  /**
   * Si true, se pinta como TARJETA dentro del área de contenido de `(app)`
   * (B4 del rediseño): vive dentro de `<main>`, así que ya respeta la barra, el
   * riel, el encabezado y las franjas sin desplazamientos propios. En launcher
   * (`/inicio`, fuera del rediseño hasta B14) NO se pasa y queda el de siempre.
   */
  tarjeta?: boolean
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
/** La tarjeta de `(app)`: aviso ámbar del kit, texto justificado (CALMA §20) y el botón debajo. */
function BannerTarjeta() {
  return (
    <div lang="es" className="flex flex-col items-start gap-3 rounded-[16px] bg-aviso-fondo p-4 text-aviso-tinta">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--aviso-punto)_18%,transparent)]">
          <AlertCircle size={18} />
        </span>
        <p className="text-[15px] leading-[20px] text-justify [hyphens:auto]">
          Tu suscripción terminó. Tienes acceso a tus datos pero no puedes
          crear nuevos pacientes, consultas ni documentos.
        </p>
      </div>
      <Link href="/billing" className="k-pulsable ml-11 inline-flex min-h-10 items-center rounded-[12px] bg-aviso-tinta px-4 text-[14px] font-semibold text-sup">
        Reactivar suscripción
      </Link>
    </div>
  )
}

export default function SuscripcionBanner({ tarjeta = false }: Props = {}) {
  const { state } = useSubscriptionGate()
  if (!state.isBlocked) return null
  if (tarjeta) return <BannerTarjeta />

  return (
    <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
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
