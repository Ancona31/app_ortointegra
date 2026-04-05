'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

// Caché a nivel de módulo: evita múltiples queries cuando varios componentes
// usan useProfile() al mismo tiempo en la misma sesión.
let profilePromise: Promise<Profile | null> | null = null

function fetchProfile(): Promise<Profile | null> {
  if (profilePromise) return profilePromise
  const supabase = createClient()
  profilePromise = supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return null
    return supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }: { data: any }) => data)
  }).catch(() => null)
  return profilePromise
}

// Limpiar caché al cerrar sesión (llamar desde el botón de logout)
export function clearProfileCache() {
  profilePromise = null
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
