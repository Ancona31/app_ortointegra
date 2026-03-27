'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Role = 'medico' | 'secretaria'

export interface Profile {
  id: string
  role: Role
  nombre?: string | null
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('*').single().then(({ data }) => {
      setProfile(data)
      setLoading(false)
    })
  }, [])

  return { profile, loading, isDoctor: profile?.role === 'medico', isSecretary: profile?.role === 'secretaria' }
}
