'use client'

/**
 * SessionGuard — Protege el acceso con lógica local-first.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ── FASE A.2: Consumidor pasivo de AuthContext ──
 *
 * Este componente ya NO valida tokens, NO llama al SDK, NO limpia
 * cookies ni mirror. Su única responsabilidad es:
 *
 *   Si status === 'UNAUTHENTICATED' → redirigir a /login
 *
 * Toda la lógica de limpieza está centralizada en signOut() del
 * AuthContext. SessionGuard solo observa el resultado.
 *
 * ── Protección offline ──
 *
 * AuthContext mantiene userId desde spinus_session_meta (localStorage)
 * y valida el token localmente con grace period de 30 min. Un médico
 * offline con token biológicamente válido NUNCA será redirigido.
 * Solo pierde acceso si:
 *   1. El token realmente expiró (tiempo biológico)
 *   2. Hizo logout explícito
 * ═══════════════════════════════════════════════════════════════════════
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
