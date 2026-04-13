'use client'

/**
 * MirrorInitializer — Arranca el Read Mirror engine cuando hay sesión activa.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Component silencioso (retorna null). Se monta desde el layout de (app)
 * junto a SessionGuard y OfflineSync — mismo patrón de "client components
 * de efecto puro" ya establecido en la app.
 *
 * Ciclo de vida:
 *   1. Mount: lee user.id via supabase.auth.getUser() y llama
 *      startMirrorEngine(id). El engine mismo valida mirrorUserId
 *      internamente y dispara clearMirror si detecta cambio de usuario.
 *
 *   2. Suscribe a onAuthStateChange del SDK de Supabase:
 *      - SIGNED_IN   → startMirrorEngine(session.user.id)
 *      - SIGNED_OUT  → stopMirrorEngine() (cierra handle de IndexedDB)
 *      - TOKEN_REFRESHED, USER_UPDATED → ignorados (no cambian el user.id,
 *        re-sincronizar sería desperdicio de batería/red)
 *
 *   3. Unmount: unsubscribe + stopMirrorEngine() fire-and-forget
 *
 * NO llama clearMirror() directamente — eso es responsabilidad del
 * handleLogout del Sidebar, del path de logout del SessionGuard y del
 * pre-login cleanup de la página de login. Aquí solo gestionamos el
 * ciclo de vida del engine.
 *
 * Seguridad entre usuarios: el mirrorUserId check dentro de
 * startMirrorEngine es el backstop definitivo. Si un médico cierra
 * sesión sin pasar por handleLogout (crash, token revoke, etc.), el
 * próximo login detecta el cambio de user.id y limpia el mirror
 * automáticamente antes de cualquier sync.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { startMirrorEngine, stopMirrorEngine } from '@/lib/read-mirror'

export default function MirrorInitializer() {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // Arranque inicial al montar el layout de (app)
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (user?.id) {
          await startMirrorEngine(user.id)
        }
      } catch {
        // silent — sin user, el mirror simplemente no arranca.
        // Tampoco queremos romper el layout por un fallo del engine.
      }
    }

    void init()

    // Listener de cambios de auth — solo reaccionamos a SIGNED_IN / SIGNED_OUT
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return

        if (event === 'SIGNED_OUT') {
          await stopMirrorEngine()
          return
        }

        if (event === 'SIGNED_IN' && session?.user?.id) {
          // startMirrorEngine es idempotente: si el user.id coincide con
          // el mirrorUserId guardado, solo dispara sync. Si difiere, dispara
          // clearMirror y luego sync.
          await startMirrorEngine(session.user.id)
        }

        // TOKEN_REFRESHED y USER_UPDATED intencionalmente ignorados
      },
    )

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
      // Fire-and-forget: el unmount no debe bloquear esperando el cierre de IDB
      void stopMirrorEngine()
    }
  }, [])

  return null
}
