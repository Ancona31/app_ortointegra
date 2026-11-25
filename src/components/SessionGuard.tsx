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
import { mutate } from 'swr'
import { useAuth } from '@/lib/auth-context'
import { CLAVE_CONFIG } from '@/lib/configApp'
import { clearProfileCache } from '@/hooks/useProfile'
import { vaciarCacheGoogle } from '@/lib/agenda/cacheEventosGoogle'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { olvidarSemillas } from '@/lib/agenda/semillaCitas'

export default function SessionGuard() {
  const router = useRouter()
  const { status, initialized } = useAuth()

  useEffect(() => {
    if (!initialized) return
    if (status === 'UNAUTHENTICATED') {
      /* ⚠️ LA MISMA LIMPIEZA QUE `Sidebar.handleLogout`, DUPLICADA A PROPÓSITO
         (A1.6): una sesión revocada o caducada llega aquí sin pasar por ese
         botón. El `null` —no `undefined`— es lo que hace que
         `revalidarConfigAlMontar` (lib/configApp.ts) NO confíe en una semilla
         vieja que la caché del router devuelva al volver a entrar. Aquí puede
         escribirse con el árbol montado: el gate de perfil ya no lee esta
         clave (sale de `/api/me/estado-perfil`). */
      mutate(CLAVE_CONFIG, null, { revalidate: false }).catch(() => {})
      clearProfileCache()
      vaciarCacheGoogle()
      vaciarCacheCitas()
      olvidarSemillas()
      router.push('/login')
    }
  }, [status, initialized, router])

  return null
}
