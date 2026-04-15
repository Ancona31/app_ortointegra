'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clearMirror } from '@/lib/read-mirror'

/**
 * SessionGuard — Protege el acceso con lógica local-first.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ── Filosofía "Confianza Local" (Sprint 2 Bloque 2.5) ──
 *
 * Ya NO usamos el SESSION_FLAG como trigger de signOut ni el status del
 * connectionMonitor como decisor. Esas eran heurísticas brittle que
 * disparaban redirects falsos en gray zone (captive portal, Wi-Fi
 * fantasma, red lenta): el path "online" podía ejecutar un signOut con
 * Promise.race de 2s, y si la red tardaba, el usuario terminaba expulsado
 * a /login aunque tuviera una sesión perfectamente válida.
 *
 * Nueva autoridad única: `supabase.auth.getSession()`
 *   - Lee del localStorage (sin network)
 *   - Retorna { session } o { session: null }
 *   - Si hay session → trust, permitir entrar
 *   - Si no hay session → cleanup + redirect a /login
 *
 * Trade-off aceptado por decisión del product:
 *   - Se suaviza el auto-logout al cerrar tab: el token vive hasta su
 *     expiry configurado en Supabase Auth
 *   - El control de sharing en dispositivos compartidos debe configurarse
 *     vía el token expiry de Supabase (política server-side centralizada)
 *   - Prioridad explícita: continuidad de atención offline > seguridad
 *     de tab-sharing client-side
 *
 * Seguridad entre médicos en el mismo dispositivo:
 *   - handleLogout del Sidebar sigue llamando clearMirror explícito
 *   - mirrorUserId check dentro de startMirrorEngine es el backstop final
 *   - Si no hay sesión al montar, este guard también limpia el mirror
 * ═══════════════════════════════════════════════════════════════════════
 */

const SESSION_FLAG = 'spinus_active'

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function validate() {
      try {
        const supabase = createClient()
        // getSession() lee del localStorage sin red. Es el check más barato
        // y rápido que tenemos para saber si hay una sesión activa válida.
        const { data: { session } } = await supabase.auth.getSession()

        if (cancelled) return

        if (session?.user) {
          // Sesión válida → deja trabajar al médico sin más preguntas.
          // El flag SESSION_FLAG se mantiene solo como indicador informativo.
          try {
            sessionStorage.setItem(SESSION_FLAG, '1')
          } catch {
            // sessionStorage bloqueado (Safari private mode, etc.) — silent
          }
          return
        }

        // ══════════════════════════════════════════════════════════════
        // DEFENSA OFFLINE: getSession() puede retornar null si el access
        // token expiró Y el SDK intentó refresh que falló por falta de
        // red. En ese caso, el usuario tiene una sesión PERFECTAMENTE
        // VÁLIDA en localStorage que solo necesita refresh online.
        //
        // Antes de redirigir/limpiar nada, verificamos directamente si
        // hay tokens raw de Supabase en localStorage (con prefijo sb-).
        // Si los hay Y estamos offline → confiar 100% en local, NO
        // ejecutar cleanup, NO redirigir, NO clearMirror.
        //
        // Cuando el usuario vuelva online, autoRefreshToken del SDK
        // renovará el token automáticamente sin intervención.
        //
        // Esto resuelve la "expulsión fantasma" del médico cuando lleva
        // más de ~1h en la app y se va offline.
        // ══════════════════════════════════════════════════════════════
        const isOffline =
          typeof navigator !== 'undefined' && navigator.onLine === false

        if (isOffline) {
          let hasRawSupabaseToken = false
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i)
              if (k && k.startsWith('sb-') && k.includes('-auth-token')) {
                hasRawSupabaseToken = true
                break
              }
            }
          } catch {
            // localStorage bloqueado — fall through al cleanup
          }

          if (hasRawSupabaseToken) {
            // Confiar local. NO redirigir. NO clearMirror. NO cleanup.
            try {
              sessionStorage.setItem(SESSION_FLAG, '1')
            } catch {
              // silent
            }
            return
          }
        }

        // Sin sesión local Y (online OR sin token raw) → cleanup + redirect.
        // clearMirror previene que datos clínicos sigan visibles si otro
        // médico entra inmediatamente en el mismo dispositivo.
        await clearMirror().catch(() => {})

        document.cookie.split(';').forEach(c => {
          const name = c.trim().split('=')[0]
          if (name.startsWith('sb-')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
        })

        try {
          sessionStorage.removeItem(SESSION_FLAG)
        } catch {
          // silent
        }

        router.push('/login')
      } catch {
        // Error interno del SDK de Supabase → confiar en silencio.
        // Mejor permitir trabajar al médico que bloquearlo por un error
        // inesperado del cliente de auth.
      }
    }

    void validate()

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
