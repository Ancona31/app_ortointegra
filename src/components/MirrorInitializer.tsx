'use client'

/**
 * MirrorInitializer — Arranca el Read Mirror engine cuando hay userId válido.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ── Zero-Trust Network (FASE A.1) ──
 *
 * Este componente NO habla con supabase.auth. NO llama getUser(). NO
 * escucha onAuthStateChange. Esas APIs hacen network offline y pueden
 * emitir SIGNED_OUT fantasma durante gray zone, lo que antes provocaba
 * stopMirrorEngine() sobre un usuario legítimo.
 *
 * La ÚNICA fuente de verdad es el AuthContext (`useAuth().userId`), que
 * vive en spinus_session_meta y es local-first. Si AuthContext dice que
 * hay userId, arrancamos el engine. Si dice que no, lo paramos. Punto.
 *
 * ── Idempotencia local ──
 *
 * React 18 strict-mode en dev re-monta los efectos para detectar bugs.
 * Sin guard, cada re-mount dispararía un sync completo (desperdicio de
 * batería/red). Usamos useRef para trackear el último userId ya arrancado
 * y saltar re-arranques redundantes.
 *
 * startMirrorEngine internamente hace short-circuit de clearMirror cuando
 * mirrorUserId almacenado coincide con el nuevo userId (read-mirror.ts:885).
 * Eso preserva el backstop de seguridad entre médicos.
 *
 * ── Seguridad entre médicos en el mismo dispositivo ──
 *
 * 1. handleLogout del Sidebar → signOut() del AuthContext → clearMirror
 *    (responsabilidad movida a FASE A.2).
 * 2. startMirrorEngine detecta mirrorUserId distinto y dispara clearMirror
 *    antes de cualquier sync (backstop definitivo, ya implementado).
 *
 * Este componente no toca clearMirror directamente.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { startMirrorEngine, stopMirrorEngine } from '@/lib/read-mirror'

export default function MirrorInitializer() {
  const { userId } = useAuth()
  const lastStartedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (userId) {
      // Guard de idempotencia: si ya arrancamos con este mismo userId,
      // saltamos. Evita doble sync en strict-mode re-mounts.
      if (lastStartedUserIdRef.current === userId) return

      lastStartedUserIdRef.current = userId
      void startMirrorEngine(userId).catch(() => {
        // Error interno del engine — no debe romper el layout.
        // Resetear el ref para permitir retry en el próximo re-render.
        if (!cancelled) lastStartedUserIdRef.current = null
      })
      return () => {
        cancelled = true
      }
    }

    // userId pasó a null → logout o grace period expirado.
    // Detener el engine y liberar el ref para el próximo login.
    if (lastStartedUserIdRef.current !== null) {
      lastStartedUserIdRef.current = null
      void stopMirrorEngine()
    }

    return () => {
      cancelled = true
    }
  }, [userId])

  return null
}
