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

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
    })
  }, [])

  return {
    profile,
    loading,
    isDoctor: profile?.role === 'medico' || profile?.role === 'super_admin',
    isSecretary: profile?.role === 'secretaria',
    isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',
    isSuperAdmin: profile?.role === 'super_admin',
  }
}
