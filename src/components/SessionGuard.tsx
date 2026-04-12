'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * Detecta si la sesión del navegador es nueva (pestaña fresca) o restaurada.
 * Si el usuario cerró el navegador y lo volvió a abrir, fuerza logout.
 *
 * Mecanismo: al montar, graba un flag en sessionStorage.
 * sessionStorage muere al cerrar la pestaña. Si al montar el flag NO existe
 * pero sí hay cookies de Supabase, significa que el navegador restauró cookies
 * de una sesión anterior → forzar logout.
 *
 * Offline: el signOut() hace un request de red que puede colgar indefinidamente.
 * Usamos Promise.race con un timeout de 2s para evitar que la app quede atascada
 * si el usuario reabre sin conexión.
 */
const SESSION_FLAG = 'spinus_active'
const SIGNOUT_TIMEOUT_MS = 2000

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const isActiveSession = sessionStorage.getItem(SESSION_FLAG)

    if (isActiveSession) return // Sesión legítima en curso

    // Es una pestaña nueva. ¿Hay cookies de Supabase residuales?
    const hasSupabaseCookies = document.cookie.split(';').some(c => c.trim().startsWith('sb-'))

    if (hasSupabaseCookies) {
      // Cookies residuales de una sesión anterior → limpiar y redirigir a login
      const supabase = createClient()

      // Promise.race: completa al primero que responda (signOut o timeout)
      const signOutPromise = supabase.auth.signOut().catch(() => null)
      const timeoutPromise = new Promise<void>(resolve =>
        setTimeout(resolve, SIGNOUT_TIMEOUT_MS)
      )

      Promise.race([signOutPromise, timeoutPromise]).finally(() => {
        // Limpiar cookies manualmente (garantizado incluso si signOut colgó)
        document.cookie.split(';').forEach(c => {
          const name = c.trim().split('=')[0]
          if (name.startsWith('sb-')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
        })
        sessionStorage.removeItem(SESSION_FLAG)
        router.push('/login')
      })
      return
    }

    // No hay cookies residuales, marcar sesión como activa
    sessionStorage.setItem(SESSION_FLAG, '1')
  }, [router])

  return null
}
