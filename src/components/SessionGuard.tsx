'use client'

/**
 * SessionGuard — Protege rutas autenticadas.
 *
 * Espera a que AuthProvider termine de inicializar antes de actuar.
 * Si initialized es false → no hace nada (el loading gate del Provider
 * ya muestra un spinner).
 * Si initialized es true y status === 'UNAUTHENTICATED' → redirect a /login.
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
      router.push('/login')
    }
  }, [status, initialized, router])

  return null
}
