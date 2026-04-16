'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { secureStorage } from '@/lib/secureStorage'

export type Role = 'super_admin' | 'admin' | 'medico' | 'secretaria'

export interface Profile {
  id: string
  role: Role
  nombre?: string | null
  clinica_id?: string | null
  cedula_profesional?: string | null
  cedula_especialidad?: string | null
  especialidad?: string | null
  titulo?: string | null
  universidad?: string | null
}

const PROFILE_CACHE_KEY = 'cache_user_profile'

// Caché a nivel de módulo: evita múltiples queries cuando varios componentes
// usan useProfile() al mismo tiempo en la misma sesión.
let profilePromise: Promise<Profile | null> | null = null

/** Lee el profile cacheado en secureStorage (cifrado AES-256-GCM) */
async function getCachedProfile(): Promise<Profile | null> {
  try {
    const cached = await secureStorage.get<Profile>(PROFILE_CACHE_KEY)
    return cached ?? null
  } catch {
    return null
  }
}

/**
 * Timeout en ms para el fetch remoto antes de caer al cache.
 * Motivo: en gray zone (captive portal, Wi-Fi fantasma, DNS lento),
 * el fetch puede colgarse indefinidamente y dejar el Dashboard en
 * skeleton eterno. Con timeout, el médico ve sus datos locales en
 * ≤3s garantizado.
 */
const FETCH_TIMEOUT_MS = 3000

function fetchProfile(): Promise<Profile | null> {
  if (profilePromise) return profilePromise

  // Offline declarado: no tocar Supabase, leer directo del cache
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    profilePromise = getCachedProfile()
    return profilePromise
  }

  const supabase = createClient()
  const fetchPromise: Promise<Profile | null> = supabase.auth.getUser()
    .then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (!user) return null
      return supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(async (res: { data: Record<string, string | null> | null }) => {
          const profile = res.data as Profile | null
          // Persistir en secureStorage para acceso offline futuro
          if (profile) {
            secureStorage.set(PROFILE_CACHE_KEY, profile).catch(() => {})
          }
          return profile
        })
    })
    .catch(async () => {
      // Fetch falló (offline sobrevenido, red caída, error) → fallback al cache
      return await getCachedProfile()
    })

  // Timeout de emergencia: si el remoto no responde en 3s,
  // resolvemos con el cache. Evita el "spinner eterno" en gray zone.
  const timeoutPromise = new Promise<Profile | null>(resolve => {
    setTimeout(async () => {
      const cached = await getCachedProfile()
      resolve(cached)
    }, FETCH_TIMEOUT_MS)
  })

  profilePromise = Promise.race([fetchPromise, timeoutPromise])
  return profilePromise!
}

/** Limpiar caché al cerrar sesión (llamar desde el botón de logout) */
export function clearProfileCache() {
  profilePromise = null
  // Limpiar también el cache persistente
  try {
    secureStorage.remove(PROFILE_CACHE_KEY)
  } catch {
    // silencioso
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile().then(data => {
      setProfile(data)
      setLoading(false)
    })
  }, [])

  return {
    profile,
    loading,
    isDoctor: profile?.role === 'medico' || profile?.role === 'super_admin' || profile?.role === 'admin',
    isSecretary: profile?.role === 'secretaria',
    isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',
    isSuperAdmin: profile?.role === 'super_admin',
  }
}
