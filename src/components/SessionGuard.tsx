'use client'

/**
 * SessionGuard — Protege rutas autenticadas.
 *
 * Espera a que AuthProvider termine de inicializar antes de actuar.
 * Si initialized es false → no hace nada (el loading gate del Provider
 * ya muestra un spinner).
 * Si initialized es true y status === 'UNAUTHENTICATED':
 *   - Online → redirect a /login
 *   - Offline → redirect a /offline-mode (evita loop login↔inicio)
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SessionGuard() {
  const router = useRouter()
  const { status, initialized } = useAuth()

  useEffect(() => {
    if (!initialized) return
    if (status === 'UNAUTHENTICATED') {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        window.location.href = '/offline-mode'
      } else {
        router.push('/login')
      }
    }
  }, [status, initialized, router])

  return null
}
