'use client'

/**
 * SessionGuard — Protege rutas autenticadas.
 *
 * Si status === 'UNAUTHENTICATED' → redirigir a /login
 *
 * Toda la lógica de limpieza está centralizada en signOut() del
 * AuthContext. SessionGuard solo observa el resultado.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SessionGuard() {
  const router = useRouter()
  const { status } = useAuth()

  useEffect(() => {
    if (status === 'UNAUTHENTICATED') {
      router.push('/login')
    }
  }, [status, router])

  return null
}
