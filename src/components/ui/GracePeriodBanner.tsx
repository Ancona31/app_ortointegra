'use client'

/**
 * GracePeriodBanner — Informa al médico sobre el estado de su sesión offline.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ── FASE B.1: Transparencia al médico ──
 *
 * Dos estados visuales:
 *
 *   Ámbar: status === 'FRESH' + offline + graceRemainingMs < 10 min
 *          → "Trabajando sin conexión — verificación pendiente en X min"
 *
 *   Rojo:  status === 'GRACE_EXPIRED'
 *          → "Modo de solo lectura — Reconecta para validar tu sesión"
 *
 * No se muestra si:
 *   - Está online y FRESH (todo normal)
 *   - UNAUTHENTICATED (SessionGuard ya redirige a /login)
 *   - Offline pero graceRemainingMs >= 10 min (aún hay tiempo)
 *
 * El countdown se actualiza cada 60s via setInterval que fuerza re-render.
 * No es un poll al SDK — solo re-lee tokenState del AuthContext.
 *
 * Sigue el patrón de PersistenceWarning.tsx:
 *   - mounted state para hydration safety
 *   - role="alert" + aria-live="polite"
 *   - NO dismissable (información crítica mientras persista la condición)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { subscribe, getStatus, type ConnectionStatus } from '@/lib/connectionMonitor'

const GRACE_WARNING_THRESHOLD_MS = 10 * 60 * 1000

export default function GracePeriodBanner() {
  const { status, tokenState } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [offline, setOffline] = useState(() => getStatus() === 'offline')
  const [, setTick] = useState(0)

  // Hydration safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Suscripción al connectionMonitor
  useEffect(() => {
    const unsub = subscribe((s: ConnectionStatus) => setOffline(s === 'offline'))
    return unsub
  }, [])

  // Tick cada 60s para actualizar el countdown del grace period
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!mounted) return null

  const { graceRemainingMs } = tokenState

  // Estado rojo: grace period expirado
  if (status === 'GRACE_EXPIRED') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="bg-red-50 border-b border-red-200 shadow-sm"
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-red-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">
              Modo de solo lectura
            </p>
            <p className="text-xs text-red-800 mt-1 leading-relaxed">
              Reconecta para validar tu sesión y continuar editando.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Estado ámbar: offline + FRESH + menos de 10 min restantes
  if (
    status === 'FRESH' &&
    offline &&
    graceRemainingMs !== null &&
    graceRemainingMs < GRACE_WARNING_THRESHOLD_MS
  ) {
    const minutesLeft = Math.max(1, Math.ceil(graceRemainingMs / 60_000))

    return (
      <div
        role="alert"
        aria-live="polite"
        className="bg-amber-50 border-b border-amber-200 shadow-sm"
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-amber-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Trabajando sin conexión
            </p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Verificación de sesión pendiente en {minutesLeft} min.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Online y FRESH, o FRESH offline con > 10 min → no mostrar nada
  return null
}
