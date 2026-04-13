'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getStatus } from '@/lib/connectionMonitor'
import { clearMirror } from '@/lib/read-mirror'

/**
 * SessionGuard — Protege el auto-logout al cerrar el navegador sin bloquear
 * el acceso offline del médico.
 *
 * ── Lógica de "Confianza Local" ────────────────────────────────────────
 *
 * Problema que resuelve:
 *   Con Supabase usando localStorage (no sessionStorage), la sesión sobrevive
 *   al cierre del tab. Pero los hospitales requieren que cerrar el navegador
 *   implique logout (dispositivos compartidos). Resolvemos con un flag en
 *   sessionStorage que muere al cerrar el tab → detectamos "tab nuevo".
 *
 * Reglas (ejecutadas en el useEffect al montar):
 *
 *   1. Si sessionStorage tiene SESSION_FLAG → sesión legítima en curso, salir.
 *
 *   2. Si no hay cookies sb-* en el documento → tab limpio. Marcar el flag
 *      (para no re-evaluar en próximos mounts) y salir.
 *
 *   3. Si hay cookies sb-* pero el flag NO existe → tab nuevo con sesión
 *      residual. Decidir entre confiar o validar:
 *
 *      a. Si estamos OFFLINE REAL (navigator.onLine === false OR
 *         connectionMonitor dice offline) → CONFIAR LOCAL. Marcar el flag
 *         y dejar pasar al usuario. El médico NO queda atrapado en login.
 *
 *      b. Si estamos ONLINE → ejecutar signOut con Promise.race de 2s.
 *         Limpieza manual de cookies en .finally() (garantizada incluso
 *         si signOut colgó). Redirigir a /login.
 *
 * ── Por qué esto es seguro ──────────────────────────────────────────────
 *
 *   - Offline: el usuario accede con sus datos locales sin validación
 *     remota. El token puede estar expirado, pero Supabase no será llamado
 *     hasta que haya red. Cuando vuelva online, autoRefreshToken del SDK
 *     lo renovará transparentemente.
 *
 *   - Online con sesión residual: signOut limpia el backend. Si falla por
 *     red lenta o captive portal, el timeout de 2s + limpieza manual
 *     garantizan que las cookies locales queden limpias igual. El token
 *     del backend expira solo eventualmente.
 *
 *   - Captive portals: connectionMonitor.getStatus() === 'offline' los
 *     detecta por ping fallido a /api/health. Aun si navigator.onLine
 *     dice true, confiamos en el monitor y entramos en modo offline.
 */

const SESSION_FLAG = 'spinus_active'
const SIGNOUT_TIMEOUT_MS = 2000

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    // Paso 1: sesión legítima en curso
    const isActiveSession = sessionStorage.getItem(SESSION_FLAG)
    if (isActiveSession) return

    // Paso 2: buscar cookies residuales de Supabase
    const hasSupabaseCookies = document.cookie
      .split(';')
      .some(c => c.trim().startsWith('sb-'))

    if (!hasSupabaseCookies) {
      // Tab limpio, primera visita sin sesión residual → marcar flag y salir
      sessionStorage.setItem(SESSION_FLAG, '1')
      return
    }

    // Paso 3: hay cookies residuales → decidir confiar u validar
    const browserOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false
    const monitorOffline = getStatus() === 'offline'
    const isTrulyOffline = browserOffline || monitorOffline

    if (isTrulyOffline) {
      // CONFIANZA LOCAL: el médico entra sin bloqueo. autoRefreshToken del
      // SDK de Supabase renovará el token cuando haya red.
      sessionStorage.setItem(SESSION_FLAG, '1')
      return
    }

    // Online real → validar con el servidor con timeout agresivo.
    // Defensa en profundidad: wipe del read mirror como parte del cleanup
    // por sesión residual. Fire-and-forget con .catch porque el
    // mirrorUserId check del próximo login es el backstop definitivo.
    void clearMirror().catch(() => {})
    const supabase = createClient()
    const signOutPromise = supabase.auth.signOut().catch(() => null)
    const timeoutPromise = new Promise<void>(resolve =>
      setTimeout(resolve, SIGNOUT_TIMEOUT_MS)
    )

    Promise.race([signOutPromise, timeoutPromise]).finally(() => {
      // Limpieza manual de cookies sb-* — garantizada incluso si signOut
      // colgó más allá del timeout (captive portal, DNS lento, etc.)
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      })
      sessionStorage.removeItem(SESSION_FLAG)
      // NO limpiamos localStorage.spinus_sec_* aquí — se delega al TTL de 24h
      // del secureStorage. Esto preserva queues offline pendientes de sync.
      router.push('/login')
    })
  }, [router])

  return null
}
